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
            # Roll back stock for each line item
            for item in order.get("items", []):
                await db.products.update_one(
                    {"id": item["product_id"]},
                    {"$inc": {"stock": item.get("quantity", 0)}},
                )

            # Cancel the order (reuses existing state-machine helper)
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
    """Launch both background jobs as asyncio tasks."""
    asyncio.create_task(_stock_expiry_loop())
    asyncio.create_task(_recon_loop())
    logger.info("Background jobs scheduled: stock-expiry + payments-recon")


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
