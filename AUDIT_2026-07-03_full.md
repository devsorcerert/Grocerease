# GrocerEase — Full Security & Launch-Readiness Audit

> **Date:** 2026-07-03
> **Scope:** `devsorcerert/Grocerease` (full tree) + `devsorcerert/Grocerease-Rider` (full tree)
> **Method:** Every source file in both repositories read; every backend route traced to its frontend caller; secret scan across all tracked files; CI/CD workflows reviewed; dependency review.
> **Context:** Pilot target of 50,000+ households in Tirupati (pincodes 517501–517507), GTPL cable-TV subsidy integration.

---

## EXECUTIVE SUMMARY

**Is this a real app or a mock?** It is a **real, substantially functional application** — not a mock. The backend is a FastAPI + MongoDB (Motor) service with ~45 implemented routes across 9 routers, real Razorpay integration, JWT auth with refresh-token rotation and blacklisting, atomic stock reservation with compensating rollbacks, background jobs (pending-payment expiry, refund reconciliation, monthly GETV coin grant/burn), and a working rider dispatch model. The customer app (Expo/React Native, 35+ screens), admin portal (React), and rider app all call real backend endpoints. 36 real backend tests exist and run in CI, which also builds a signed release APK.

**Important discrepancy:** the stack is **not** what the project describes. There is no Node.js backend and no Firestore. The backend is **Python/FastAPI**, the database is **MongoDB**, and Firebase is used **only** for Google Sign-In client IDs. All questions about "Firestore security rules" are moot — there are none because Firestore is not used. This is fine technically, but the docs/marketing description is wrong.

**Three-layer architecture status:** Present, in monorepo form:
- Frontend layer: `frontend/app/*` (expo-router screens), `frontend/store/cartStore.ts` (Zustand), `frontend/context/*` (Auth, Language).
- **Orchestration/middle layer: EXISTS but is thin by design** — `frontend/utils/api.ts` (axios instance, base-URL management, request interceptor attaching `Bearer` token) + `frontend/constants/api.ts` (env-validated base URL) + `frontend/context/AuthContext.tsx` (token refresh every 14 min, session bootstrap). The admin portal has its own equivalent (`admin-portal/src/services/api.js` with a 401-redirect response interceptor, proxied by `admin-portal/nginx.conf`). There is **no separate BFF/API-gateway service** — the FastAPI app is the single API for all three clients. For a pilot this scale, that is an acceptable architecture; it is not a "missing layer" so much as a deliberate 2-tier + shared-API design.
- Backend layer: `backend/server.py` + `backend/routers/*` — complete routes, models (Pydantic), DB access, auth middleware, background jobs.
- **No broken bridges found**: every frontend API call I traced (`/auth/*`, `/cart/*`, `/orders/*`, `/payments/razorpay/*`, `/checkout/summary`, `/user/addresses*`, `/user/loop-*`, `/cable-tv/*`, `/products*`, `/offers`, `/videos`, `/wishlist*`, `/notifications*`, `/rider/*`, `/admin/*`) has a corresponding backend route.

**Pilot launch readiness: ❌ NOT READY as-is.** Functional completeness is roughly **75%**, but there are **money-losing and account-takeover-class vulnerabilities** that must be fixed before a single real order is taken. Most are small, surgical fixes (days, not months). With the critical list fixed and the ops gaps closed, a controlled pilot is realistic.

---

## CRITICAL BLOCKERS (fix before ANY launch — money loss / data exposure)

### C1. Payment verification does not bind the payment to the order — paid-order forgery
`backend/routers/payments.py:71-105`. `/payments/razorpay/verify` verifies the Razorpay signature triplet `(razorpay_order_id, razorpay_payment_id, razorpay_signature)` but **never checks that `payload.razorpay_order_id` equals the `razorpay_order_id` stored on the local order**, and **never checks the paid amount**.

Exploit: attacker creates Order A worth ₹1 and Order B worth ₹5,000 (both pending). Pays ₹1 for A, receives a valid signature triplet, then calls `/payments/razorpay/verify` with `order_id = B` and A's triplet. Signature check passes → Order B transitions to `paid` (line 105). Direct revenue loss, fully scriptable.

**Fix:** in `verify_razorpay_payment`, require `order.get("razorpay_order_id") == payload.razorpay_order_id`, and fetch the payment from Razorpay to assert `amount == int(order["total"]*100)` and `status == "captured"`. Also mark the triplet as consumed (store `razorpay_payment_id` on the order, reject reuse).

### C2. MSO spend-signal webhook: hardcoded fallback secret + unbounded idempotency key — infinite free money
`backend/routers/loop_ledger.py:75` — `MSO_SHARED_SECRET = os.environ.get("MSO_SHARED_SECRET", "grocerease-mso-pilot-2024")`. The fallback secret is **committed to a public repository**. Anyone can call `POST /api/mso/spend-signal` (loop_ledger.py:482-548).

Worse, the idempotency key at loop_ledger.py:501 is `f"{user_id}:{mso_id}:{billing_month}"` where **`mso_id` is attacker-controlled free text** — vary `mso_id` and the same user is credited 1,000 GETV coins (₹1,000 of order-payable value, debited 1:1 against order totals in `orders.py:269-276`) an unlimited number of times.

**Fix:** remove the fallback (fail startup if `MSO_SHARED_SECRET` unset, exactly as done for `JWT_SECRET_KEY` in `database.py:76-77`); validate `mso_id` against an allowlist (`{"gtpl"}`); key idempotency on `user_id:billing_month` only; add rate limiting.

### C3. 77,479 real GTPL subscriber STB numbers committed to the repo — PII leak + coin-farming enabler
`data/stb_numbers.txt` (77,479 lines) contains the full GTPL Tirupati subscriber STB/NUID list, uploaded to Mongo by `.github/workflows/upload-stb.yml`. Linking any *available* STB number grants 1,000 GETV coins/month (`server.py:515-559` → `grant_monthly_loop_coins`). With the full list public, an attacker can register throwaway accounts and link real subscribers' boxes **before the actual customers do** (first-come-first-served at `server.py:526-529`), farming ₹1,000/month per hijacked STB and locking legitimate customers out of their own subsidy.

**Fix:** delete the file from the repo **and from git history** (BFG/filter-repo), rotate the dataset if feasible, and add a second linking factor (e.g., OTP to the phone number GTPL has on file for that STB, or a GTPL-issued linking code).

### C4. Everything security-critical keys off `ENV=production`, but the default is `development`
The following gates all silently open if the `ENV` env var is missing or misspelled on the production host (Render):
- Mock payment bypass: `payments.py:87-92` — anyone can mark orders paid by sending `razorpay_order_id: "rzp_mock_..."` with any signature.
- Webhook signature optional: `payments.py:137-150` — unsigned webhooks accepted → forged `payment.captured` events mark orders paid.
- Default admin seeded with **empty password**: `server.py:110-123` — `hash_password("")` for `grocereasetv@gmail.com`; login with an empty password succeeds.
- CORS/ALLOWED_ORIGINS and admin-credential fatal checks skipped (`server.py:1189-1203`, `server.py:2038-2051`).

**Fix:** invert the default — treat anything that is not explicitly `ENV=development` as production. One env var typo must not disable payment signature checking.

### C5. Admin login has no rate limiting — brute force
`server.py:1206-1262` — `POST /api/admin/login` is the **only** auth endpoint without `Depends(rate_limit)` (`/auth/login`, `/auth/register`, `/auth/send-otp`, `/auth/verify-otp`, `/rider/login`, `/rider/register` all have it). Unlimited password guesses against the super-admin account, which can then delete products, refund orders, and credit coins.
**Fix:** add `_=Depends(rate_limit)` plus per-account lockout/backoff.

### C6. Refunds are recorded as "processed" even when Razorpay fails
`payments.py:204-230` — if the Razorpay refund API call throws, the code logs `"Falling back to mock refund"`, writes a refund doc with `"status": "processed"` and a fake `rf_mock_*` id, and transitions the order to `refunded`. The customer never receives money; the books say they did. During a pilot this is a guaranteed support fire and a reconciliation nightmare (the recon job at `background_jobs.py:126` explicitly *skips* mock refund ids, so it will never self-heal).
**Fix:** on Razorpay failure, keep the order in `refund_pending`, record `status: "failed"`, and surface it in an admin queue.

### C7. Refresh tokens for Google and OTP users expire in 30 minutes
`server.py:438` and `server.py:1888` call `create_access_token({..., "type": "refresh"})` **without** `expires_in`, so the "refresh" token gets the default 30-minute expiry (`database.py:89-92`). Email/password paths correctly pass `timedelta(days=30)` (`server.py:168`, `server.py:222`). Since the app's refresh timer fires every 14 minutes and **force-logs-out on refresh failure** (`frontend/context/AuthContext.tsx:178-185`), every Google/OTP user — i.e., virtually every pilot user — is logged out within ~30–45 minutes of signing in. This alone would sink the pilot's UX.
**Fix:** add `expires_in=timedelta(days=30)` at both call sites.

### C8. OTP endpoints: SMS bombing and no per-phone attempt limit
- `POST /auth/send-otp` (`server.py:1824-1836`) has only the global 30-req/min/IP limit — no per-phone cooldown or daily cap. A bot can drain the Fast2SMS balance and harass arbitrary phone numbers (30 SMS/min/IP, more via proxies).
- `POST /auth/verify-otp` (`server.py:1851-1856`) has no per-phone failed-attempt counter; a 6-digit OTP with a 5-minute TTL can be attacked from distributed IPs (each IP gets 30 guesses/min).
- If `FAST2SMS_API_KEY` is unset in production, `send_sms_fast2sms` logs and **returns True** (`server.py:1791-1797`) — the API replies "OTP sent successfully" while no SMS was ever sent: silent total failure of phone login.

**Fix:** per-phone cooldown (e.g., 3 sends/hour), max 5 verify attempts per OTP, and fail startup (or the endpoint) in production when no SMS provider is configured.

### C9. Mass assignment on `dict`-typed user endpoints
`server.py:1572-1582` (`POST /user/addresses`): the document is built as `{"id": ..., "user_id": user_id, **address_data}` — the spread comes **last**, so a payload containing `"user_id": "<victim-id>"` or `"id": "<existing-id>"` overrides the authenticated values. Same pattern at `POST /user/payment-methods` (`server.py:1636-1645`) and `PUT /user/addresses/{id}` (`$set` of raw dict, `server.py:1584-1597`, which can rewrite `user_id` to plant an address in another user's list). `POST /user/payment-methods` also stores whatever raw payment data the client sends (PCI-DSS: never store PAN/CVV — there is no server-side restriction).
**Fix:** Pydantic models for addresses/payment methods (as already done for products via `AdminProductCreate`), and spread payload **before** the server-controlled fields.

---

## HIGH PRIORITY GAPS (fix before pilot)

1. **Coupons have no usage limits** — `orders.py:196-204` and `server.py:1928-1948`: no per-user or global usage tracking; a percentage coupon can be reused on every order forever. Add `used_by`/`usage_limit` enforcement at order creation.
2. **Geofencing is client-side only** — the Tirupati pincode allowlist lives in the app (`frontend/app/checkout.tsx:57,256-263`). Server-side serviceability (`orders.py:157-169`) is **fail-open** when the address has no lat/lng, and depends on `db.stores` being seeded with correct radii. A direct API call can order to any address. Enforce pincode/geofence server-side in `create_order_core`.
3. **GETV debit race condition** — `loop_ledger.py:193-246` checks balance/tier and then decrements non-atomically; two concurrent checkouts can double-spend coins past balance or tier cap. Use a conditional update (`{"loop_balance_paise": {"$gte": amount}}`) in `find_one_and_update`.
4. **No order state machine** — `transition_order_status` (`orders.py:23-90`) accepts any string; the admin endpoint (`orders.py:620-629`) passes arbitrary `payload["status"]`. Customers can cancel while `out_for_delivery` (`orders.py:400-410`), restoring stock while the rider is en route. Define allowed transitions and enforce them.
5. **No idempotency key on order creation** (`orders.py:353-359`) — network retries/double taps create duplicate orders (client disables the button, but that's not a guarantee). Accept a client-generated idempotency key.
6. **Regex injection / ReDoS in search** — `server.py:690-694` and `server.py:2024-2029` interpolate raw user input into `$regex`. `re.escape()` it (category filter at `server.py:686` already does this correctly).
7. **Email-change OTP is never delivered** — `send_email_otp` (`server.py:1838-1849`) only logs the OTP; there is no email provider integration. Email change (`server.py:190-197`) is therefore impossible in production. Integrate an email sender or remove the flow.
8. **Cart response bypasses schema normalisation** — `cart.py:20-30` reads raw `product.get("price")`/`product.get("image")`; canonical products (having only `price_paise`/`image_url`) render with `price: null` and no image in the cart. Apply `clean_mongo_doc(product)` as `orders.py:180` does.
9. **`admin_update_product` 404s on no-op saves** — `server.py:1301` checks `modified_count` instead of `matched_count`; saving a product without changes shows "Product not found" in the portal.
10. **Account deletion leaves PII behind** — `server.py:1502-1513` deletes user/orders/cart but not `addresses`, `payment_methods`, `wishlists`, `notifications`, `loop_ledger`, `support_messages`. Relevant under India's DPDP Act.
11. **Starlette 0.37.2 (via FastAPI 0.110.1) is vulnerable to CVE-2024-47874** (multipart DoS). The Excel-upload endpoint accepts multipart. Upgrade FastAPI/Starlette. Also: `python-jose`/`ecdsa` are installed but unused (PyJWT is used) — remove them; `bcrypt` 3.2.2 is years old.
12. **CI `pull_request` trigger is broken** — `.github/workflows/build-apk.yml:5-7` nests `pull_request:` under `workflow_dispatch:`; PRs get no CI. Tests only run on push to main (after merge).
13. **Committed `frontend/google-services.json`** is still git-tracked (the recent .gitignore commits don't untrack it) including the Firebase Android API key (line 55). Low direct risk (this key ships in the APK anyway) but it contradicts the project's own CI design, which injects it from `GOOGLE_SERVICES_JSON`/`FIREBASE_API_KEY` secrets. `git rm --cached` it and rely on the CI path; restrict the key in Google Cloud console.
14. **Support flow is a dead end** — `/support/messages` (`server.py:1759-1785`) stores messages and returns canned keyword replies; there is no admin UI or notification to ever read them. For a 50k-household pilot you need at least an admin view + escalation path.
15. **Placeholder tests** — `tests/test_requested.py:7-21` and `backend/test_requested_mongomock.py` contain four empty `pass` tests each, inflating apparent coverage of exactly the risky areas (atomic rollback, CAS conflicts, ledger idempotency, stock expiry). Implement or delete.
16. **Rider status flow unordered** — `riders.py:191-233` lets a rider jump straight to `delivered` (which marks COD orders `paid`, `orders.py:64-65`). Enforce ordering; consider delivery OTP/photo proof for COD.

---

## MEDIUM PRIORITY (fix during pilot)

- **Scalability of admin analytics:** `kpis.py` loads up to 1,000 orders into memory per dashboard call (`kpis.py:10,60,94`); `/products/filters/options` loads 10,000 docs (`server.py:756`); `/products/analytics` loads all products (`server.py:812`). Convert to aggregations. Fine at pilot start, not at 50k users.
- **Rate limiter fallback is per-process memory** (`database.py:212,244-250`) — fine on single-instance Render, ineffective if you scale horizontally; set `REDIS_URL` in prod.
- **Startup exception swallowing** — `server.py:129-130`: if Mongo is unreachable at boot, indexes and background jobs are silently skipped but the app serves traffic anyway.
- **Rider earnings capped at last 200 delivered orders** (`riders.py:284-300`) — "all-time" figures go wrong after ~2 months of work.
- **Reconciliation checks only the last 100 Razorpay payments** (`payments.py:242`).
- **`get_products` `limit` param unbounded** (`server.py:677`) — `?limit=100000` fetches everything; clamp it.
- **Delivery-address geocoding uses free Nominatim inside the tracking WebView** (`frontend/app/order-tracking/[orderId].tsx:167`) — against Nominatim usage policy at volume, no API key, brittle; the quote-escaping on line 172 (`address.replace(/'/g, "\'")`) is a no-op — an address containing `'` breaks the map popup script.
- **Admin token in `localStorage`** (`admin-portal/src/services/api.js:15-18`, self-documented) — XSS-exfiltratable; move to HttpOnly cookie post-pilot.
- **Payment webhook ignores `payment.failed` / refund events** (`payments.py:158`) — failed payments rely solely on the 30-min expiry job.
- **`/videos` merges DB + YouTube RSS with a 10-min in-process cache** (`server.py:980-1050`) — fine, but the dedupe key is the *watch URL*, and DB videos with the same video in different URL formats will duplicate.
- **Encoding mojibake throughout `server.py`** (e.g., lines 68, 94-96, 1139, 1149, 1687, 1721) — `â¹`/`Ã¢ÂÂ¹` instead of ₹ in code comments *and in one user-facing string* (`server.py:1938`: coupon min-order error message). The UTF-8 middleware fixes response headers, not already-corrupted source literals.
- **`OrderCreate` legacy endpoint ignores client-sent items/totals** (good) but silently picks the user's *first* address (`orders.py:361-378`) — deprecate it.
- **README is a placeholder** ("Here are your Instructions"), and the app was scaffolded via Emergent (`.emergent/emergent.yml`) — documentation debt: CONTRACTS.md and the various implementation MDs are good, but onboarding docs are absent.
- **`admin/users/find` and `update-name` debug endpoints** (`server.py:2005-2029`) — admin-gated but regex-unescaped and clearly ad-hoc; remove before launch.
- **Frontend axios client has no response interceptor** (`frontend/utils/api.ts`) — 401s during use don't trigger an immediate refresh attempt; you rely on the 14-min timer and boot-time check.

---

## WHAT IS BUILT AND WORKS (genuine credit)

- **Auth stack:** email+password, phone OTP (Fast2SMS), Google Sign-In with real server-side ID-token verification incl. audience allowlist (`server.py:343-388`); token blacklisting on logout; refresh-token rotation (`server.py:264-331`); bcrypt hashing; mandatory `JWT_SECRET_KEY` (no insecure fallback).
- **Order pipeline:** cart (server-authoritative pricing — client-sent prices are ignored, prices frozen at order time, `orders.py:171-190`), atomic per-item stock reservation with rollback (`orders.py:117-140`), compensating-transaction rollback of the whole order on failure (`orders.py:263-345`), COD + prepaid flows, pending-payment TTL expiry job restoring stock (`background_jobs.py:54-100`), audit trail in `order_events`.
- **Payments:** real Razorpay order creation in paise, client checkout via WebView, signature verification (needs C1 hardening), webhook with signature verification in prod, refund reconciliation polling job.
- **GETV/cable-TV subsidy is genuinely implemented end-to-end** — not vaporware: STB validation/linking against a real GTPL dataset, monthly grant + month-end burn background jobs with IST-aware idempotency (`background_jobs.py:248-427`), tier-based redemption caps computed from real monthly paid spend (`loop_ledger.py:93-247`), full double-entry-style ledger, checkout integration with custom redemption amounts.
- **Rider system:** self-registration with admin approval gate, availability toggle, manual + nearest-available auto-assignment with capacity/queueing (`orders.py:457-595`), background GPS upload with offline retry queue (rider app), earnings screen, push notifications.
- **Admin:** portal (KPIs, orders, products, Excel import) + richer in-app admin screens (riders, offers, featured toggles); canonical product schema enforced by Pydantic (`models.py:72-112`) with a migration script and read-time legacy normalisation (`database.py:133-205`).
- **Ops/CI:** working docker-compose (Mongo, Redis, backend, nginx-fronted admin), real GitHub Actions pipeline (backend tests + lint + tsc + signed release APK + GitHub Release), secrets via GitHub Secrets, Sentry hooks on both backend and mobile.
- **Localization:** English/Hindi/Telugu translation files with a language context; ₹ used throughout; Tirupati-specific defaults (map center, pincode hints).
- **Tests:** 36 substantive backend tests (auth, cart, orders, stock, admin) running against real Mongo in CI.

---

## ARCHITECTURE VERDICT

The orchestration/middle layer **is present**, implemented as an in-frontend service layer rather than a standalone gateway:
- `frontend/constants/api.ts` — environment-driven base-URL resolution with dead-domain guards.
- `frontend/utils/api.ts` — the single axios client every screen imports; attaches the JWT from SecureStore via request interceptor.
- `frontend/context/AuthContext.tsx` — session bootstrap, scheduled token refresh, logout cleanup.
- `admin-portal/src/services/{api,auth,kpi,products}.js` — the same pattern for the web portal, plus a 401-redirect response interceptor, with `nginx.conf` proxying `/api/` to the backend in Docker.
- Rider app: `apiFetch` wrapper in `App.js:83-108` (timeout, 401 handling).

There is no dedicated BFF/gateway process, no Redis response caching, no websocket layer (tracking uses 10s polling with proper `clearInterval` cleanup, `order-tracking/[orderId].tsx:44-54`), and no offline sync beyond the rider's location retry queue. For one backend serving three thin clients at pilot scale, this is a defensible design, not a gap — the actual gaps are the security items above.

**Data-path traces (verified):**
- **Order placement:** checkout → `POST /orders/create[-pending]` → cart fetch → address + store-radius check → price freeze → stock reservation → order insert → (prepaid) `POST /payments/razorpay/create` → WebView → `POST /payments/razorpay/verify` → status `paid`, cart cleared, spend counters updated. COD confirms immediately.
- **Rider accept/deliver:** admin (auto-)assign → rider push notification → rider `POST /rider/order-status` → `transition_order_status` → customer push + in-app notification → queue promotion on `delivered`.
- **Admin product update:** portal `PUT /admin/products/{id}` → `$set` → customer app sees it on next fetch (no cache invalidation needed; no caching exists).
- **Subsidy:** GTPL STB link → immediate monthly grant → monthly cron grant/burn → tier-capped redemption at checkout → ledger row per movement.

---

## PILOT LAUNCH READINESS SCORECARD

| Flow | Status |
|---|---|
| Registration/login (Google + phone OTP + email) | ⚠️ PARTIAL — works, but C7 logs Google/OTP users out in ~30 min; C8 OTP abuse |
| Product catalog (categories, search, filters, compare) | ✅ READY (fix regex escaping) |
| Cart management | ⚠️ PARTIAL — works; H8 price/image nulls for canonical products |
| Address management | ⚠️ PARTIAL — works; C9 mass assignment |
| Checkout (summary, coupon, GETV, payment select) | ⚠️ PARTIAL — works; coupon reuse unlimited |
| Payment processing (Razorpay) | ❌ BLOCKED — C1/C4 must be fixed; keys must be live-mode |
| Order confirmation & tracking | ✅ READY (polling-based; Nominatim caveat) |
| Rider app receiving/accepting orders | ✅ READY (minimal but functional; ordering of statuses unenforced) |
| Admin portal (products/orders/KPIs) | ⚠️ PARTIAL — no coupon/store/support management UI |
| Cable-TV subsidy (GETV coins) | ❌ BLOCKED — C2/C3 make it free-money printer until fixed |
| Geofencing (Tirupati only) | ⚠️ PARTIAL — client-side only; server fail-open |
| Push notifications | ✅ READY (Expo push, order status events) |
| Customer support flow | ❌ MISSING in practice (no one can read the messages) |
| Refund & cancellation | ⚠️ PARTIAL — cancellation works (too permissively); refunds C6 |

**Scalability for 50k users:** products/orders queries are paginated and indexed (`server.py:85-104`); admin KPIs and filter options are not (memory-loading collections). No caching layer beyond a 10-min video cache; rate limiting Redis-backed when configured. Backend is stateless (horizontal scale OK) **except** the in-process background jobs (would duplicate across instances — needs a distributed lock or a single worker) and the in-memory rate-limit fallback. Render free tier (30s cold starts are already worked around in 3 places in client code) is **not** appropriate for the pilot — move to a paid always-on instance.

---

## PILOT LAUNCH CHECKLIST (ordered)

1. Fix C1: bind Razorpay order id + amount + captured status in `/payments/razorpay/verify` (payments.py:71).
2. Fix C2: remove MSO fallback secret; allowlist `mso_id`; idempotency on `user:month` (loop_ledger.py:75,501).
3. Fix C3: purge `data/stb_numbers.txt` from repo + history; add second factor to STB linking.
4. Fix C4: make production behavior the default for all `ENV` gates (payments.py:87,137; server.py:110,1189,2038).
5. Fix C7: 30-day expiry on Google/OTP refresh tokens (server.py:438,1888).
6. Fix C5: rate-limit + lockout on `/admin/login` (server.py:1206).
7. Fix C6: stop recording failed Razorpay refunds as processed (payments.py:204).
8. Fix C8: per-phone OTP send/verify limits; fail hard if SMS provider unconfigured in prod.
9. Fix C9: Pydantic models for addresses/payment methods; forbid client-sent `user_id`/`id`.
10. Server-side Tirupati geofence in `create_order_core`; seed `db.stores` with real dark-store coords/radii and make the check fail-closed.
11. Coupon usage tracking (per-user + global limits).
12. Atomic GETV debit; order idempotency keys; order state-machine validation.
13. Upgrade FastAPI/Starlette (CVE-2024-47874); drop python-jose/ecdsa; `git rm --cached frontend/google-services.json`.
14. Fix the `pull_request` trigger in build-apk.yml so CI runs on PRs.
15. Cart product normalisation (cart.py:20) and `admin_update_product` matched_count fix (server.py:1301).
16. Minimum support loop: admin page or email/Slack forward for `support_messages`; publish a support phone number in-app.
17. Move backend off Render free tier; set all env vars (`ENV=production`, `ALLOWED_ORIGINS`, `MSO_SHARED_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `FAST2SMS_API_KEY`, `REDIS_URL`, `SENTRY_DSN`); switch Razorpay to live keys; run a ₹1 end-to-end payment + refund test.
18. Implement the four placeholder tests (rollback, CAS, ledger idempotency, stock expiry) — they cover exactly the money paths.
19. Account-deletion completeness (all user collections) for DPDP hygiene.
20. Load-test the KPI dashboard and product listing with 50k-user-scale data; convert KPI queries to aggregations.

---

*Secondary repo note — `Grocerease-Rider`: single-file Expo app (`App.js`, 704 lines) hitting the same backend; no secrets committed; production log-gating recently added; its own APK CI workflow. Main risks are inherited from the backend (rider status ordering, token expiry 12h with no refresh — riders re-login daily, acceptable). The repo also duplicates its `assets/` tree (`assets/assets/*`) — cosmetic.*
