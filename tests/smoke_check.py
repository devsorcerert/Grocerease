"""
Smoke test — exercises the four flows requested:
  1. POST /api/auth/send-otp  (dev-mode console OTP)
  2. POST /api/auth/verify-otp
  3. POST /api/orders/create  (create an order)
  4. POST /api/orders/admin/{id}/assign-rider
  5. GET  /api/orders/{id}/tracking  (current_location field)

Uses mongomock_motor so no live MongoDB is required.
"""
import os, sys, asyncio, re, io, uuid
os.environ.setdefault("DB_NAME", "grocerease_smoke")
os.environ.setdefault("JWT_SECRET_KEY", "smoketestsecretkeyatleast32charslong!")
os.environ.setdefault("ADMIN_EMAIL", "grocereasetv@gmail.com")
os.environ.setdefault("ADMIN_PASSWORD", "TestAdmin123!")
os.environ.setdefault("RAZORPAY_KEY_ID", "rzp_test_dummy")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "dummysecret")
os.environ.setdefault("DEBUG", "true")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# ── Patch motor with mongomock_motor before any app import ──────────────────
import mongomock_motor, motor.motor_asyncio
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient  # type: ignore

import database as _db_module
_mock_client = mongomock_motor.AsyncMongoMockClient()
_db_module.client = _mock_client
_db_module.db = _mock_client[os.environ["DB_NAME"]]

# Patch razorpay so it doesn't need real keys
import unittest.mock as mock
sys.modules["razorpay"] = mock.MagicMock()

from fastapi.testclient import TestClient
from server import app

client = TestClient(app, raise_server_exceptions=False)

PASS = []
FAIL = []

def check(label, resp, expected_status=200, check_body=None):
    ok = resp.status_code == expected_status
    if ok and check_body:
        ok = check_body(resp.json())
    status = "PASS" if ok else "FAIL"
    body_preview = str(resp.json())[:200] if resp.content else "(empty)"
    print(f"[{status}] {label} — HTTP {resp.status_code}  {body_preview}")
    (PASS if ok else FAIL).append(label)
    return resp.json() if ok else None

# ── Seed: create a product and a rider directly in the mock DB ───────────────
async def seed():
    prod_id = str(uuid.uuid4())
    await _db_module.db.products.insert_one({
        "id": prod_id, "name": "Apple", "category": "Fruits",
        "price": 50.0, "offer_price": None, "stock": 100,
        "unit": "kg", "description": "", "image": "", "is_active": True
    })
    rider_id = str(uuid.uuid4())
    from database import hash_password
    await _db_module.db.riders.insert_one({
        "id": rider_id, "name": "Test Rider", "phone": "+919876543210",
        "password": hash_password("rider123"), "status": "online",
        "push_token": None, "current_order_id": None, "current_location": None
    })
    return prod_id, rider_id

prod_id, rider_id = asyncio.get_event_loop().run_until_complete(seed())

# ── 1. Admin login ────────────────────────────────────────────────────────────
print("\n── Admin login ──")
# Seed admin directly (init_database needs a real Mongo index; mock it)
async def seed_admin():
    from database import hash_password
    await _db_module.db.admins.insert_one({
        "id": "default-admin-id",
        "email": "grocereasetv@gmail.com",
        "password": hash_password("TestAdmin123!"),
        "role": "super-admin", "name": "Super Admin"
    })
asyncio.get_event_loop().run_until_complete(seed_admin())

r = client.post("/api/admin/login", json={"email": "grocereasetv@gmail.com", "password": "TestAdmin123!"})
result = check("Admin login", r, 200, lambda b: "token" in b)
admin_token = result["token"] if result else None
admin_headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}

# ── 2. Customer register ──────────────────────────────────────────────────────
print("\n── Customer register ──")
r = client.post("/api/auth/register", json={
    "name": "Smoke User", "email": "smoke@test.com",
    "password": "Pass1234!", "phone": "+919000000001"
})
result = check("Customer register", r, 200, lambda b: "token" in b)
user_token = result["token"] if result else None
user_headers = {"Authorization": f"Bearer {user_token}"} if user_token else {}

# ── 3. send-otp (dev-mode: OTP printed to console) ────────────────────────────
print("\n── OTP flow ──")
import io, contextlib
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    r = client.post("/api/auth/send-otp", json={"phone": "+919111111111"})
console_out = buf.getvalue()
check("send-otp returns 200", r, 200)

# Extract OTP from console output
otp_match = re.search(r"OTP for \+919111111111: (\d{6})", console_out)
otp = otp_match.group(1) if otp_match else None
if otp:
    print(f"         OTP captured from console: {otp}")
    PASS.append("OTP printed to console (dev-mode)")
else:
    print(f"[FAIL]   OTP not found in console output: {console_out!r}")
    FAIL.append("OTP printed to console (dev-mode)")

# ── 4. verify-otp ─────────────────────────────────────────────────────────────
if otp:
    r = client.post("/api/auth/verify-otp", json={
        "phone": "+919111111111", "otp": otp, "name": "OTP User"
    })
    result = check("verify-otp → JWT issued", r, 200, lambda b: "token" in b)
else:
    FAIL.append("verify-otp (skipped — no OTP)")
    print("[FAIL]   verify-otp skipped")

# ── 5. Create order ───────────────────────────────────────────────────────────
print("\n── Create order ──")
# Seed: add product to cart + address for the registered user
user_id_for_order = None
async def get_user_id():
    u = await _db_module.db.users.find_one({"email": "smoke@test.com"})
    return u["id"] if u else None
user_id_for_order = asyncio.get_event_loop().run_until_complete(get_user_id())

addr_id = str(uuid.uuid4())
async def seed_cart_and_address():
    await _db_module.db.addresses.insert_one({
        "id": addr_id, "user_id": user_id_for_order,
        "label": "Home", "full_address": "123 Test Street, Tirupati 517501",
        "city": "Tirupati", "pincode": "517501", "is_default": True
    })
    await _db_module.db.cart_items.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id_for_order,
        "product_id": prod_id, "quantity": 2
    })
asyncio.get_event_loop().run_until_complete(seed_cart_and_address())

r = client.post("/api/orders/create", json={
    "address_id": addr_id,
    "payment_method": "COD"
}, headers=user_headers)
result = check("Create COD order", r, 200, lambda b: "id" in b or "order_id" in b)
order_id = None
if result:
    order_id = result.get("id") or result.get("order_id")
    print(f"         order_id: {order_id}")

# ── 6. assign-rider ───────────────────────────────────────────────────────────
print("\n── Assign rider ──")
if order_id and admin_token:
    r = client.post(
        f"/api/orders/admin/{order_id}/assign-rider",
        json={"rider_id": rider_id},
        headers=admin_headers
    )
    check("assign-rider sets fields", r, 200, lambda b: b.get("success") is True)

    # Confirm DB state
    async def check_db():
        order = await _db_module.db.orders.find_one({"id": order_id})
        rider = await _db_module.db.riders.find_one({"id": rider_id})
        return order.get("assigned_rider_id"), rider.get("current_order_id")
    arid, cord = asyncio.get_event_loop().run_until_complete(check_db())
    ok = arid == rider_id and cord == order_id
    label = "DB: assigned_rider_id + current_order_id set"
    print(f"[{'PASS' if ok else 'FAIL'}]   {label}  assigned_rider_id={arid}  current_order_id={cord}")
    (PASS if ok else FAIL).append(label)
else:
    FAIL.append("assign-rider (skipped — missing order_id or admin_token)")

# ── 7. Rider pushes location ───────────────────────────────────────────────────
print("\n── Rider location ──")
r = client.post("/api/rider/login", json={"phone": "+919876543210", "password": "rider123"})
result = check("Rider login", r, 200, lambda b: "token" in b)
rider_token = result["token"] if result else None
rider_headers = {"Authorization": f"Bearer {rider_token}"} if rider_token else {}

if rider_token:
    r = client.post("/api/rider/location",
                    json={"lat": 13.6288, "lng": 79.4192},
                    headers=rider_headers)
    check("Rider POST /location → 200", r, 200, lambda b: b.get("success") is True)

    async def check_location():
        rider = await _db_module.db.riders.find_one({"id": rider_id})
        return rider.get("current_location")
    loc = asyncio.get_event_loop().run_until_complete(check_location())
    ok = (loc is not None and loc.get("lat") == 13.6288
          and loc.get("lng") == 79.4192 and "updated_at" in loc)
    label = "DB: current_location {lat,lng,updated_at} stored"
    print(f"[{'PASS' if ok else 'FAIL'}]   {label}  loc={loc}")
    (PASS if ok else FAIL).append(label)

# ── 8. Order tracking — current_location + gps_tracking_enabled ──────────────
print("\n── Order tracking ──")
if order_id and rider_token:
    # Advance order to out_for_delivery so tracking returns delivery_partner
    async def advance():
        from routers.orders import transition_order_status
        await transition_order_status(order_id, "paid", "admin")
        await transition_order_status(order_id, "out_for_delivery", "admin")
    asyncio.get_event_loop().run_until_complete(advance())

    r = client.get(f"/api/orders/{order_id}/tracking", headers=user_headers)
    body = r.json()
    check("GET /tracking → 200", r, 200)

    dp = body.get("delivery_partner") or {}
    cl = dp.get("current_location")
    gps = body.get("gps_tracking_enabled")

    ok_loc = cl is not None and cl.get("lat") == 13.6288
    ok_gps = gps is True
    ok_no_fake = not (cl and "latitude" in cl)   # no hash-derived keys

    for label, ok, detail in [
        ("tracking: current_location.lat present", ok_loc, str(cl)),
        ("tracking: gps_tracking_enabled=True (rider has location)", ok_gps, f"gps={gps}"),
        ("tracking: no fake latitude/longitude keys", ok_no_fake, str(cl)),
    ]:
        print(f"[{'PASS' if ok else 'FAIL'}]   {label}  {detail}")
        (PASS if ok else FAIL).append(label)

# ── Summary ────────────────────────────────────────────────────────────────────
print(f"\n{'='*55}")
print(f"  PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
print(f"{'='*55}")
if FAIL:
    print("FAILED checks:")
    for f in FAIL: print(f"  ✗ {f}")
sys.exit(1 if FAIL else 0)
