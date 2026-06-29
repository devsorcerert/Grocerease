"""
routers/background_jobs.py — Periodic background jobs (Tasks 17 & 24)

Job 1 (Task 17): Stock-reservation expiry
  Orders with status=pending_payment older than PENDING_PAYMENT_TTL_MINUTES have
  their stock rolled back and are marked cancelled/expired.
  Runs every EXPIRY_CHECK_INTERVAL_SECONDS seconds.

Job 2 (Task 24): Payments reconciliation
  Orders with payment_status=refund_pending are polled against Razorpay to see
  if the refund completed, then marked refunded.
  Runs every RECON_CHECK_INTERVAL_SECONDS seconds.

Both jobs are launched as asyncio tasks from the FastAPI startup event.
No external scheduler dependency — uses asyncio.create_task + sleep loop.
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

import razorpay
from fastapi import APIRouter, Depends, HTTPException
from database import db, get_current_user, verify_admin, clean_mongo_doc
from routers.orders import transition_order_status

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Background Jobs"])

# ─── Configuration ─────────────────────────────────────────────────────────
PENDING_PAYMENT_TTL_MINUTES   = int(os.environ.get("PENDING_PAYMENT_TTL_MINUTES", "30"))
EXPIRY_CHECK_INTERVAL_SECONDS = int(os.environ.get("EXPIRY_CHECK_INTERVAL_SECONDS", "300"))   # 5 min
RECON_CHECK_INTERVAL_SECONDS  = int(os.environ.get("RECON_CHECK_INTERVAL_SECONDS",  "600"))   # 10 min

RAZORPAY_KEY_ID     = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")

def _rzp_client():
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        try:
            return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        except Exception as e:
            logger.error("Razorpay client init failed: %s", e)
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# Task 17 — Stock-reservation expiry
# ═══════════════════════════════════════════════════════════════════════════════

async def expire_stale_pending_orders() -> int:
    """
    Find orders stuck in pending_payment older than TTL, roll back stock,
    and mark them cancelled.

    Returns: number of orders expired in this run.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=PENDING_PAYMENT_TTL_MINUTES)
    stale = await db.orders.find({
        "status": "pending_payment",
        "payment_status": "pending",
        "created_at": {"$lt": cutoff},
    }).to_list(200)

    expired_count = 0
    for order in stale:
        order_id = order["id"]
        try:
            # Cancel the order — transition_order_status handles stock rollback
            await transition_order_status(
                order_id, "cancelled", "system",
                f"Auto-expired: payment not received within {PENDING_PAYMENT_TTL_MINUTES} minutes",
            )
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"payment_status": "expired", "expired_at": datetime.utcnow()}},
            )
            expired_count += 1
            logger.info("Order %s expired — stock rolled back (%d items)", order_id, len(order.get("items", [])))
        except Exception as e:
            logger.error("Failed to expire order %s: %s", order_id, e)

    if expired_count:
        logger.info("Expiry job: %d order(s) expired this run", expired_count)
    return expired_count


async def _stock_expiry_loop():
    """Infinite loop — runs expire_stale_pending_orders on schedule."""
    logger.info("Stock-expiry job started (TTL=%dm, interval=%ds)",
                PENDING_PAYMENT_TTL_MINUTES, EXPIRY_CHECK_INTERVAL_SECONDS)
    while True:
        try:
            await expire_stale_pending_orders()
        except Exception as e:
            logger.error("Stock-expiry loop error: %s", e)
        await asyncio.sleep(EXPIRY_CHECK_INTERVAL_SECONDS)


# ═══════════════════════════════════════════════════════════════════════════════
# Task 24 — Payments reconciliation
# ═══════════════════════════════════════════════════════════════════════════════

async def reconcile_refunds() -> int:
    """
    Poll Razorpay for refund status on orders with payment_status=refund_pending.
    If Razorpay reports the refund processed, mark the order refunded.

    Returns: number of refunds confirmed in this run.
    """
    pending_refunds = await db.orders.find({
        "payment_status": "refund_pending",
    }).to_list(100)

    rzp = _rzp_client()
    confirmed = 0

    for order in pending_refunds:
        order_id = order["id"]
        rzp_order_id = order.get("razorpay_order_id", "")

        # Skip mock orders — no real Razorpay to query
        if rzp_order_id.startswith("rzp_mock_") or not rzp_order_id:
            logger.debug("Recon: skipping mock/missing Razorpay order for %s", order_id)
            continue

        if not rzp:
            logger.warning("Recon: Razorpay client unavailable, skipping order %s", order_id)
            continue

        try:
            payments = rzp.order.payments(rzp_order_id)
            for pmt in (payments.get("items") or []):
                pmt_id = pmt.get("id")
                if not pmt_id:
                    continue
                refunds = rzp.payment.refunds(pmt_id)
                for ref in (refunds.get("items") or []):
                    if ref.get("status") == "processed":
                        await transition_order_status(
                            order_id, "refunded", "system",
                            f"Razorpay refund {ref['id']} confirmed by reconciliation cron",
                        )
                        await db.orders.update_one(
                            {"id": order_id},
                            {"$set": {
                                "payment_status": "refunded",
                                "refund_id": ref["id"],
                                "refunded_at": datetime.utcnow(),
                                "refund_amount": ref.get("amount", 0) / 100,
                            }},
                        )
                        confirmed += 1
                        logger.info("Recon: refund %s confirmed for order %s", ref["id"], order_id)
                        break   # one processed refund is enough
        except Exception as e:
            logger.error("Recon error for order %s: %s", order_id, e)

    if confirmed:
        logger.info("Recon job: %d refund(s) confirmed this run", confirmed)
    return confirmed


async def _recon_loop():
    """Infinite loop — runs reconcile_refunds on schedule."""
    logger.info("Payments-recon job started (interval=%ds)", RECON_CHECK_INTERVAL_SECONDS)
    while True:
        try:
            await reconcile_refunds()
        except Exception as e:
            logger.error("Recon loop error: %s", e)
        await asyncio.sleep(RECON_CHECK_INTERVAL_SECONDS)


# ─── Public launcher (called from server.py startup event) ────────────────────
def start_background_jobs():
    """Launch all background jobs as asyncio tasks."""
    asyncio.create_task(_stock_expiry_loop())
    asyncio.create_task(_recon_loop())
    asyncio.create_task(_loop_burn_loop())  # Sprint A.5 Fix 1 — LOOP month-end burn
    logger.info("Background jobs scheduled: stock-expiry + payments-recon + LOOP-burn")


# ═══════════════════════════════════════════════════════════════════════════════
# Task 24 — Customer refund-status view
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/user/orders/{order_id}/refund-status")
async def get_refund_status(
    order_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Return the refund status for a customer's order.
    Only the order owner can query this.
    """
    order = await db.orders.find_one({"id": order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment_status = order.get("payment_status", "pending")
    refundable_statuses = {"refund_pending", "refunded"}

    if payment_status not in refundable_statuses:
        return {
            "order_id": order_id,
            "payment_status": payment_status,
            "refund_eligible": False,
            "message": "This order is not in a refund state.",
        }

    return {
        "order_id": order_id,
        "payment_status": payment_status,
        "refund_eligible": True,
        "refund_id": order.get("refund_id"),
        "refund_amount": order.get("refund_amount"),
        "refunded_at": order.get("refunded_at"),
        "message": (
            "Refund processed successfully."
            if payment_status == "refunded"
            else "Refund is being processed. This may take 5–7 business days."
        ),
    }


# ─── Admin endpoints for manual job triggers ─────────────────────────────────

@router.post("/admin/jobs/expire-pending-orders")
async def trigger_expiry(_admin=Depends(verify_admin)):
    """Manually trigger the stock-expiry job (useful for testing/ops)."""
    count = await expire_stale_pending_orders()
    return {"expired_orders": count}


@router.post("/admin/jobs/reconcile-refunds")
async def trigger_recon(_admin=Depends(verify_admin)):
    """Manually trigger the refunds reconciliation job."""
    count = await reconcile_refunds()
    return {"refunds_confirmed": count}



# ═══════════════════════════════════════════════════════════════════════════════
# Sprint A.5 Fix 1 — LOOP month-end coin burn
# ═══════════════════════════════════════════════════════════════════════════════
# PILOT SIMPLIFICATION (documented):
#   A credit arriving before the burn in the same calendar month causes
#   July leftover coins to merge into the August balance under one field.
#   Impact bounded by tier ceiling (1,000 coins/month max). Deferred to R3.
#   loop_balance_month field is SET here and in credit_loop_balance_paise
#   (loop_ledger.py) — see Fix 3 for the link-trigger credit path.
# Units: all balances in paise. 1,000 GETV coins = 100,000 paise.

LOOP_BURN_CHECK_INTERVAL_SECONDS = int(
    os.environ.get("LOOP_BURN_CHECK_INTERVAL_SECONDS", "3600")  # hourly
)


async def burn_loop_coins() -> dict:
    """
    Zero out loop_balance_paise for users whose coins belong to a prior
    calendar month (loop_balance_month < current_month, $lt on YYYY-MM string).

    Idempotent: loop_burn_log keyed on prior_month; only first post-boundary
    call does real work. Safe across hourly loop and server restarts.
    No grace window: burn keys strictly off the month boundary.
    """
    now = datetime.utcnow() + timedelta(hours=5, minutes=30)   # IST (UTC+5:30) — burn keys off the IST month boundary
    current_month = now.strftime("%Y-%m")                           # e.g. "2026-07"
    prior_month   = (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")  # e.g. "2026-06"

    # ── Idempotency guard ────────────────────────────────────────────────────
    existing = await db.loop_burn_log.find_one({"billing_month": prior_month})
    if existing:
        logger.info("LOOP burn: %s already burned at %s — skipping",
                    prior_month, existing.get("burned_at"))
        return {"burned_users": 0, "month": prior_month, "skipped": True}

    # ── Burn: zero balances where loop_balance_month < current_month ─────────
    # $lt on "YYYY-MM" strings is correct: lexicographic == chronological.
    # Same-month credit sets loop_balance_month == current_month → $lt fails →
    # fresh coins are never wiped (race-safe in both orderings).
    result = await db.users.update_many(
        {
            "loop_balance_paise":  {"$gt": 0},
            "loop_balance_month":  {"$lt": current_month},  # prior-month stale coins
        },
        {
            "$set": {
                "loop_balance_paise":          0,   # paise — zeroed
                "loop_monthly_redeemed_paise": 0,   # paise — reset monthly counter
                "loop_monthly_period":         "",  # reset period string
            }
        },
    )
    burned = result.modified_count

    # ── Write idempotency log ────────────────────────────────────────────────
    await db.loop_burn_log.insert_one({
        "billing_month": prior_month,  # "YYYY-MM" of the month whose coins burned
        "burned_at":     now,          # UTC
        "burned_users":  burned,
        "run_by":        "system",     # "admin" when triggered manually
    })
    logger.info("LOOP burn: zeroed %d balance(s) for month %s (paise)",
                burned, prior_month)
    return {"burned_users": burned, "month": prior_month}


async def _loop_burn_loop():
    """Hourly infinite loop. Idempotency inside burn_loop_coins() ensures
    only the first post-boundary call in each month does real work."""
    logger.info("LOOP burn loop started (interval=%ds)",
                LOOP_BURN_CHECK_INTERVAL_SECONDS)
    while True:
        try:
            await burn_loop_coins()
        except Exception as e:
            logger.error("LOOP burn loop error: %s", e, exc_info=True)
        await asyncio.sleep(LOOP_BURN_CHECK_INTERVAL_SECONDS)


@router.post("/admin/jobs/burn-loop-coins")
async def trigger_loop_burn(_admin=Depends(verify_admin)):
    """
    Manually trigger the LOOP month-end coin burn.
    Idempotent — safe to call multiple times; second call returns skipped:true.
    To force re-run in testing: delete db.loop_burn_log entry for that month.
    """
    result = await burn_loop_coins()
    # Record manual trigger in log (update run_by if log was just written)
    await db.loop_burn_log.update_one(
        {"billing_month": result.get("month")},
        {"$set": {"run_by": "admin"}},
    )
    return result
