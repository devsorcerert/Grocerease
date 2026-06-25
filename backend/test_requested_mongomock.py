import pytest
import asyncio
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
import uuid

@pytest.mark.asyncio
async def test_atomic_rollback():
    from routers.orders import create_order_core
    from models import CreateOrderRequest
    from mongomock_motor import AsyncMongoMockClient
    from fastapi import HTTPException
    
    mock_db = AsyncMongoMockClient().grocerease
    await mock_db.cart_items.insert_one({"user_id": "u1", "product_id": "p1", "quantity": 2})
    await mock_db.addresses.insert_one({"id": "a1", "user_id": "u1", "lat": 10.0, "lng": 20.0, "full_address": "Test Addr"})
    await mock_db.products.insert_one({"id": "p1", "name": "Apple", "price": 100.0, "stock": 5})
    await mock_db.users.insert_one({"id": "u1", "monthly_spend": 0.0, "total_spend": 0.0, "current_reward": 0.0})

    with patch("routers.orders.db", mock_db):
        with patch("routers.orders.find_serving_store", return_value={"id": "store1"}):
            with patch("routers.orders.transition_order_status", side_effect=Exception("Mid-flow DB failure")):
                payload = CreateOrderRequest(address_id="a1", payment_method="cod", coupon_code=None)
                try:
                    await create_order_core(payload, "u1", is_pending=False)
                except HTTPException as e:
                    assert e.status_code == 500
                    assert "Mid-flow DB failure" in e.detail

    prod = await mock_db.products.find_one({"id": "p1"})
    assert prod["stock"] == 5
    orders = await mock_db.orders.count_documents({})
    assert orders == 0

@pytest.mark.asyncio
async def test_cas_second_claim_returns_409():
    from routers.orders import assign_rider_to_order
    from mongomock_motor import AsyncMongoMockClient
    from fastapi import HTTPException
    from routers.orders import AssignRiderRequest
    
    mock_db = AsyncMongoMockClient().grocerease
    await mock_db.orders.insert_one({"id": "order1", "status": "pending_assignment", "assigned_rider_id": None})
    await mock_db.riders.insert_one({"id": "rider1", "current_order_id": None, "status": "online"})
    await mock_db.riders.insert_one({"id": "rider2", "current_order_id": None, "status": "online"})
    
    with patch("routers.orders.db", mock_db):
        req1 = AssignRiderRequest(rider_id="rider1")
        res1 = await assign_rider_to_order("order1", req1, admin={})
        assert res1["success"] is True
        
        req2 = AssignRiderRequest(rider_id="rider2")
        try:
            await assign_rider_to_order("order1", req2, admin={})
        except HTTPException as e:
            assert e.status_code == 409
            
        rider2 = await mock_db.riders.find_one({"id": "rider2"})
        assert rider2["current_order_id"] is None
        order = await mock_db.orders.find_one({"id": "order1"})
        assert order["assigned_rider_id"] == "rider1"

@pytest.mark.asyncio
async def test_stock_expiry_releases_only_pending_payment():
    from routers.background_jobs import expire_stale_pending_orders
    from mongomock_motor import AsyncMongoMockClient
    
    mock_db = AsyncMongoMockClient().grocerease
    past_ttl = datetime.utcnow() - timedelta(minutes=45)
    recent = datetime.utcnow() - timedelta(minutes=5)
    
    await mock_db.orders.insert_one({"id": "order_expire", "payment_status": "pending", "payment_method": "upi", "status": "pending_payment", "created_at": past_ttl, "user_id": "u1", "items": [{"product_id": "p1", "quantity": 2}]})
    await mock_db.orders.insert_one({"id": "order_recent", "payment_status": "pending", "payment_method": "upi", "status": "pending_payment", "created_at": recent, "user_id": "u1", "items": [{"product_id": "p1", "quantity": 1}]})
    await mock_db.orders.insert_one({"id": "order_cod", "payment_status": "pending", "payment_method": "cod", "status": "cod_confirmed", "created_at": past_ttl, "user_id": "u1", "items": [{"product_id": "p1", "quantity": 1}]})
    await mock_db.products.insert_one({"id": "p1", "stock": 10})
    
    with patch("routers.background_jobs.db", mock_db), patch("routers.orders.db", mock_db):
        res = await expire_stale_pending_orders()
        assert res == 1
        expired = await mock_db.orders.find_one({"id": "order_expire"})
        assert expired["status"] == "cancelled"
        prod = await mock_db.products.find_one({"id": "p1"})
        assert prod["stock"] == 12
        cod = await mock_db.orders.find_one({"id": "order_cod"})
        assert cod["status"] == "cod_confirmed"

@pytest.mark.asyncio
async def test_plain_ledger_earn_balance_math():
    from routers.loop_ledger import credit_loop_balance_paise, debit_loop_balance_paise
    from mongomock_motor import AsyncMongoMockClient
    
    mock_db = AsyncMongoMockClient().grocerease
    await mock_db.users.insert_one({"id": "u1", "loop_balance_paise": 0})
    
    with patch("routers.loop_ledger.db", mock_db):
        await credit_loop_balance_paise("u1", 1000, "earn", "r1", "Earned 1000")
        user = await mock_db.users.find_one({"id": "u1"})
        assert user["loop_balance_paise"] == 1000
        await debit_loop_balance_paise("u1", 500, "redeem", "r2", "Redeemed 500")
        user = await mock_db.users.find_one({"id": "u1"})
        assert user["loop_balance_paise"] == 500
