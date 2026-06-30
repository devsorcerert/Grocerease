# GrocerEase API Contract (CONTRACTS.md)

> **This file is the single source of truth for everything shared between the backend, the customer app, the rider app, and the admin portal.**
>
> **Rules:**
> 1. If a field name, status word, token claim, or endpoint shape is used by more than one app, it is defined HERE and nowhere else.
> 2. Only the **backend / main-repo** workstream may change this file. When it does, it updates the backend code **and** every consumer in the same change.
> 3. Client apps copy these shapes exactly. They never invent their own field names.
> 4. Prefer adding a new field (keeping the old one working) over renaming, then flip clients, then remove the old field.
>
> _Status: FROZEN — verified against live code 2026-06-21 (Task 45). Do not edit without updating the backend and all consumers in the same commit._

---

## 1. Environments / Base URLs

| Environment | Backend base URL | Notes |
|---|---|---|
| Local dev | `http://localhost:8001` | via `docker-compose up` |
| Pilot (current) | `https://grocerease-backend-0uip.onrender.com` | Render free tier — cold starts; replace at launch (Task 50) |
| ❌ Dead — never use | `https://api.grocereasetv.com` | domain does not resolve; remove from all defaults/`.env.example` |

- All API paths are prefixed with **`/api`** (e.g. `https://<base>/api/auth/login`). The admin portal currently omits this prefix — that is Task 7.
- Health check (no `/api`): `GET /health` → `{"status":"ok"}`.

---

## 2. Auth & JWT

**Token transport:** `Authorization: Bearer <access_token>` header on every authenticated request.

**Token lifetimes:**
- Customer/admin access token: **30 minutes**. Refresh token: **30 days**.
- Rider access token: **12 hours** (no refresh — rider re-logs each shift). No refresh token issued.
- The customer app refreshes ~14 min in (timer) and via `/api/auth/refresh` (rotates: old refresh token is blacklisted, new pair issued).

**JWT claims (canonical):**
| Claim | Type | Meaning |
|---|---|---|
| `user_id` | string | Customer id (also `"default-admin-id"`/`"admin"` for admins) |
| `is_admin` | bool | Present on admin tokens |
| `role` | string | One of `super-admin`, `ops`, `support`, `admin` (admin tokens) |
| `rider_id` | string | Present **only** on rider tokens (riders use `rider_id`, NOT `user_id`); `user_id` absent on rider tokens |
| `type` | string | `"refresh"` on refresh tokens; absent on access tokens |
| `exp` | int | Expiry (unix) |

**Auth endpoints (canonical):**
| Endpoint | Use | Notes |
|---|---|---|
| `POST /api/auth/register` | email signup | returns `{token, refresh_token, user}` |
| `POST /api/auth/login` | email login | |
| `POST /api/auth/google` | Google sign-in (native) | verifies the Google ID token server-side ✅ keep |
| `POST /api/auth/send-otp` / `verify-otp` | phone login | uses DB-backed OTP store (`set_otp`/`verify_and_clear_otp`) |
| `POST /api/auth/refresh` | rotate tokens | |
| `POST /api/auth/logout` | blacklist refresh token | |
| `POST /api/admin/login` | admin login | returns admin token with `is_admin`+`role` |
| `POST /api/rider/login` | rider login | returns `{token, rider_id, name, current_order}` |
| ~~`POST /api/auth/social`~~ | **REMOVE** | accepts any email with no verification = account takeover (Task 3) |

**OTP delivery:** while building and during QA, OTPs are **printed to the backend console (dev mode)** — no SMS provider needed. Real SMS (DLT-registered MSG91/Twilio) is wired only at launch (Task 52).

---

## 3. Order lifecycle (canonical enums) — resolves the status mismatch

There are **three** status fields on an order. Define them once here.

### 3a. `status` (the master state machine)
```
created           → order just created
pending_payment   → prepaid order awaiting payment
cod_confirmed     → COD order confirmed
paid              → payment captured
preparing         → being packed at store
packed            → packed, ready for pickup
reached_store     → rider arrived at store          ← was emitted by rider app but UNMAPPED; now official
picked_up         → rider collected the order
out_for_delivery  → on the way to customer
delivered         → completed
cancelled         → cancelled (stock restored)
refunded          → money returned
```
> **Task 46 — FIXED 2026-06-21:** `routers/orders.py transition_order_status` now maps **`reached_store`** → `delivery_status: reached_store`. Every app uses exactly these strings — no synonyms.

### 3b. `payment_status`
```
pending | pending_cod | paid | refund_pending | refunded
```

### 3c. `delivery_status`
```
pending | preparing | packed | reached_store | picked_up | out_for_delivery | delivered
```

### Order endpoints (canonical)
| Endpoint | Who | Use |
|---|---|---|
| `POST /api/orders/create` | customer | COD order |
| `POST /api/orders/create-pending` | customer | prepaid order (pay next) |
| `GET /api/orders` / `GET /api/orders/user/orders` | customer | list own orders |
| `POST /api/orders/{id}/cancel` | customer | cancel |
| `GET /api/orders/{id}/tracking` | customer | live tracking (see §4) |
| `GET /api/orders/admin/list` | admin | all orders |
| `PUT /api/orders/{id}/status` | admin | change status |
| `POST /api/admin/orders/{id}/assign-rider` | admin | **NEW (Task 5)** — assign a rider |

---

## 4. Rider location schema (THE SEAM) — resolves the GPS mismatch

**Problem today:** the rider app sends `{lat, lng}`, the backend stores `last_lat`/`last_lng`, and the customer tracking screen reads `current_location` — so it never matches and falls back to **fake hash-based GPS**. This contract picks ONE shape.

### Canonical location object
```json
"current_location": {
  "lat": 13.6288,
  "lng": 79.4192,
  "updated_at": "2026-06-21T10:15:00Z"
}
```

- **Rider app writes it** (Task 12): `POST /api/rider/location` with body `{ "lat": <float>, "lng": <float> }`. The backend stores it on the rider document as `current_location` (with server-set `updated_at`).
- **Backend stores it** under `riders.current_location` — **stop writing `last_lat`/`last_lng`** (Task 6 / Block 3 in phase0).
- **Customer app reads it** (Task 6 / Block 3): `GET /api/orders/{id}/tracking` returns `delivery_partner.current_location` = the canonical object above. **Remove the hash-derived fake-GPS fallback** in `routers/orders.py:370-373`.
- `gps_tracking_enabled` must be `true` **only** when a real `current_location` exists — not hardcoded (currently hardcoded; fixed in Block 3).

### Tracking response shape (canonical)
```json
{
  "order_id": "…",
  "status": "out_for_delivery",
  "delivery_partner": {
    "id": "…", "name": "…", "phone": "…", "vehicle": "Bike", "rating": 4.8,
    "current_location": { "lat": 13.6288, "lng": 79.4192, "updated_at": "…" },
    "estimated_arrival": "12 minutes"
  },
  "delivery_address": "…",
  "estimated_delivery": "…",
  "tracking_updates": [ { "timestamp": "…", "status": "…", "message": "…" } ],
  "gps_tracking_enabled": true
}
```

---

## 5. Rider ↔ order assignment (THE OTHER SEAM)

**Problem today:** `assigned_rider_id` and `current_order_id` are read in 4 places but **set nowhere** — no order can ever reach a rider.

### Canonical fields
- `orders.assigned_rider_id` (string | null) — the rider handling this order.
- `riders.current_order_id` (string | null) — the rider's active order. Cleared (→ null) on `delivered`.

### Assignment flow (Task 5)
1. Admin calls `POST /api/admin/orders/{order_id}/assign-rider` with `{ "rider_id": "…" }`.
2. Backend sets `orders.assigned_rider_id` + `riders.current_order_id`, and sends the rider a push + in-app notification.
3. Rider app reads `GET /api/rider/current-order`.
4. Rider advances status via `POST /api/rider/order-status` `{ "order_id": "…", "status": "<canonical status>" }`.

### Rider endpoints (canonical)
| Endpoint | Auth | Use |
|---|---|---|
| `POST /api/rider/register` | public | self-onboarding (Task 30) — creates `pending_approval` rider |
| `POST /api/rider/login` | public | login — blocked if `pending_approval` or `suspended` |
| `POST /api/rider/availability` | rider | `{ "available": bool }` toggle online/offline (Task 27) — cannot go offline with active order |
| `POST /api/rider/location` | rider | push location `{ lat, lng }` (§4) |
| `POST /api/rider/order-status` | rider | advance order status (§3a words only) |
| `GET /api/rider/current-order` | rider | fetch active order — returns `{ "order": <order\|null> }` |
| `GET /api/rider/order-queue` | rider | fetch queued orders (Task 31) — returns `{ "order_queue": [...] }` |
| `POST /api/rider/push-token` | rider | save Expo push token |

### Admin rider endpoints (canonical)
| Endpoint | Use |
|---|---|
| `POST /api/admin/riders` | create rider (admin-seeded) |
| `GET /api/admin/riders` | list all riders with availability |
| `GET /api/admin/riders/pending` | list pending-approval riders (Task 30) |
| `POST /api/admin/riders/{id}/approve` | approve pending rider → `offline` (Task 30) |
| `POST /api/admin/riders/{id}/suspend` | suspend rider |
| `POST /api/admin/orders/{id}/assign-rider` | manual assignment — `{ rider_id }` — respects queue (Task 31) |
| `POST /api/admin/orders/{id}/auto-assign-rider` | nearest-available auto-assign (Task 21) |

### Rider status values
| Value | Meaning |
|---|---|
| `pending_approval` | self-registered, awaiting admin approval |
| `offline` | approved, not on shift |
| `online` | on shift, available for orders |
| `suspended` | blocked |

### Multi-order queue (Task 31)
- `riders.current_order_id` — the order actively being delivered (unchanged from §5 canonical).
- `riders.order_queue` — ordered list of upcoming assigned order IDs.
- `MAX_QUEUE_SIZE = 3` (1 active + 2 queued) for pilot.
- On `delivered`: head of `order_queue` is promoted to `current_order_id` automatically.
- Assign-rider returns HTTP 400 if `total_load ≥ MAX_QUEUE_SIZE`.

### Auto-assign algorithm (Task 21)
1. Filter candidates: `status == "online"` AND `total_load < MAX_QUEUE_SIZE`.
2. Rank by Haversine distance to `order.store_id`'s lat/lng (pure Python — no Mongo geo).
3. Fallback if no GPS data: lowest total load wins.
4. Manual `assign-rider` always overrides auto-assign.

---

## 6. Notification payload (canonical)

Push (Expo) and in-app notifications share this shape:
```json
{
  "id": "uuid",
  "user_id": "…",
  "title": "Order On The Way 🛵",
  "message": "Your delivery partner is heading to you!",
  "type": "order",
  "action_route": "/order-tracking/<order_id>",
  "read": false,
  "created_at": "…"
}
```
- `type` values: `order`, `promo`, `system`.
- Expo push token must start with `ExponentPushToken`.

---

## 7. Product shape (canonical) — resolves the schema drift

One product shape across seed, bulk upload, Excel upload, and API reads. Canonical field names:
```
id, name, category, subcategory, brand, price_paise (int),
mrp_paise (int | null), stock (int), unit, description,
image_url (string URL), is_active (bool), is_featured (bool, default false),
store_id (added in Task 20)
```
- ❌ Do not use the variants `price`, `offerPrice`, `original_price`, `offer_price`, or `image` anywhere. Normalize all write paths to the names above (Task 18).
- API reads always return `image_url` (not `image`).
- `is_featured` is always present in API reads (defaulted to `false` by `clean_mongo_doc` when absent in the document).

### Featured product endpoints
| Endpoint | Auth | Use |
|---|---|---|
| `GET /api/products/featured` | public | Returns `{ products: [...], total: N }` — only docs where `is_featured == true`. Falls back (client-side) to regular products when the list is empty. |
| `POST /api/admin/products/{id}/toggle-featured` | admin | Flips `is_featured` on the product keyed by `id` (UUID). Returns `{ id, is_featured }`. |

Products are always addressed by `id` (UUID string). The Mongo `_id` / ObjectId is stripped at serialization and must never appear in any client call.

---

## 9. Stores & Serviceability (Task 20)

### Store document shape
```json
{
  "id": "uuid",
  "name": "GrocerEase Tirupati",
  "address": "Dark Store, Tirupati, Andhra Pradesh",
  "location": {
    "lat": 13.6288,
    "lng": 79.4192
  },
  "radius_km": 7.0,
  "is_active": true,
  "created_at": "2026-06-23T..."
}
```

### Store endpoints
| Endpoint | Auth | Use |
|---|---|---|
| `GET /api/stores` | public | list active stores |
| `GET /api/stores/serviceability?lat=<f>&lng=<f>` | public | check if coordinate is serviceable |
| `POST /api/admin/stores` | admin | create a store |
| `PUT /api/admin/stores/{store_id}` | admin | update / toggle active |
| `GET /api/admin/stores` | admin | list all stores incl. inactive |

### Serviceability response
```json
{ "serviceable": true,  "store": { ...store doc... } }
{ "serviceable": false, "store": null }
```

### How serviceability is computed
- Pure-Python **Haversine** distance — no Mongo `$near`/`$geoNear` (avoids mongomock CI limitation).
- An address is serviceable if **any active store** has `distance(store, delivery) ≤ store.radius_km`.
- Nearest qualifying store is selected and its `id` written to `orders.store_id`.

### Checkout integration
- `create_order_core` checks serviceability using the delivery address's `lat`/`lng`.
- If the address has no lat/lng (legacy/manual entry) the check is **skipped** (fail-open — pilot only; address-capture UX always saves coordinates).
- On serviceability failure → HTTP 400 "Sorry, we don't deliver to your address yet."
- On success → `orders.store_id` is set to the serving store's `id`.

### Product `store_id` field
- `products.store_id` (string | null) — which dark store stocks this product.
- `null` = legacy / available at all stores. New products should set this.
- Pilot seed store id: `"store-tirupati-pilot"`.


---

## 8. Change log
| Date | Who | Change |
|---|---|---|
| 2026-06-21 (draft) | — | Starter created from audit. |
| 2026-06-21 | phase0 | Task 45: verified all claims, lifetimes, enums, and field names against live code. Corrected rider token lifetime (12 h). Task 46: `reached_store` added to `transition_order_status`. Status → FROZEN. |
| 2026-06-23 | task-20 | §9 added: `stores` collection, serviceability check (Haversine), `store_id` on products and orders, pilot store seeded. §7 `store_id` confirmed. |
| 2026-06-23 | task-21/27/30/31 | §5 rider section expanded: availability toggle, self-register + admin approval flow, multi-order queue (order_queue), nearest-available auto-assign. |

---

## §10 LOOP Credit Ledger (Tasks 15 & 25)

### User balance field
`users.loop_balance` — float, ₹, defaults to 0.0 if absent.

### Ledger collection: `loop_ledger`
| Field | Type | Notes |
|---|---|---|
| `id` | str (UUID) | |
| `user_id` | str | |
| `type` | `"credit"` \| `"debit"` | |
| `amount` | float | always positive |
| `balance_after` | float | denormalised balance snapshot |
| `reference_type` | str | `order_earn`, `order_redeem`, `admin_credit`, `cable_tv_earn` |
| `reference_id` | str | order ID, admin-timestamp, or MSO idempotency key |
| `description` | str | human-readable |
| `created_at` | datetime | UTC |

### Order shape additions (Task 15)
`CreateOrderRequest` gains:
- `loop_credits_to_redeem: float = 0.0` — requested redemption amount

Order document gains:
- `loop_credits_used: float` — actual amount applied (≤ requested, ≤ 50% of total, ≤ balance)

### Endpoints
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/user/loop-balance` | customer JWT | current balance |
| GET | `/api/user/loop-ledger` | customer JWT | paginated history |
| POST | `/api/admin/loop/credit` | admin JWT | manual credit |
| POST | `/api/admin/loop/recalc/{user_id}` | admin JWT | recompute from ledger |
| POST | `/api/mso/spend-signal` | X-Mso-Secret header | MSO cable-TV webhook |

### MSO spend-signal (Task 25 stub)
```
POST /api/mso/spend-signal
Header: X-Mso-Secret: <shared-secret>
Body: { user_id, mso_id, amount_spent, billing_month }
```
Issues 2% of `amount_spent` as LOOP credits. Idempotent per `(user_id, mso_id, billing_month)`.

### Changelog
| Date | Change |
|---|---|
| 2024-06-23 | §10 added: LOOP ledger, Task 15 (checkout redemption), Task 25 (MSO stub) |
