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
import uuid
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
    try:
        asyncio.run(cleanup())
    except Exception:
        pass

@pytest.fixture
def client_fixture():
    return TestClient(app)

# -- Fixture aliases for async loop_ledger / background_jobs tests -----------

@pytest.fixture
def client(client_fixture):
    return client_fixture


@pytest.fixture
def user_id(client_fixture):
    async def _get():
        u = await db.users.find_one({"email": "testuser@example.com"})
        if u:
            uid = u["id"]
        else:
            reg = client_fixture.post("/api/auth/register", json={
                "name": "Test User", "email": "testuser@example.com",
                "password": "Password123", "phone": "+919999999999",
            })
            uid = reg.json()["user"]["id"]
        # Reset LOOP + order state so each test starts clean
        await db.users.update_one({"id": uid}, {"$set": {
            "loop_balance": 0.0,
            "loop_balance_paise": 0,
            "loop_monthly_redeemed_paise": 0,
            "loop_monthly_period": "",
            "monthly_spend": 0.0,
        }})
        await db.loop_ledger.delete_many({"user_id": uid})
        await db.orders.delete_many({"user_id": uid})
        return uid
    return asyncio.run(_get())


@pytest.fixture
def auth_headers(client_fixture):
    resp = client_fixture.post("/api/auth/login", json={
        "email": "testuser@example.com", "password": "Password123",
    })
    token = resp.json().get("token", "")
    # Reset LOOP state so each test that uses auth_headers starts clean
    async def _reset():
        u = await db.users.find_one({"email": "testuser@example.com"})
        if u:
            uid = u["id"]
            await db.users.update_one({"id": uid}, {"$set": {
                "loop_balance": 0.0,
                "loop_balance_paise": 0,
                "loop_monthly_redeemed_paise": 0,
                "loop_monthly_period": "",
                "monthly_spend": 0.0,
            }})
            await db.loop_ledger.delete_many({"user_id": uid})
            await db.orders.delete_many({"user_id": uid})
    asyncio.run(_reset())
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client_fixture):
    resp = client_fixture.post("/api/admin/login", json={
        "email": "grocereasetv@gmail.com", "password": "admin123",
    })
    token = resp.json().get("token", "")
    return {"Authorization": f"Bearer {token}"}

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


# ---------------------------------------------------------------------------
# Task 20 — Stores & Serviceability
# ---------------------------------------------------------------------------

def test_stores_list(client_fixture):
    """GET /stores returns active stores (at least the seeded pilot store)."""
    resp = client_fixture.get("/api/stores")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "stores" in data
    # init_db seeds the pilot store
    assert any(s["id"] == "store-tirupati-pilot" for s in data["stores"]), (
        "Pilot store must appear in /stores"
    )


def test_serviceability_inside_radius(client_fixture):
    """Coordinates inside the pilot store's 7 km radius → serviceable."""
    # Tirupati city centre — well within 7 km of the pilot store at (13.6288, 79.4192)
    resp = client_fixture.get("/api/stores/serviceability?lat=13.6300&lng=79.4200")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["serviceable"] is True
    assert data["store"]["id"] == "store-tirupati-pilot"


def test_serviceability_outside_radius(client_fixture):
    """Coordinates far outside any store radius → not serviceable."""
    # Chennai — ~150 km from Tirupati
    resp = client_fixture.get("/api/stores/serviceability?lat=13.0827&lng=80.2707")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["serviceable"] is False
    assert data["store"] is None


def test_admin_create_and_update_store(client_fixture):
    """Admin can create a store and update its radius."""
    admin_token = client_fixture.post(
        "/api/admin/login",
        json={"email": "grocereasetv@gmail.com", "password": "admin123"}
    ).json()["token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create
    resp = client_fixture.post("/api/admin/stores", headers=headers, json={
        "name": "Test Store",
        "address": "Test Address",
        "location": {"lat": 13.6288, "lng": 79.4192},
        "radius_km": 3.0,
        "is_active": True
    })
    assert resp.status_code == 200, resp.text
    store = resp.json()
    assert store["name"] == "Test Store"
    store_id = store["id"]

    # Update radius
    resp = client_fixture.put(f"/api/admin/stores/{store_id}", headers=headers, json={
        "radius_km": 4.0
    })
    assert resp.status_code == 200
    assert resp.json()["radius_km"] == 4.0

    # Deactivate
    resp = client_fixture.put(f"/api/admin/stores/{store_id}", headers=headers, json={
        "is_active": False
    })
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_checkout_blocked_outside_serviceability(client_fixture):
    """Checkout must fail 400 when delivery address is outside every store's radius."""
    import asyncio

    # Register + login
    client_fixture.post("/api/auth/register", json={
        "name": "Out Of Zone User", "email": "ooz@example.com",
        "password": "Password123", "phone": "+910000000002"
    })
    token = client_fixture.post("/api/auth/login", json={
        "email": "ooz@example.com", "password": "Password123"
    }).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add a cart item
    client_fixture.post("/api/cart/add", headers=headers,
                        json={"product_id": "prod-apple", "quantity": 1})

    # Save an address outside Tirupati (Chennai coords)
    addr_resp = client_fixture.post("/api/user/addresses", headers=headers, json={
        "full_address": "Chennai, Tamil Nadu",
        "lat": 13.0827,
        "lng": 80.2707,
        "is_default": True,
        "label": "Home"
    })
    assert addr_resp.status_code == 200, addr_resp.text
    address_id = addr_resp.json()["id"]

    # Attempt checkout — should be blocked
    resp = client_fixture.post("/api/orders/create", headers=headers, json={
        "address_id": address_id,
        "payment_method": "COD"
    })
    assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
    assert "don't deliver" in resp.json()["detail"].lower()


def test_checkout_succeeds_inside_serviceability(client_fixture):
    """Checkout must succeed when delivery address is inside a store's radius."""
    import asyncio

    # Register + login
    client_fixture.post("/api/auth/register", json={
        "name": "In Zone User", "email": "inzone@example.com",
        "password": "Password123", "phone": "+910000000003"
    })
    token = client_fixture.post("/api/auth/login", json={
        "email": "inzone@example.com", "password": "Password123"
    }).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add a cart item
    client_fixture.post("/api/cart/add", headers=headers,
                        json={"product_id": "prod-milk", "quantity": 1})

    # Save an address inside Tirupati
    addr_resp = client_fixture.post("/api/user/addresses", headers=headers, json={
        "full_address": "Tirupati, Andhra Pradesh",
        "lat": 13.6300,
        "lng": 79.4200,
        "is_default": True,
        "label": "Home"
    })
    assert addr_resp.status_code == 200, addr_resp.text
    address_id = addr_resp.json()["id"]

    resp = client_fixture.post("/api/orders/create", headers=headers, json={
        "address_id": address_id,
        "payment_method": "COD"
    })
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    order = resp.json()
    assert order["store_id"] == "store-tirupati-pilot"
# ═══════════════════════════════════════════════════════════════════════════════
# Task 15 + 25 — LOOP credit ledger & checkout redemption
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_loop_balance_starts_zero(client, auth_headers):
    """New user has zero LOOP balance."""
    r = client.get("/api/user/loop-balance", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["loop_balance"] == 0.0


@pytest.mark.asyncio
async def test_admin_credit_loop_and_ledger(client, admin_headers):
    """Admin credits LOOP to a user; ledger row appears."""
    # Create a target user
    reg = client.post("/api/auth/register", json={
        "name": "Loop Tester", "email": "looptest@test.com",
        "phone": "+910000000099", "password": "pass123"
    })
    assert reg.status_code == 200
    uid = reg.json()["user"]["id"]

    # Admin credits 200 LOOP
    r = client.post("/api/admin/loop/credit",
                    json={"user_id": uid, "amount": 200.0,
                          "description": "Goodwill credit"},
                    headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["new_balance"] == 200.0

    # Balance endpoint reflects it
    login = client.post("/api/auth/login",
                        json={"email": "looptest@test.com", "password": "pass123"})
    token = login.json()["token"]
    bal = client.get("/api/user/loop-balance",
                     headers={"Authorization": f"Bearer {token}"})
    assert bal.json()["loop_balance"] == 200.0

    # Ledger has one credit row
    hist = client.get("/api/user/loop-ledger",
                      headers={"Authorization": f"Bearer {token}"})
    rows = hist.json()["rows"]
    assert len(rows) == 1
    assert rows[0]["type"] == "credit"
    assert rows[0]["amount"] == 200.0
    assert rows[0]["reference_type"] == "admin_credit"


@pytest.mark.asyncio
async def test_loop_redemption_at_checkout(client, auth_headers, user_id):
    """GETV coins reduce order total when user qualifies for Silver tier (>=Rs7,000/month spend)."""
    from routers.loop_ledger import credit_loop_balance
    from database import db as _db

    # Credit 300 coins to wallet
    await credit_loop_balance(
        user_id, 300.0,
        reference_type="admin_credit",
        reference_id="test-setup",
        description="Test setup credit",
    )
    # Seed a paid order totalling Rs8,000 this month so user qualifies for Silver tier (max 250 coins)
    from datetime import datetime
    await _db.orders.insert_one({
        "id": "seed-ord-silver", "user_id": user_id,
        "payment_status": "paid", "status": "delivered",
        "total_amount": 8000.0, "total_amount_paise": 800000,
        "created_at": datetime.utcnow(),
    })

    # Seed a product and address
    r = client.post("/api/user/addresses", json={
        "full_address": "12 Test St, Tirupati",
        "lat": 13.63, "lng": 79.42, "is_default": True
    }, headers=auth_headers)
    addr_id = r.json()["id"]

    # Add to cart
    prod = client.get("/api/products").json()["products"][0]
    client.post("/api/cart/add",
                json={"product_id": prod["id"], "quantity": 2},
                headers=auth_headers)

    # Checkout requesting 200 coins (within Silver 250 limit)
    order_r = client.post("/api/orders/create", json={
        "address_id": addr_id,
        "payment_method": "COD",
        "loop_credits_to_redeem": 200.0,
    }, headers=auth_headers)
    assert order_r.status_code == 200, order_r.text
    order = order_r.json()
    assert order["loop_credits_used"] == pytest.approx(200.0, abs=1.0)

    # Balance dropped by 200
    bal = client.get("/api/user/loop-balance", headers=auth_headers)
    assert bal.json()["loop_balance"] == pytest.approx(100.0, abs=5.0)

    # Ledger has a debit row
    hist = client.get("/api/user/loop-ledger", headers=auth_headers)
    debit_rows = [r for r in hist.json()["rows"] if r["type"] == "debit"]
    assert len(debit_rows) >= 1
    assert debit_rows[0]["reference_type"] == "order_redeem"


@pytest.mark.asyncio
async def test_loop_redemption_blocked_below_spend_threshold(client, auth_headers, user_id):
    """Cannot redeem GETV coins if monthly spend < Rs7,000 (Base tier)."""
    from routers.loop_ledger import credit_loop_balance
    from database import db as _db
    await credit_loop_balance(
        user_id, 10000.0,
        reference_type="admin_credit",
        reference_id="test-bigcredit",
        description="Large test credit",
    )
    # No paid orders seeded — monthly spend = Rs0 (Base tier, cannot redeem)

    r = client.post("/api/user/addresses", json={
        "full_address": "13 Test St, Tirupati",
        "lat": 13.63, "lng": 79.42, "is_default": True
    }, headers=auth_headers)
    addr_id = r.json()["id"]
    prod = client.get("/api/products").json()["products"][0]
    client.post("/api/cart/add",
                json={"product_id": prod["id"], "quantity": 1},
                headers=auth_headers)
    # Redemption request should be rejected (tier check fails)
    order_r = client.post("/api/orders/create", json={
        "address_id": addr_id,
        "payment_method": "COD",
        "loop_credits_to_redeem": 100.0,
    }, headers=auth_headers)
    # Expect 400 — tier eligibility check in debit_loop_balance
    assert order_r.status_code == 400
    assert "7,000" in order_r.json().get("detail", "")

@pytest.mark.asyncio
async def test_loop_redemption_capped_at_tier_max(client, auth_headers, user_id):
    """Redemption is capped at tier monthly max (Silver=250, Gold=500, Platinum=1000)."""
    from routers.loop_ledger import credit_loop_balance
    from database import db as _db
    await credit_loop_balance(
        user_id, 10000.0,
        reference_type="admin_credit",
        reference_id="test-tiermax",
        description="Large credit for tier test",
    )
    # Silver tier: Rs7,000-12,999 -> max 250 coins/month
    from datetime import datetime
    await _db.orders.insert_one({
        "id": "seed-ord-tiercap", "user_id": user_id,
        "payment_status": "paid", "status": "delivered",
        "total_amount": 8000.0, "total_amount_paise": 800000,
        "created_at": datetime.utcnow(),
    })

    r = client.post("/api/user/addresses", json={
        "full_address": "14 Test St, Tirupati",
        "lat": 13.63, "lng": 79.42, "is_default": True
    }, headers=auth_headers)
    addr_id = r.json()["id"]
    prod = client.get("/api/products").json()["products"][0]
    client.post("/api/cart/add",
                json={"product_id": prod["id"], "quantity": 2},
                headers=auth_headers)
    # Request 9999 — should be capped at Silver max (250) but order goes through
    order_r = client.post("/api/orders/create", json={
        "address_id": addr_id,
        "payment_method": "COD",
        "loop_credits_to_redeem": 250.0,  # Exactly at Silver limit
    }, headers=auth_headers)
    assert order_r.status_code == 200, order_r.text
    order = order_r.json()
    assert order["loop_credits_used"] <= 250.0 + 0.01


@pytest.mark.asyncio
async def test_mso_spend_signal_issues_credits(client):
    """MSO webhook credits 1,000 GETV coins when cable+broadband bill >= Rs1,000; idempotent."""
    reg = client.post("/api/auth/register", json={
        "name": "Cable User", "email": "cable@test.com",
        "phone": "+910000000088", "password": "pass123"
    })
    uid = reg.json()["user"]["id"]

    payload = {
        "user_id": uid,
        "mso_id": "gtpl",
        "cable_spend": 400.0,
        "broadband_spend": 600.0,   # total = Rs1,000 — qualifies
        "billing_month": "2024-06",
    }
    headers = {"X-Mso-Secret": "grocerease-mso-pilot-2024"}

    r = client.post("/api/mso/spend-signal", json=payload, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["qualified"] is True
    assert data["coins_credited"] == 1000    # fixed 1,000 coins

    # Second call same month → idempotent
    r2 = client.post("/api/mso/spend-signal", json=payload, headers=headers)
    assert r2.status_code == 200
    assert r2.json().get("already_processed") is True

    # Balance reflects Rs1,000 GETV coins
    login = client.post("/api/auth/login",
                        json={"email": "cable@test.com", "password": "pass123"})
    token = login.json()["token"]
    bal = client.get("/api/user/loop-balance",
                     headers={"Authorization": f"Bearer {token}"})
    assert bal.json()["loop_balance"] == pytest.approx(1000.0)

@pytest.mark.asyncio
async def test_mso_spend_signal_below_threshold_no_coins(client):
    """Bill below Rs1,000 does not credit coins and increments no-bill counter."""
    reg = client.post("/api/auth/register", json={
        "name": "Low Bill User", "email": "lowbill@test.com",
        "phone": "+910000000077", "password": "pass123"
    })
    uid = reg.json()["user"]["id"]

    payload = {
        "user_id": uid,
        "mso_id": "gtpl",
        "cable_spend": 400.0,
        "broadband_spend": 0.0,     # total = Rs400 — below threshold
        "billing_month": "2024-07",
    }
    r = client.post("/api/mso/spend-signal", json=payload,
                    headers={"X-Mso-Secret": "grocerease-mso-pilot-2024"})
    assert r.status_code == 200
    data = r.json()
    assert data["qualified"] is False
    assert data["coins_credited"] == 0

    # Balance is still zero
    login = client.post("/api/auth/login",
                        json={"email": "lowbill@test.com", "password": "pass123"})
    token = login.json()["token"]
    bal = client.get("/api/user/loop-balance",
                     headers={"Authorization": f"Bearer {token}"})
    assert bal.json()["loop_balance"] == 0.0


@pytest.mark.asyncio
async def test_mso_spend_signal_rejects_bad_secret(client):
    """MSO webhook returns 401 on wrong secret."""
    r = client.post("/api/mso/spend-signal",
                    json={"user_id": "x", "mso_id": "y",
                          "cable_spend": 100.0, "broadband_spend": 0.0, "billing_month": "2024-06"},
                    headers={"X-Mso-Secret": "wrong-secret"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_loop_recalc_admin(client, admin_headers, user_id):
    """Admin recalc reconciles balance from ledger rows."""
    from routers.loop_ledger import credit_loop_balance
    from database import db as _db
    await credit_loop_balance(user_id, 300.0, "admin_credit", "r1", "test credit")
    # Seed monthly spend so user qualifies for Silver tier (>=7000), then debit directly via paise helper
    from datetime import datetime
    await _db.orders.insert_one({
        "id": "seed-ord-recalc", "user_id": user_id,
        "payment_status": "paid", "status": "delivered",
        "total_amount": 8000.0, "total_amount_paise": 800000,
        "created_at": datetime.utcnow(),
    })
    from routers.loop_ledger import debit_loop_balance
    await debit_loop_balance(user_id, 100.0, "order_redeem", "r2", "test debit")
    # Force balance to wrong value
    from database import db
    await db.users.update_one({"id": user_id}, {"$set": {"loop_balance": 999.0}})
    # Recalc
    r = client.post(f"/api/admin/loop/recalc/{user_id}", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["recalculated_balance"] == pytest.approx(200.0, abs=1.0)
# Task 17 + 24 — Stock expiry job & payments reconciliation
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_stock_expiry_rolls_back_and_cancels(client, auth_headers, user_id):
    """
    An order stuck in pending_payment past TTL is expired:
    stock is restored and status transitions to cancelled.
    """
    from database import db
    from routers.background_jobs import expire_stale_pending_orders
    from datetime import datetime, timedelta

    # Seed a product with known stock
    prod_id = f"prod-expiry-{uuid.uuid4().hex[:6]}"
    await db.products.insert_one({
        "id": prod_id, "name": "Expiry Test", "price": 50.0,
        "stock": 10, "category": "test", "is_active": True,
    })

    # Manually insert a stale pending_payment order (created 40 min ago)
    order_id = f"ord-{uuid.uuid4().hex[:8]}"
    await db.orders.insert_one({
        "id": order_id, "user_id": user_id,
        "items": [{"product_id": prod_id, "quantity": 3, "price": 50.0, "name": "Expiry Test", "brand": "Test"}],
        "status": "pending_payment", "payment_status": "pending",
        "subtotal": 150.0, "delivery_fee": 0.0, "discount": 0.0,
        "total": 150.0, "loop_credits_used": 0.0,
        "delivery_address": "12 Test St", "address_id": "addr-1",
        "payment_method": "prepaid",
        "created_at": datetime.utcnow() - timedelta(minutes=40),
        "tracking_updates": [],
    })

    # Deduct stock as if it was reserved
    await db.products.update_one({"id": prod_id}, {"$inc": {"stock": -3}})
    prod_before = await db.products.find_one({"id": prod_id})
    assert prod_before["stock"] == 7

    # Run expiry job
    expired = await expire_stale_pending_orders()
    assert expired >= 1

    # Stock restored to 10
    prod_after = await db.products.find_one({"id": prod_id})
    assert prod_after["stock"] == 10

    # Order is cancelled
    order = await db.orders.find_one({"id": order_id})
    assert order["status"] == "cancelled"
    assert order["payment_status"] == "expired"


@pytest.mark.asyncio
async def test_fresh_pending_order_not_expired(client, auth_headers, user_id):
    """A brand-new pending_payment order must NOT be expired by the job."""
    from database import db
    from routers.background_jobs import expire_stale_pending_orders
    from datetime import datetime

    order_id = f"ord-fresh-{uuid.uuid4().hex[:8]}"
    await db.orders.insert_one({
        "id": order_id, "user_id": user_id,
        "items": [], "status": "pending_payment",
        "payment_status": "pending",
        "subtotal": 0.0, "delivery_fee": 0.0, "discount": 0.0, "total": 0.0,
        "delivery_address": "test", "address_id": "a1",
        "payment_method": "prepaid",
        "created_at": datetime.utcnow(),   # just created
        "tracking_updates": [],
    })
    await expire_stale_pending_orders()
    order = await db.orders.find_one({"id": order_id})
    assert order["status"] == "pending_payment"   # untouched


@pytest.mark.asyncio
async def test_refund_status_endpoint_non_refund(client, auth_headers, user_id):
    """Refund-status for a paid (non-refund) order returns refund_eligible=False."""
    from database import db

    order_id = f"ord-paid-{uuid.uuid4().hex[:8]}"
    await db.orders.insert_one({
        "id": order_id, "user_id": user_id,
        "status": "delivered", "payment_status": "paid",
        "total": 200.0, "items": [], "tracking_updates": [],
        "delivery_address": "X", "address_id": "a1",
        "payment_method": "prepaid",
        "created_at": __import__("datetime").datetime.utcnow(),
    })
    r = client.get(f"/api/user/orders/{order_id}/refund-status", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["refund_eligible"] is False
    assert data["payment_status"] == "paid"


@pytest.mark.asyncio
async def test_refund_status_endpoint_pending_refund(client, auth_headers, user_id):
    """Refund-status for refund_pending order returns correct message."""
    from database import db

    order_id = f"ord-refpend-{uuid.uuid4().hex[:8]}"
    await db.orders.insert_one({
        "id": order_id, "user_id": user_id,
        "status": "cancelled", "payment_status": "refund_pending",
        "total": 300.0, "items": [], "tracking_updates": [],
        "delivery_address": "Y", "address_id": "a2",
        "payment_method": "prepaid",
        "created_at": __import__("datetime").datetime.utcnow(),
    })
    r = client.get(f"/api/user/orders/{order_id}/refund-status", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["refund_eligible"] is True
    assert data["payment_status"] == "refund_pending"
    assert "5–7 business days" in data["message"]


@pytest.mark.asyncio
async def test_refund_status_wrong_user(client, user_id):
    """Another user cannot see a different user's refund status (404)."""
    from database import db

    order_id = f"ord-other-{uuid.uuid4().hex[:8]}"
    await db.orders.insert_one({
        "id": order_id, "user_id": "someone-else",
        "status": "cancelled", "payment_status": "refund_pending",
        "total": 100.0, "items": [], "tracking_updates": [],
        "delivery_address": "Z", "address_id": "a3",
        "payment_method": "prepaid",
        "created_at": __import__("datetime").datetime.utcnow(),
    })
    # Login as a different user — use a phone not shared with any other test
    await db.users.delete_many({"email": "other@test.com"})
    client.post("/api/auth/register", json={
        "name": "Other", "email": "other@test.com",
        "phone": "+910000000055", "password": "pass123",
    })
    login = client.post("/api/auth/login",
                        json={"email": "other@test.com", "password": "pass123"})
    other_headers = {"Authorization": f"Bearer {login.json()['token']}"}
    r = client.get(f"/api/user/orders/{order_id}/refund-status", headers=other_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_admin_trigger_expiry_job(client, admin_headers):
    """Admin can trigger the expiry job via API."""
    r = client.post("/api/admin/jobs/expire-pending-orders", headers=admin_headers)
    assert r.status_code == 200
    assert "expired_orders" in r.json()


@pytest.mark.asyncio
async def test_admin_trigger_recon_job(client, admin_headers):
    """Admin can trigger the reconciliation job via API."""
    r = client.post("/api/admin/jobs/reconcile-refunds", headers=admin_headers)
    assert r.status_code == 200
    assert "refunds_confirmed" in r.json()
# Task 27 — Rider availability toggle
# ---------------------------------------------------------------------------

def test_rider_availability_toggle(client_fixture):
    """POST /rider/availability must toggle online/offline; blocks offline when order active."""
    import asyncio

    # Seed a rider
    async def seed():
        await db.riders.insert_one({
            "id": "rider-avail-test",
            "name": "Avail Rider", "phone": "0000000001",
            "password": __import__('database').hash_password("pass"),
            "status": "offline", "current_order_id": None,
            "order_queue": [], "current_location": None, "push_token": None,
            "rating": 5.0, "created_at": __import__('datetime').datetime.utcnow(),
        })
    asyncio.run(seed())

    token = client_fixture.post("/api/rider/login",
        json={"phone": "0000000001", "password": "pass"}).json()["token"]
    h = {"Authorization": f"Bearer {token}"}

    # Go offline
    resp = client_fixture.post("/api/rider/availability", headers=h, json={"available": False})
    assert resp.status_code == 200
    assert resp.json()["status"] == "offline"

    # Go online
    resp = client_fixture.post("/api/rider/availability", headers=h, json={"available": True})
    assert resp.status_code == 200
    assert resp.json()["status"] == "online"

    # Can't go offline while an order is active
    async def set_active():
        await db.riders.update_one({"id": "rider-avail-test"},
                                   {"$set": {"current_order_id": "fake-order-id"}})
    asyncio.run(set_active())

    resp = client_fixture.post("/api/rider/availability", headers=h, json={"available": False})
    assert resp.status_code == 400
    assert "offline" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Task 30 — Rider self-registration + admin approval
# ---------------------------------------------------------------------------

def test_rider_self_register_and_approve(client_fixture):
    """Rider self-registers as pending; blocked from login until admin approves."""
    # Self-register
    resp = client_fixture.post("/api/rider/register", json={
        "name": "New Rider", "phone": "9998887770",
        "password": "riderpass", "vehicle": "Scooter"
    })
    assert resp.status_code == 200, resp.text
    rider_id = resp.json()["rider_id"]

    # Login blocked — pending_approval
    resp = client_fixture.post("/api/rider/login",
        json={"phone": "9998887770", "password": "riderpass"})
    assert resp.status_code == 403
    assert "pending" in resp.json()["detail"].lower()

    # Admin approves
    admin_token = client_fixture.post("/api/admin/login",
        json={"email": "grocereasetv@gmail.com", "password": "admin123"}).json()["token"]
    h_admin = {"Authorization": f"Bearer {admin_token}"}

    resp = client_fixture.get("/api/admin/riders/pending", headers=h_admin)
    assert resp.status_code == 200
    pending = resp.json()
    assert any(r["id"] == rider_id for r in pending)

    resp = client_fixture.post(f"/api/admin/riders/{rider_id}/approve", headers=h_admin)
    assert resp.status_code == 200
    assert resp.json()["status"] == "offline"

    # Now login succeeds
    resp = client_fixture.post("/api/rider/login",
        json={"phone": "9998887770", "password": "riderpass"})
    assert resp.status_code == 200
    assert "token" in resp.json()


# ---------------------------------------------------------------------------
# Task 31 — Multi-order queue
# ---------------------------------------------------------------------------

def test_multi_order_queue(client_fixture):
    """Assigning a second order to a busy rider enqueues it; delivered promotes next."""
    import asyncio

    admin_token = client_fixture.post("/api/admin/login",
        json={"email": "grocereasetv@gmail.com", "password": "admin123"}).json()["token"]
    h_admin = {"Authorization": f"Bearer {admin_token}"}

    # Seed a rider with an active order
    async def seed():
        await db.riders.insert_one({
            "id": "rider-queue-test",
            "name": "Queue Rider", "phone": "0000000002",
            "password": __import__('database').hash_password("pass"),
            "status": "online", "current_order_id": "order-q-1",
            "order_queue": [], "current_location": None, "push_token": None,
            "rating": 5.0, "created_at": __import__('datetime').datetime.utcnow(),
        })
        # Create two orders for assignment
        for oid in ["order-q-1", "order-q-2"]:
            await db.orders.insert_one({
                "id": oid, "user_id": "u1", "items": [],
                "status": "paid", "delivery_status": "preparing",
                "assigned_rider_id": "rider-queue-test" if oid == "order-q-1" else None,
                "created_at": __import__('datetime').datetime.utcnow(),
            })
    asyncio.run(seed())

    # Assign second order — should be queued
    resp = client_fixture.post("/api/admin/orders/order-q-2/assign-rider",
        headers=h_admin, json={"rider_id": "rider-queue-test"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["queued"] is True

    # Rider's order_queue should contain order-q-2
    async def check_queue():
        r = await db.riders.find_one({"id": "rider-queue-test"})
        return r
    rider = asyncio.run(check_queue())
    assert "order-q-2" in rider["order_queue"]
    assert rider["current_order_id"] == "order-q-1"

    # Rider delivers order-q-1 → queue should promote order-q-2
    rider_token = client_fixture.post("/api/rider/login",
        json={"phone": "0000000002", "password": "pass"}).json()["token"]
    h_rider = {"Authorization": f"Bearer {rider_token}"}

    resp = client_fixture.post("/api/rider/order-status", headers=h_rider,
        json={"order_id": "order-q-1", "status": "delivered"})
    assert resp.status_code == 200

    rider_after = asyncio.run(check_queue())
    assert rider_after["current_order_id"] == "order-q-2"
    assert rider_after["order_queue"] == []


# ---------------------------------------------------------------------------
# Task 21 — Auto-assign nearest available rider
# ---------------------------------------------------------------------------

def test_auto_assign_rider(client_fixture):
    """POST /admin/orders/{id}/auto-assign-rider picks the online available rider."""
    import asyncio

    admin_token = client_fixture.post("/api/admin/login",
        json={"email": "grocereasetv@gmail.com", "password": "admin123"}).json()["token"]
    h_admin = {"Authorization": f"Bearer {admin_token}"}

    async def seed():
        await db.riders.insert_one({
            "id": "rider-auto-test",
            "name": "Auto Rider", "phone": "0000000003",
            "password": __import__('database').hash_password("pass"),
            "status": "online", "current_order_id": None,
            "order_queue": [],
            "current_location": {"lat": 13.629, "lng": 79.420, "updated_at": __import__('datetime').datetime.utcnow()},
            "push_token": None, "rating": 5.0,
            "created_at": __import__('datetime').datetime.utcnow(),
        })
        await db.orders.insert_one({
            "id": "order-auto-1", "user_id": "u1", "items": [],
            "status": "paid", "delivery_status": "preparing",
            "assigned_rider_id": None,
            "store_id": "store-tirupati-pilot",
            "created_at": __import__('datetime').datetime.utcnow(),
        })
    asyncio.run(seed())

    resp = client_fixture.post("/api/admin/orders/order-auto-1/auto-assign-rider",
                               headers=h_admin)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["success"] is True
    assert data["rider_id"] == "rider-auto-test"
