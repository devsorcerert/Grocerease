# AUDIT_Grocerease.md

> **Auditor:** Claude Code (read-only, no code changes)
> **Date:** 2026-06-28
> **Scope:** Full repository — every source file read line by line
> **Purpose:** Pre-pilot security + architecture audit for Tirupati quick-commerce launch

---

## 0. Repository at a Glance

| Dimension | Detail |
|---|---|
| **Stack** | FastAPI (Python) + React Native (Expo) + React Web (admin) + MongoDB (Motor) + Redis |
| **Deployment** | Render free tier (backend), Docker Compose (local), EAS (mobile builds) |
| **Backend lines** | ≈ 4,700 across 11 Python files |
| **Frontend lines** | ≈ 5,000 across 60+ TypeScript/JavaScript files |
| **CONTRACTS.md** | FROZEN 2026-06-21 (Task 45) — 347 lines, single source of truth |

---

## 1. Real Data Flow

```
Customer App (Expo/RN)
  │ SecureStore (tokens)    ← Expo SecureStore (correct)
  │ Zustand (cartStore)     ← in-memory only, lost on restart
  │ AuthContext.tsx         ← 14-min timer → POST /auth/refresh
  │
  ↓ axios (utils/api.ts)  Authorization: Bearer <access_token>
  │
Backend (FastAPI, port 8001)
  │ Middleware: CORS, UTF-8 charset
  │ Dependency: rate_limit (Redis → in-memory fallback)  30 req/min per IP
  │ Dependency: get_current_user → JWT decode → blacklist check → user_id
  │ Dependency: verify_admin   → JWT decode → is_admin+role check → blacklist check
  │
  ├─ server.py        (auth, products, cart, coupons, videos, notifications, cable-TV)
  ├─ routers/orders.py        (checkout, state machine, rider assignment)
  ├─ routers/payments.py      (Razorpay create/verify/webhook, refund)
  ├─ routers/riders.py        (rider auth, location, order status, earnings)
  ├─ routers/loop_ledger.py   (GETV coins, MSO webhook)
  ├─ routers/stores.py        (Haversine serviceability)
  ├─ routers/background_jobs.py (stock expiry + refund recon async loops)
  ├─ routers/kpis.py          (admin dashboard aggregations)
  ├─ routers/admin_riders.py  (rider CRUD + approve/suspend)
  │
  ↓
MongoDB (Motor async)
  Collections: users, orders, cart_items, products, addresses, riders,
               stores, loop_ledger, notifications, payments, refunds,
               coupons, videos, wishlists, blacklisted_tokens, otps,
               admins, stb_numbers, offers, brand_banners, support_messages
  │
  ├─ Razorpay API (payments)
  ├─ Expo Push API (push notifications)
  ├─ Fast2SMS / Twilio (OTP SMS — dev: console-printed)
  ├─ Google ID Token verification (google-auth library, server-side)
  └─ YouTube RSS (video feed)

Admin Portal (React, port 3001)
  localStorage (tokens) ← XSS risk
  axios → /api (nginx reverse-proxy)
```

---

## 2. File-by-File Purpose & Completeness

| File | Purpose | Status |
|---|---|---|
| `backend/server.py` | Core FastAPI app: auth, products, admin, cable-TV, videos | Complete — 1,979 lines |
| `backend/database.py` | DB connection, auth helpers, rate-limit, OTP, SMS, push | Complete — 330 lines |
| `backend/models.py` | Pydantic request models | Complete — 152 lines |
| `backend/init_db.py` | DB migration: indexes + seed pilot store | Complete — 127 lines |
| `backend/routers/orders.py` | Order state machine, checkout, rider assignment | Complete — 706 lines |
| `backend/routers/payments.py` | Razorpay create/verify/webhook, refund | Complete — 297 lines |
| `backend/routers/riders.py` | Rider auth, location, status, earnings, queue | Complete — 334 lines |
| `backend/routers/loop_ledger.py` | GETV coins: earn/debit/tier/MSO webhook | Complete — 533 lines |
| `backend/routers/stores.py` | Dark-store management, Haversine serviceability | Complete — 148 lines |
| `backend/routers/background_jobs.py` | Stock expiry + refund recon async loops | Complete — 243 lines |
| `backend/routers/kpis.py` | Admin KPI aggregations | Partial stub — many KPIs hardcoded "insufficient data" |
| `backend/routers/admin_riders.py` | Admin rider CRUD, approve/suspend/reactivate | Complete — 125 lines |
| `backend/routers/cart.py` | Cart CRUD, bulk add for TV integration | Complete |
| `admin-portal/src/services/auth.js` | Admin portal login/logout, localStorage | **Incomplete** — logout doesn't blacklist token |
| `admin-portal/src/services/api.js` | Axios instance with auth interceptor | Complete — XSS risk noted inline |
| `frontend/context/AuthContext.tsx` | Token management, refresh timer, Google Sign-In | Complete — 413 lines |
| `frontend/constants/api.ts` | API URLs, OAuth client IDs, admin email | Complete |
| `CONTRACTS.md` | FROZEN API contract | Complete — 347 lines |
| `GETV_Coins_Rewards_Logic.md` | Coin mechanics documentation | Complete |
| `backend/routers/loop_ledger.py:74` | MSO shared secret | **Stub** — hardcoded |
| `server.py:551-576` (verify_cable_tv_details) | Real cable TV API integration | **Dead stub** — never called |
| `server.py:1041-1089` (brand-banners) | FMCG brand banners | **Stub** — static mock data, expired dates |

---

## 3. WHAT WORKS ✅

1. **JWT Auth stack** — register, login, Google Sign-In (server-side ID token verification), OTP, refresh token rotation with blacklist, logout (both tokens blacklisted), admin login, rider login (12-h no-refresh).
2. **Token blacklist** — `db.blacklisted_tokens` with MongoDB TTL index; checked in `get_current_user` and `verify_admin`.
3. **Rate limiting** — Redis-backed (30 req/min per IP), in-memory fallback for dev; applied to auth routes.
4. **Order state machine** — `transition_order_status` covers all canonical statuses from CONTRACTS §3a including `reached_store` (Task 46 fix).
5. **Atomic stock reservation** — `try_reserve_stock` with compensating rollback; `find_one_and_update` with `stock: {$gte: quantity}`.
6. **LOOP/GETV ledger** — tier calculation, debit validation (tier/monthly-limit), credit, MSO webhook (idempotent), gadget eligibility, auto-suspend logic.
7. **Rider assignment (Task 5)** — manual assign respects `MAX_QUEUE_SIZE=3`; multi-order queue (Task 31) promotes on delivered.
8. **Auto-assign (Task 21)** — Haversine nearest-online-with-capacity; fallback to lowest-load.
9. **Rider location** — canonical `{lat, lng, updated_at}` stored under `riders.current_location` (Task 4 / CONTRACTS §4 seam).
10. **GPS tracking** — `gps_tracking_enabled = True` only when `current_location` is not None (not hardcoded).
11. **Serviceability check (Task 20)** — pure-Python Haversine; fail-open for addresses without coordinates.
12. **Background jobs** — stock-expiry (30-min TTL configurable) and refund-recon loops via `asyncio.create_task`.
13. **Razorpay integration** — create order, signature verification, webhook with HMAC validation, mock bypass in dev only.
14. **CORS** — requires `ALLOWED_ORIGINS` in production; panics if missing.
15. **Rider availability toggle (Task 27)** — cannot go offline with active order.
16. **Rider self-register + admin approval (Task 30)** — `pending_approval` gate.
17. **Admin portal** — login, KPI dashboard, product CRUD, Excel bulk upload.
18. **Google OAuth audience validation** — validates against all 6 known client IDs for Firebase project.
19. **BUG-05 fix** — UTF-8 charset middleware for rupee symbols on Android.
20. **BUG-12 fix** — `GET /auth/me` checks `db.users` first, then `db.admins`.

---

## 4. WHAT EXISTS BUT IS BROKEN OR INCOMPLETE ⚠️

### 4.1 Critical Bugs (data/logic breakage)

**B-1 · `_get_monthly_spend_paise` always returns 0**
`backend/routers/loop_ledger.py:122` — aggregation uses field `$total_amount_paise`:
```python
{"$group": {"_id": None, "total": {"$sum": "$total_amount_paise"}}},
```
Orders store `total` (rupees), not `total_amount_paise`. Fallback at line 135 uses `$total_amount` — also absent. Correct field is `$total`.
**Impact:** GETV tier is always "Base" → redemption always fails at checkout. Gadget eligibility at `loop_ledger.py:320` also uses `"$sum": "$total_amount"` (should be `"$sum": "$total"`).

**B-2 · `create_order_core` reads `price` from raw product doc**
`backend/routers/orders.py:177`:
```python
item_price = product.get("price", 0.0)
```
Products created via the canonical API store `price_paise` (int, paise). The `price` (rupees) field is added by `clean_mongo_doc` on reads but never persisted to MongoDB. A raw `find_one` will find no `price` key → `item_price = 0.0` → every order total = ₹0.
**Fix needed:** `product.get("price_paise", 0) / 100` or `clean_mongo_doc(product).get("price", 0)`.

**B-3 · `delete_account` clears wrong collection**
`backend/server.py:1423`:
```python
await db.carts.delete_many({"user_id": user_id})
```
Cart items live in `db.cart_items`, not `db.cart`. The cart is not cleaned on account deletion.

**B-4 · `clean_mongo_doc` contradicts CONTRACTS §7 on `image_url`**
`backend/database.py:142-145`:
```python
if "image_url" in doc and "image" not in doc:
    doc["image"] = doc.pop("image_url")
```
CONTRACTS.md §7: *"API reads always return `image_url` (not `image`)"* and *"Do not use the variant `image`"*. The cleaner does the opposite — it renames `image_url` → `image` on every API read. Every product response from `GET /products` returns `image` instead of `image_url`, breaking the contract.

**B-5 · Checkout price filter queries non-existent `price` field**
`backend/server.py:658-663`:
```python
query["price"] = {}
if min_price is not None:
    query["price"]["$gte"] = min_price
```
Products are stored with `price_paise` in paise, not `price`. The `price` field in MongoDB is absent unless the document was created via the legacy path. Price-range filtering is silently broken for all API-created products.

**B-6 · `admin_create_product` (via dict) bypasses canonical schema**
`backend/server.py:1205-1212` — `POST /admin/products` accepts raw `dict`, no Pydantic validation. An admin can store any field names (e.g., `price` in rupees, `image`), silently deviating from CONTRACTS §7 canonical fields.

**B-7 · `admin_riders.py:create_rider` missing `order_queue`**
`backend/routers/admin_riders.py:24-38` — Admin-seeded riders have no `order_queue` field. All queue-related code falls back to `r.get("order_queue", [])`, which is safe, but the document is inconsistent with self-registered riders which always get `"order_queue": []`.

**B-8 · `logger` used before definition**
`backend/server.py:227,1127-1131` — `logger = logging.getLogger(__name__)` is at line 1974 (bottom of file). The `logout` handler at line 227 and the dev admin-bootstrap block at line 1127 use `logger` before it is assigned. At module load time in CPython this works because the function bodies are not executed yet — but if `logger.info(...)` at line 1127 is reached during the module-level `if`-block execution (it is, because it runs at import time), this will raise `NameError: name 'logger' is not defined`. The `logging.basicConfig` call at line 1973 also runs after the logger reference.

**B-9 · `riders.py` login forces status to "online" on every login**
`backend/routers/riders.py:136-139`:
```python
await db.riders.update_one(
    {"id": rider["id"]},
    {"$set": {"last_seen": datetime.utcnow(), "status": "online"}}
)
```
A rider who logs in to check earnings (or after a session timeout) is immediately set online, regardless of their intended availability. A rider has no way to log in and stay offline.

### 4.2 Security Issues

**S-1 · Hardcoded MSO shared secret**
`backend/routers/loop_ledger.py:74`:
```python
MSO_SHARED_SECRET = "grocerease-mso-pilot-2024"
```
Committed to source control. The MSO webhook (`POST /mso/spend-signal`) that credits ₹1,000 GETV coins is protected only by this known string. **Must** be moved to `os.environ.get("MSO_SHARED_SECRET")` with a `FATAL` guard.

**S-2 · Admin portal JWT in localStorage (XSS)**
`admin-portal/src/services/auth.js:6,9` and `api.js:19`:
```javascript
localStorage.setItem('admin_token', response.data.token);
```
Any XSS vulnerability in the admin portal (including third-party libraries) can steal the token. The code acknowledges this at `api.js:15–17` but is unresolved.

**S-3 · Admin portal logout does not blacklist token**
`admin-portal/src/services/auth.js:14-17` — logout only removes the token from `localStorage`; it never calls `POST /api/auth/logout`. A stolen token remains valid for 30 minutes (access) or 30 days (refresh).

**S-4 · Razorpay webhook unauthenticated in dev**
`backend/routers/payments.py:142`:
```python
if RAZORPAY_WEBHOOK_SECRET:
    # … verify …
```
If `RAZORPAY_WEBHOOK_SECRET` is unset (omitted from `.env`), the entire verification block is skipped and any POST to `/payments/razorpay/webhook` can mark arbitrary orders as paid. Acceptable only if dev has no network exposure; risky on Render free tier which is publicly reachable.

**S-5 · Plaintext password comparison for admin**
`backend/server.py:1153`:
```python
if ADMIN_PASSWORD_RAW and login_data.password == ADMIN_PASSWORD_RAW:
```
Direct string equality is susceptible to timing attacks. Use `hmac.compare_digest` or `verify_password`.

**S-6 · Rider auth does not check token blacklist**
`backend/routers/riders.py:29-37` — `get_current_rider` decodes the JWT but never queries `db.blacklisted_tokens`. A logged-out rider token remains valid until expiry (12 hours).

**S-7 · No rate limiting on rider endpoints**
`backend/routers/riders.py` — `rider_login`, `rider_self_register`, `update_rider_location`, `update_order_status` have no `_=Depends(rate_limit)`. Brute-force on rider login is unconstrained.

**S-8 · OTP brute-force possible**
`backend/database.py:253-264` — `verify_and_clear_otp` deletes the OTP on match, but the rate-limit dependency in `send_otp` (30 req/min per IP) applies only to sending, not to `verify_otp`. An attacker on a fresh IP can try all 1,000,000 combinations before the 5-minute TTL expires if `verify_otp` has no separate rate limit.

**S-9 · CORS `allow_methods=["*"]` in dev**
`backend/server.py:1969` — permissive in dev; fine if dev is not publicly exposed, but Render free-tier is public.

**S-10 · Google OAuth client IDs hardcoded in frontend**
`frontend/context/AuthContext.tsx:14` — fallback to hardcoded `418665414188-rl2jg740eersokldgp9ojnr6ue7uvc0r.apps.googleusercontent.com`. OAuth client IDs are public and not secret by nature, but committing them is an antipattern (rotation is impossible without a code change).

**S-11 · `/auth/refresh` accepts raw `dict`, no input validation**
`backend/server.py:242`:
```python
async def refresh_token(request: dict):
```
Pydantic model absent — any JSON body accepted. Non-critical but inconsistent with rest of API.

### 4.3 CONTRACTS.md Seam Mismatches

**CM-1 · `image_url` vs `image` (B-4 above) — CONTRACTS §7 violated on every product read**

**CM-2 · `loop_balance` field name discrepancy**
`CONTRACTS.md §10`: `users.loop_balance — float, ₹`
Code: `users.loop_balance_paise` (int, paise). CONTRACTS is outdated relative to the implementation. Any client reading `loop_balance` from the user document will get `undefined`.

**CM-3 · Tracking response hides rider at `reached_store` status**
`backend/routers/orders.py:440`:
```python
"delivery_partner": delivery_partner_data if order.get("status") in ["picked_up", "out_for_delivery"] else None,
```
CONTRACTS §4 canonical tracking response shows `delivery_partner` with `current_location`. A customer cannot see the rider's location when the rider has `reached_store` (arrived at warehouse but not yet picked up). `reached_store` should be in the list.

**CM-4 · `POST /api/orders/{id}/status` CONTRACTS endpoint does not match router path**
CONTRACTS §3 lists `PUT /api/orders/{id}/status`. The `orders.py` router exposes `@router.put("/admin/orders/{order_id}/status")` and `@router.put("/{order_id}/status")`, which mount as `/api/orders/admin/orders/{id}/status` and `/api/orders/{id}/status` respectively. The `server.py` wrapper at line 1902-1905 adds `PUT /admin/orders/{order_id}/status` and `POST /admin/orders/{order_id}/status`. The non-admin `PUT /orders/{id}/status` path is accessible without admin auth — only the `/admin/` path requires `verify_admin`.

**CM-5 · `loop_ledger.py:74` MSO secret CONTRACTS §10 — implementation incomplete**
CONTRACTS §10 says `X-Mso-Secret: <shared-secret>` with env var; code uses hardcoded string.

**CM-6 · `users.loop_balance` vs `users.loop_balance_paise` in CONTRACTS §10**
The ledger stores `loop_balance_paise` but CONTRACTS §10 documents `loop_balance`. Clients building on CONTRACTS will read the wrong field.

**CM-7 · `assign_rider_to_order` internal route path differs from CONTRACTS**
CONTRACTS §5: `POST /api/admin/orders/{id}/assign-rider`
`orders.py:453`: `@router.post("/admin/{order_id}/assign-rider")` which mounts at `/api/orders/admin/{id}/assign-rider` (prefix is `/orders`).
The server.py wrapper at line 1907 correctly exposes `POST /admin/orders/{order_id}/assign-rider` as a separate route. Both paths exist — CONTRACTS path is served by wrapper, not the router directly.

### 4.4 Incomplete Features / Stubs

**I-1 · Cable TV sync is mock, not real**
`backend/server.py:551-576` (`verify_cable_tv_details`) — defined but never called. `force-sync` (line 599) and `sync-status` (line 578) return mock data.

**I-2 · Brand banners are static/garbled**
`backend/server.py:1068` — `"offer_text": "Ã¢ÂÂ¹50 OFF"` — UTF-8 double-encoded rupee symbol. `"valid_until": "2025-12-31"` is in the past.

**I-3 · KPI dashboard: most metrics return "insufficient data"**
`backend/routers/kpis.py:48,50,53,75,76,101,102,111` — NPS, order accuracy, CAC, gross margin, cost per delivery, CLV, inventory turnover all return the string `"insufficient data"` rather than computed values.

**I-4 · Email OTP delivery is dev-only**
`backend/server.py:1756-1760` — email OTP only logs to console in dev; no email provider wired.

**I-5 · Gadget eligibility aggregation uses wrong field**
`backend/routers/loop_ledger.py:320`:
```python
{"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
```
Field should be `$total`. This means gadget eligibility check always sees ₹0 spend → never triggers.

**I-6 · `SocialAuthRequest` model is dead code**
`backend/models.py:131-136` — model for the removed `/auth/social` endpoint. CONTRACTS §2 marks it for removal. Model remains and may confuse future developers.

**I-7 · `verify_cable_tv_details` is dead code**
`backend/server.py:551-576` — function defined, never called.

**I-8 · `OrderCreate` legacy model carries stale fields**
`backend/models.py:73-80` — `OrderCreate.items` (list), `subtotal`, `reward_applied`, `total` are legacy fields never used by `create_order_core`. The real model is `CreateOrderRequest`. Legacy endpoint `POST /orders` (no suffix) at `orders.py:357` wraps it but ignores the items, using cart instead.

**I-9 · `product_analytics` uses `price` and `min_stock_level` not in schema**
`backend/server.py:776-777`:
```python
total_stock_value = sum(p.get("price", 0) * p.get("stock", 0) for p in all_products)
low_stock_items = len([p for p in all_products if p.get("stock", 0) < p.get("min_stock_level", 10)])
```
`price` is not persisted (only computed by `clean_mongo_doc`); `min_stock_level` is a `ProductCreate` optional field not guaranteed to exist. Stock value is always 0 for API-created products.

**I-10 · Admin riders list `availability` field ignores queue**
`backend/routers/admin_riders.py:53`:
```python
"availability": r.get("current_order_id") is None,
```
A rider with a full queue (`current_order_id=None` but `order_queue=["x","y"]`) will show as available but should not be assigned.

**I-11 · `filter_options` fetches all products to compute price range**
`backend/server.py:716-717`:
```python
all_products = await db.products.find({}, {"price": 1}).to_list(10000)
prices = [p.get("price", 0) for p in all_products if p.get("price")]
```
`price` is not stored in DB for canonical products. Price range will always be `{min: 0, max: 0}`. Projection `{"price": 1}` also doesn't project `price_paise`.

---

## 5. WHAT IS MISSING FOR TIRUPATI PILOT 🚫

| # | Missing Item | Impact | Notes |
|---|---|---|---|
| M-1 | **Real OTP SMS delivery** | Phone-login unusable in production | Fast2SMS or MSG91 with DLT registration required (CONTRACTS §2, Task 52) |
| M-2 | **`price` field in checkout** | Every order total = ₹0 (see B-2) | `orders.py:177` must use `price_paise / 100` |
| M-3 | **`image_url` → correct field name** | Product images broken everywhere (B-4) | `database.py:142-145` inverts the contract |
| M-4 | **Monthly spend aggregation fix** | GETV redemption never works (B-1) | Wrong field names in loop_ledger.py aggregations |
| M-5 | **MSO secret in env var** | GETV coin credit endpoint trivially forgeable (S-1) | `loop_ledger.py:74` |
| M-6 | **Rider blacklist check** | Logged-out rider tokens remain valid 12h (S-6) | `riders.py:get_current_rider` |
| M-7 | **Admin portal logout calls backend** | Admin sessions cannot be revoked (S-3) | `auth.js:14-17` |
| M-8 | **Rate limit on `verify_otp`** | OTP brute-force feasible (S-8) | No rate_limit dependency on verify_otp endpoint |
| M-9 | **Real cable TV API integration** | STB linking works; but spend-data sync is mock | For GETV coins to earn automatically |
| M-10 | **Rider login preserve offline status** | Riders forced online on login (B-9) | `riders.py:138-139` |
| M-11 | **Push notification for admin on new orders** | Admin never notified of new orders without polling | No admin push token storage or notification path |
| M-12 | **`RAZORPAY_WEBHOOK_SECRET` guard in non-prod** | Webhook spoofable if env var omitted on Render (S-4) | Should warn/fail if empty on non-localhost |
| M-13 | **`delete_account` collection name** | Cart not cleaned on account delete (B-3) | `server.py:1423` `db.carts` → `db.cart_items` |
| M-14 | **Index on `orders.assigned_rider_id`** | Slow rider order lookup as order volume grows | Not in `server.py` startup index creation |
| M-15 | **Gadget eligibility aggregation fix** | Gadget reward never triggered (I-5) | `loop_ledger.py:320` wrong field |
| M-16 | **Product soft-delete** | `DELETE /products/{id}` hard-deletes; active orders referencing product have stale data | Should set `is_active: false` |
| M-17 | **Rider earnings use `delivery_fee` fallback ₹30** | Rider pay calculation may be wrong if delivery_fee=0 (free delivery) | `riders.py:300` `fee()` returns 30.0 if field missing |

---

## 6. Leftover Console Logs / TODOs / Mock Data

| Location | Line | Finding |
|---|---|---|
| `backend/routers/loop_ledger.py` | 74 | `# TODO: move to env var` — MSO secret |
| `backend/server.py` | 557 | `# Mock verification - Replace with real API calls` |
| `backend/server.py` | 608 | `# Mock sync process - Replace with real API calls` |
| `backend/database.py` | 276 | `print(f"[DEV SMS]...")` — plain `print` not logger |
| `backend/server.py` | 1068 | `"Ã¢ÂÂ¹50 OFF"` — garbled encoding in static response |
| `backend/server.py` | 1050 | `"valid_until": "2025-12-31"` — expired banner date (hardcoded) |
| `frontend/context/AuthContext.tsx` | 127 | `log('[BOOT] AuthProvider mounting...')` — behind `__DEV__` guard, acceptable |
| `backend/routers/kpis.py` | 48,50,53,75,76 | `"insufficient data"` strings instead of real metrics |
| `backend/server.py` | 565–575 | `"api_integration_required": True` — cable TV stubs |

---

## 7. Unused Exports / Dead Imports

| File | Item | Status |
|---|---|---|
| `backend/models.py:131-136` | `SocialAuthRequest` | Model for removed `/auth/social` endpoint; import in `server.py:37` carries it but no endpoint uses it |
| `backend/server.py:551-576` | `verify_cable_tv_details` | Defined, never called |
| `backend/routers/loop_ledger.py:532` | `MAX_REDEEM_FRACTION = 1.0` | "kept for import compatibility" comment; no imports found |
| `backend/models.py:73-80` | `OrderCreate.items/subtotal/reward_applied/total` | Legacy fields, ignored in actual order creation |

---

## 8. Summary Tables

### WHAT WORKS ✅ (complete and correct)
- JWT auth full cycle (register / login / Google / OTP / refresh / logout / blacklist)
- Admin login + role-based access guard
- Order state machine (all 12 statuses including `reached_store`)
- Atomic stock reservation + compensating rollback
- Rider assignment: manual (Task 5), auto-nearest (Task 21), multi-order queue (Task 31)
- Rider self-register + admin approval flow (Task 30)
- Rider availability toggle with active-order guard (Task 27)
- Canonical rider location storage `{lat, lng, updated_at}` (CONTRACTS §4 seam fixed)
- `gps_tracking_enabled` computed from real location, not hardcoded
- Serviceability check (Haversine, Task 20) + store seeding
- Background jobs: stock expiry (30 min TTL) + refund reconciliation (Razorpay poll)
- Razorpay create/verify/webhook with HMAC + idempotency
- LOOP ledger credit/debit infrastructure (tier calc, monthly limit, gadget flag)
- MSO webhook idempotency per `(user, mso, month)`
- GETV auto-suspend on 2 consecutive no-bill months
- Rate limiting (Redis + fallback)
- CORS production guard (panics if ALLOWED_ORIGINS missing)
- JWT_SECRET_KEY startup panic
- OTP brute-force partial mitigation (OTP deleted on first correct try)
- Cable TV STB linking with GTPL validation
- Excel bulk product upload (admin portal + backend)
- Token rotation and refresh timer (14-min interval, frontend)

### WHAT EXISTS BUT IS BROKEN/INCOMPLETE ⚠️ (file:line)
- `database.py:142-145` — `image_url` renamed to `image`, breaks CONTRACTS §7 (every product API response)
- `loop_ledger.py:122` — wrong aggregation field `$total_amount_paise` → monthly spend always 0 → GETV tier always Base → redemption always fails
- `loop_ledger.py:135` — fallback also wrong: `$total_amount` should be `$total`
- `loop_ledger.py:320` — gadget check uses `$total_amount` → gadget eligibility never triggers
- `orders.py:177` — `product.get("price", 0.0)` → order total always ₹0 for canonical products
- `server.py:1423` — `db.carts` should be `db.cart_items`
- `server.py:658-663` — price filter queries `price` field absent from DB
- `server.py:776-777` — analytics uses `price` and `min_stock_level` (not in DB for canonical products)
- `riders.py:138-139` — login forces status=online
- `riders.py:29-37` — `get_current_rider` skips blacklist check
- `loop_ledger.py:74` — MSO secret hardcoded
- `admin-portal/src/services/auth.js:14-17` — logout doesn't blacklist token
- `payments.py:142` — webhook verification skipped if `RAZORPAY_WEBHOOK_SECRET` empty
- `server.py:1153` — plaintext password comparison (timing attack)
- `orders.py:440` — `delivery_partner` hidden at `reached_store` status (should show)
- `admin_riders.py:53` — `availability` ignores `order_queue`
- `server.py:1127` — `logger` used before definition (runtime NameError in dev bootstrap path)
- `kpis.py:48,50,53,75,76` — most KPIs return "insufficient data"
- `server.py:1068` — garbled encoding `"Ã¢ÂÂ¹50 OFF"` in brand banners
- `server.py:1050` — banner `valid_until: "2025-12-31"` already expired

### WHAT IS MISSING FOR TIRUPATI PILOT 🚫 (no code exists)
- Real OTP SMS (Fast2SMS/MSG91 DLT-registered) — console print only
- Fix order total calculation (price_paise/100)
- Fix `image_url` → must output `image_url` not `image`
- Fix monthly spend aggregation field name for GETV
- MSO secret moved to env var
- Rider token blacklist check in `get_current_rider`
- Admin portal server-side logout
- Rate limit on `POST /auth/verify-otp`
- Real cable TV spend-data sync (for GETV monthly earn)
- Admin push notifications for new orders
- Production webhook secret guard
- Index on `orders.assigned_rider_id`
- Gadget eligibility aggregation fix
- Soft-delete for products

---

*End of audit. No code was modified — this is a read-only report.*
