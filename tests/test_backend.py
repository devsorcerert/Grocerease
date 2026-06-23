import os
import sys
import pytest
from fastapi.testclient import TestClient

# Set test environment variables before importing any app modules
os.environ["DB_NAME"] = "grocerease_test"
os.environ["JWT_SECRET_KEY"] = "super-secret-test-key-minimum-32-chars-long-12345"
os.environ["ADMIN_EMAIL"] = "grocereasetv@gmail.com"
os.environ["ADMIN_PASSWORD"] = "admin123"
os.environ["RAZORPAY_KEY_ID"] = "rzp_test_dummykey"
os.environ["RAZORPAY_KEY_SECRET"] = "dummypaymentsecret"

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from server import app
from database import db, client, db_name, hash_password
from init_db import init_database
import asyncio
from unittest.mock import MagicMock, patch

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    # Run database initialization (creates indexes, default admin)
    asyncio.run(init_database())
    
    # Seed mock products
    async def seed_products():
        await db.products.delete_many({})
        await db.products.insert_many([
            {
                "id": "prod-apple",
                "name": "Fresh Apples",
                "price": 100.0,
                "original_price": 120.0,
                "stock": 10,
                "unit": "1 kg",
                "category": "Fruits & Vegetables",
                "brand": "Fresh Farms"
            },
            {
                "id": "prod-milk",
                "name": "Organic Milk",
                "price": 50.0,
                "original_price": 55.0,
                "stock": 5,
                "unit": "1 L",
                "category": "Dairy & Breakfast",
                "brand": "Dairy Fresh"
            },
            {
                "id": "prod-out",
                "name": "Out Of Stock Item",
                "price": 20.0,
                "original_price": 20.0,
                "stock": 0,
                "unit": "1 pack",
                "category": "Munchies",
                "brand": "Munchy"
            }
        ])
        
        # Clean other collections
        await db.users.delete_many({})
        await db.cart_items.delete_many({})
        await db.orders.delete_many({})
        await db.order_events.delete_many({})
        await db.addresses.delete_many({})
        
    asyncio.run(seed_products())
    
    yield
    
    # Cleanup after session
    async def cleanup():
        await client.drop_database(db_name)
    asyncio.run(cleanup())

@pytest.fixture
def client_fixture():
    return TestClient(app)

def test_auth_flow(client_fixture):
    # 1. Register a new user
    reg_data = {
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "Password123",
        "phone": "+919999999999"
    }
    resp = client_fixture.post("/api/auth/register", json=reg_data)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "testuser@example.com"
    
    token = data["token"]
    refresh_token = data["refresh_token"]
    
    # 2. Login
    login_data = {
        "email": "testuser@example.com",
        "password": "Password123"
    }
    resp = client_fixture.post("/api/auth/login", json=login_data)
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    
    # 3. Get profile
    headers = {"Authorization": f"Bearer {token}"}
    resp = client_fixture.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "testuser@example.com"
    
    # 4. Refresh token
    resp = client_fixture.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "token" in resp.json()
    
    # 5. Logout
    resp = client_fixture.post("/api/auth/logout", json={"refresh_token": refresh_token}, headers=headers)
    assert resp.status_code == 200

def test_cart_operations(client_fixture):
    # Log in test user to get token
    login_data = {"email": "testuser@example.com", "password": "Password123"}
    resp = client_fixture.post("/api/auth/login", json=login_data)
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Add to cart
    resp = client_fixture.post("/api/cart/add", json={"product_id": "prod-apple", "quantity": 2}, headers=headers)
    assert resp.status_code == 200
    cart = resp.json()
    assert len(cart["items"]) == 1
    assert cart["items"][0]["product_id"] == "prod-apple"
    assert cart["items"][0]["quantity"] == 2
    
    # Get cart
    resp = client_fixture.get("/api/cart", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1
    
    # Update quantity
    resp = client_fixture.post("/api/cart/update", json={"product_id": "prod-apple", "quantity": 5}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["items"][0]["quantity"] == 5
    
    # Clear cart
    resp = client_fixture.delete("/api/cart/clear", headers=headers)
    assert resp.status_code == 200
    
    # Get cart again (should be empty)
    resp = client_fixture.get("/api/cart", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 0

def test_checkout_and_stock_reservation(client_fixture):
    # Log in test user
    login_data = {"email": "testuser@example.com", "password": "Password123"}
    resp = client_fixture.post("/api/auth/login", json=login_data)
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Find user id
    async def get_user_id():
        u = await db.users.find_one({"email": "testuser@example.com"})
        return u["id"]
    user_id = asyncio.run(get_user_id())
    
    # Create test address
    async def create_address():
        await db.addresses.delete_many({})
        await db.addresses.insert_one({
            "id": "addr-1",
            "user_id": user_id,
            "label": "Home",
            "full_address": "Tirupati Temple Road",
            "landmark": "Near Gopuram"
        })
    asyncio.run(create_address())
    
    # Add items to cart (2 apples, 1 milk)
    client_fixture.post("/api/cart/add", json={"product_id": "prod-apple", "quantity": 2}, headers=headers)
    client_fixture.post("/api/cart/add", json={"product_id": "prod-milk", "quantity": 1}, headers=headers)
    
    # Checkout Summary check
    summary_data = {
        "address_id": "addr-1",
        "coupon_code": None,
        "payment_method": "COD"
    }
    resp = client_fixture.post("/api/orders/summary", json=summary_data, headers=headers)
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["subtotal"] == 250.0  # 2*100 + 50
    assert summary["delivery_fee"] == 30.0  # subtotal < 299
    assert summary["total"] == 280.0
    
    # Checkout COD Order
    order_data = {
        "address_id": "addr-1",
        "coupon_code": None,
        "payment_method": "COD"
    }
    
    # Check initial stocks: apple: 10, milk: 5
    async def check_stocks():
        p_apple = await db.products.find_one({"id": "prod-apple"})
        p_milk = await db.products.find_one({"id": "prod-milk"})
        return p_apple["stock"], p_milk["stock"]
    
    apple_stock_before, milk_stock_before = asyncio.run(check_stocks())
    assert apple_stock_before == 10
    assert milk_stock_before == 5
    
    resp = client_fixture.post("/api/orders/create", json=order_data, headers=headers)
    assert resp.status_code == 200
    order = resp.json()
    assert order["status"] == "cod_confirmed"
    assert order["payment_method"] == "COD"
    assert order["payment_status"] == "pending_cod"
    
    # Verify stocks decremented: apple should be 8, milk should be 4
    apple_stock_after, milk_stock_after = asyncio.run(check_stocks())
    assert apple_stock_after == 8
    assert milk_stock_after == 4
    
    # Verify order event was logged
    async def check_order_events():
        events = await db.order_events.find({"order_id": order["id"]}).to_list(10)
        return len(events)
    assert asyncio.run(check_order_events()) > 0
    
    # 4. Out of stock error & compensating rollback validation
    # Try to add out of stock item to cart
    client_fixture.post("/api/cart/add", json={"product_id": "prod-out", "quantity": 1}, headers=headers)
    # Also add milk (quantity: 2) which only has 4 left
    client_fixture.post("/api/cart/add", json={"product_id": "prod-milk", "quantity": 2}, headers=headers)
    
    # Checkout should fail because prod-out is out of stock (stock is 0)
    resp = client_fixture.post("/api/orders/create", json=order_data, headers=headers)
    assert resp.status_code == 400
    assert "Insufficient stock" in resp.json()["detail"]
    
    # Verify stock of milk was rolled back (should still be 4, not 2)
    _, milk_stock_after_fail = asyncio.run(check_stocks())
    assert milk_stock_after_fail == 4

def test_order_status_machine_and_admin(client_fixture):
    # Login admin
    admin_login = {
        "email": "grocereasetv@gmail.com",
        "password": "admin123"
    }
    resp = client_fixture.post("/api/admin/login", json=admin_login)
    assert resp.status_code == 200
    admin_token = resp.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Find the created order id
    async def get_test_order():
        o = await db.orders.find_one({})
        return o["id"]
    order_id = asyncio.run(get_test_order())
    
    # Transition to packed
    resp = client_fixture.post(
        f"/api/admin/orders/{order_id}/status", 
        json={"status": "packed", "reason": "Packed by staff"},
        headers=admin_headers
    )
    assert resp.status_code == 200
    
    # Verify order state and tracking
    async def get_order_details():
        o = await db.orders.find_one({"id": order_id})
        events = await db.order_events.find({"order_id": order_id, "to_status": "packed"}).to_list(1)
        return o["status"], o["delivery_status"], len(events)
    
    status, delivery_status, packed_events_count = asyncio.run(get_order_details())
    assert status == "packed"
    assert delivery_status == "packed"
    assert packed_events_count == 1

@patch("routers.payments.get_razorpay_client")
def test_razorpay_payment_verification(mock_get_client, client_fixture):
    # Mock Razorpay Client and verify utility
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_client.utility.verify_payment_signature.return_value = True
    
    # Log in test user
    login_data = {"email": "testuser@example.com", "password": "Password123"}
    resp = client_fixture.post("/api/auth/login", json=login_data)
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a prepaid order
    # First clear cart and add items
    client_fixture.delete("/api/cart/clear", headers=headers)
    client_fixture.post("/api/cart/add", json={"product_id": "prod-milk", "quantity": 1}, headers=headers)
    
    order_data = {
        "address_id": "addr-1",
        "coupon_code": None,
        "payment_method": "Razorpay"
    }
    resp = client_fixture.post("/api/orders/create-pending", json=order_data, headers=headers)
    assert resp.status_code == 200
    order = resp.json()
    assert order["status"] == "pending_payment"
    assert order["payment_status"] == "pending"
    
    # Verify payment signatures
    verify_data = {
        "order_id": order["id"],
        "razorpay_order_id": "rzp_order_abc123",
        "razorpay_payment_id": "rzp_payment_xyz789",
        "razorpay_signature": "mock_sig_123"
    }
    resp = client_fixture.post("/api/payments/razorpay/verify", json=verify_data, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    
    # Verify order transitions to paid
    async def check_order_paid():
        o = await db.orders.find_one({"id": order["id"]})
        return o["status"], o["payment_status"]
    
    o_status, o_payment = asyncio.run(check_order_paid())
    assert o_status == "paid"
    assert o_payment == "paid"

def test_order_tracking_with_rider(client_fixture):
    # 1. Register a new user
    reg_data = {
        "name": "Tracking User",
        "email": "trackinguser@example.com",
        "password": "Password123",
        "phone": "+919999999988"
    }
    resp = client_fixture.post("/api/auth/register", json=reg_data)
    assert resp.status_code == 200, resp.text
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get user id
    async def get_user_id():
        u = await db.users.find_one({"email": "trackinguser@example.com"})
        return u["id"]
    user_id = asyncio.run(get_user_id())
    
    # 2. Insert a mock order and a mock rider
    import uuid
    from datetime import datetime, timedelta
    order_id = str(uuid.uuid4())
    async def insert_mock_order_and_rider():
        await db.orders.insert_one({
            "id": order_id,
            "user_id": user_id,
            "status": "picked_up",
            "delivery_address": "Test Address",
            "estimated_delivery": datetime.utcnow() + timedelta(hours=1),
            "tracking_updates": [],
            "assigned_rider_id": "rider-abc"
        })
        
        await db.riders.delete_many({})
        await db.riders.insert_one({
            "id": "rider-abc",
            "name": "Rider Name",
            "phone": "+91 99999 88888",
            "vehicle": "Hero Splendor - AP39XX1234",
            "rating": 4.9,
            "current_location": {
                "latitude": 13.6284,
                "longitude": 79.4192
            },
            "estimated_delivery_minutes": 12,
            "status": "active"
        })
    asyncio.run(insert_mock_order_and_rider())
    
    # 3. Fetch tracking and assert correctness
    resp = client_fixture.get(f"/api/orders/{order_id}/tracking", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "picked_up"
    assert data["delivery_partner"] is not None
    assert data["delivery_partner"]["id"] == "rider-abc"
    assert data["delivery_partner"]["name"] == "Rider Name"
    assert data["delivery_partner"]["phone"] == "+91 99999 88888"
    assert data["delivery_partner"]["vehicle"] == "Hero Splendor - AP39XX1234"
    assert data["delivery_partner"]["rating"] == 4.9
    assert data["delivery_partner"]["current_location"]["latitude"] == 13.6284
    assert data["delivery_partner"]["current_location"]["longitude"] == 79.4192
    assert data["delivery_partner"]["estimated_arrival"] == "12 minutes"

def test_rider_endpoints(client_fixture):
    # 1. Seed a mock active rider and a mock suspended rider
    async def seed_riders():
        await db.riders.delete_many({})
        # Active rider
        await db.riders.insert_one({
            "id": "rider-1",
            "name": "Test Rider",
            "phone": "+919988776655",
            "password": hash_password("riderpass123"),
            "status": "offline",
            "current_order_id": None
        })
        # Suspended rider
        await db.riders.insert_one({
            "id": "rider-suspended",
            "name": "Suspended Rider",
            "phone": "+918877665544",
            "password": hash_password("riderpass123"),
            "status": "suspended"
        })
    asyncio.run(seed_riders())

    # 2. Test login success
    login_data = {"phone": "+919988776655", "password": "riderpass123"}
    resp = client_fixture.post("/api/rider/login", json=login_data)
    assert resp.status_code == 200
    login_res = resp.json()
    assert "token" in login_res
    assert login_res["rider_id"] == "rider-1"
    assert login_res["name"] == "Test Rider"
    assert login_res["current_order"] is None

    token = login_res["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Test login failure (wrong password)
    bad_login = {"phone": "+919988776655", "password": "wrongpassword"}
    resp = client_fixture.post("/api/rider/login", json=bad_login)
    assert resp.status_code == 401

    # 4. Test login suspended
    suspended_login = {"phone": "+918877665544", "password": "riderpass123"}
    resp = client_fixture.post("/api/rider/login", json=suspended_login)
    assert resp.status_code == 403
    assert "suspended" in resp.json()["detail"].lower()

    # 5. Test update location
    location_data = {"lat": 13.0827, "lng": 80.2707}
    resp = client_fixture.post("/api/rider/location", json=location_data, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Verify database update
    async def get_rider_from_db():
        return await db.riders.find_one({"id": "rider-1"})
    rider_db = asyncio.run(get_rider_from_db())
    assert rider_db["current_location"]["lat"] == 13.0827
    assert rider_db["current_location"]["lng"] == 80.2707

    # 6. Test push token registration
    push_data = {"token": "exponent-push-token-rider"}
    resp = client_fixture.post("/api/rider/push-token", json=push_data, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    
    rider_db = asyncio.run(get_rider_from_db())
    assert rider_db["push_token"] == "exponent-push-token-rider"

    # 7. Seed user and order to test order status transitions
    # First register a user
    reg_data = {
        "name": "Rider Order User",
        "email": "riderorderuser@example.com",
        "password": "Password123",
        "phone": "+919999999911"
    }
    resp = client_fixture.post("/api/auth/register", json=reg_data)
    assert resp.status_code == 200
    user_id = resp.json()["user"]["id"]

    import uuid
    from datetime import datetime
    order_id = str(uuid.uuid4())
    
    async def seed_order_and_assign():
        await db.orders.insert_one({
            "id": order_id,
            "user_id": user_id,
            "status": "confirmed",
            "delivery_address": "Rider Test Address",
            "assigned_rider_id": "rider-1",
            "tracking_updates": []
        })
        await db.riders.update_one({"id": "rider-1"}, {"$set": {"current_order_id": order_id}})
    asyncio.run(seed_order_and_assign())

    # Test get current order
    resp = client_fixture.get("/api/rider/current-order", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["order"] is not None
    assert resp.json()["order"]["id"] == order_id

    # Test status transition: reached_store (not mapped to order state)
    status_data = {"order_id": order_id, "status": "reached_store"}
    resp = client_fixture.post("/api/rider/order-status", json=status_data, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Test status transition: picked_up (mapped to picked_up order state)
    status_data = {"order_id": order_id, "status": "picked_up"}
    resp = client_fixture.post("/api/rider/order-status", json=status_data, headers=headers)
    assert resp.status_code == 200
    
    async def get_order_status():
        o = await db.orders.find_one({"id": order_id})
        return o["status"]
    assert asyncio.run(get_order_status()) == "picked_up"

    # Test status transition: delivered (resets rider active order)
    status_data = {"order_id": order_id, "status": "delivered"}
    resp = client_fixture.post("/api/rider/order-status", json=status_data, headers=headers)
    assert resp.status_code == 200

    assert asyncio.run(get_order_status()) == "delivered"
    rider_db = asyncio.run(get_rider_from_db())
    assert rider_db["current_order_id"] is None
    assert rider_db["status"] == "online"


def test_offer_price_normalization(client_fixture):
    """Task 18: clean_mongo_doc must expose offer_price for docs using legacy aliases.

    Contract (CONTRACTS.md §7): API reads always return 'offer_price'.
    Legacy aliases 'offerPrice' and 'original_price' must NOT appear in responses.
    Normalization is READ-ONLY — the DB document is never written back.
    """
    # Single-product path: prod-apple has original_price=120.0 (no offer_price field)
    resp = client_fixture.get("/api/products/prod-apple")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["offer_price"] == 120.0, (
        "GET /products/{id} must normalize original_price -> offer_price"
    )
    assert "original_price" not in data, "legacy alias must not leak into API response"
    assert "offerPrice" not in data, "legacy alias must not leak into API response"

    # List path must normalize consistently
    resp = client_fixture.get("/api/products")
    assert resp.status_code == 200
    products = {p["id"]: p for p in resp.json()["products"]}

    apple = products["prod-apple"]
    assert apple["offer_price"] == 120.0
    assert "original_price" not in apple
    assert "offerPrice" not in apple

    milk = products["prod-milk"]
    assert milk["offer_price"] == 55.0
    assert "original_price" not in milk


def test_image_url_normalization(client_fixture):
    """Task 18: clean_mongo_doc must map legacy 'image_url' -> 'image' on reads."""
    import asyncio

    # Insert a product with the legacy image_url field
    async def seed_legacy():
        await db.products.insert_one({
            "id": "prod-legacy-img",
            "name": "Legacy Image Product",
            "price": 10.0,
            "stock": 3,
            "unit": "1 pc",
            "category": "Test",
            "image_url": "https://example.com/legacy.jpg",
        })
    asyncio.run(seed_legacy())

    resp = client_fixture.get("/api/products/prod-legacy-img")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("image") == "https://example.com/legacy.jpg", (
        "image_url must be normalized to image on read"
    )
    assert "image_url" not in data, "legacy image_url must not appear in response"
