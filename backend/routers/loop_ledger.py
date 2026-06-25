"""
routers/loop_ledger.py â LOOP credit double-entry ledger (Tasks 15 & 25)

Design
------
Every LOOP credit movement is recorded as a ledger row:
  credit  (+)  â earn from order cashback, cable-TV spend, admin manual
  debit   (-)  â redeem at checkout

The canonical balance is users.loop_balance_paise (float, â¹).
The ledger is the audit trail; the user field is the operational balance.

Both are updated atomically in the same async call; they can diverge only
on a mid-flight crash, which the admin /admin/loop/recalc endpoint can fix.

Task 25: MSO stub
  POST /api/mso/spend-signal  â cable operator (MSO) calls this when a
  subscriber's monthly bill is settled. GrocerEase issues 2% of cable spend
  as LOOP credits. Real MSO API authentication is a TODO (stub uses a shared
  secret header for now).

CONTRACTS.md Â§10 â LOOP Ledger (added in this PR)
"""

import uuid
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from database import db, get_current_user, verify_admin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["LOOP Ledger"])

# âââ Constants ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
LOOP_EARN_PERCENT_CABLE_TV = 0.02   # 2% of cable-TV monthly spend
MAX_REDEEM_FRACTION        = 0.50   # Pilot cap: max 50% of order total payable with LOOP
MSO_SHARED_SECRET          = "grocerease-mso-pilot-2024"  # TODO: move to env var

# âââ Pydantic models ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
class AdminCreditRequest(BaseModel):
    user_id: str
    amount: float  # in ₹
    description: str = "Admin manual credit"

class MsoSpendSignal(BaseModel):
    user_id: str
    mso_id: str                   # e.g. "tataplay", "airtel_dth"
    amount_spent: float           # monthly cable bill in â¹
    billing_month: str            # "2024-06", "2024-07"

# âââ Core ledger helpers (called by orders.py too) âââââââââââââââââââââââââââ

async def credit_loop_balance_paise(
    user_id: str,
    amount_paise: int,
    reference_type: str,
    reference_id: str,
    description: str,
) -> float:
    """
    Add `amount` LOOP credits to user balance.
    Returns the new balance.
    Inserts one ledger row (type=credit).
    """
    if amount_paise <= 0:
        return await _get_balance(user_id)

    # Increment atomically; $inc creates the field if absent
    result = await db.users.find_one_and_update(
        {"id": user_id},
        {"$inc": {"loop_balance_paise": amount_paise}},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    new_balance = round(result.get("loop_balance_paise", 0.0), 2)
    await _insert_row(user_id, "credit", amount_paise, new_balance, reference_type, reference_id, description)
    logger.info("LOOP credit +%.2f for user %s (ref %s %s) â balance %.2f",
                amount_paise, user_id, reference_type, reference_id, new_balance)
    return new_balance


async def debit_loop_balance_paise(
    user_id: str,
    amount_paise: int,
    reference_type: str,
    reference_id: str,
    description: str,
) -> float:
    """
    Deduct `amount` LOOP credits from user balance.
    Raises 400 if balance insufficient.
    Returns the new balance.
    """
    if amount_paise <= 0:
        return await _get_balance(user_id)

    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    current = round(user.get("loop_balance_paise", 0.0), 2)
    if current < amount_paise:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient LOOP balance: have â¹{current:.2f}, need â¹{amount_paise:.2f}",
        )

    result = await db.users.find_one_and_update(
        {"id": user_id},
        {"$inc": {"loop_balance_paise": -amount_paise}},
        return_document=True,
    )
    new_balance = round(result.get("loop_balance_paise", 0.0), 2)
    await _insert_row(user_id, "debit", amount_paise, new_balance, reference_type, reference_id, description)
    logger.info("LOOP debit -%.2f for user %s (ref %s %s) â balance %.2f",
                amount_paise, user_id, reference_type, reference_id, new_balance)
    return new_balance


async def _get_balance(user_id: str) -> float:
    user = await db.users.find_one({"id": user_id})
    return round((user or {}).get("loop_balance_paise", 0.0), 2)


async def _insert_row(
    user_id: str, txn_type: str, amount_paise: int, balance_after_paise: int,
    reference_type: str, reference_id: str, description: str,
):
    await db.loop_ledger.insert_one({
        "id":             str(uuid.uuid4()),
        "user_id":        user_id,
        "type":           txn_type,            # "credit" | "debit"
        "amount":         amount_paise,
        "balance_after":  balance_after_paise,
        "reference_type": reference_type,      # "order_earn" | "order_redeem" | "admin_credit" | "cable_tv_earn"
        "reference_id":   reference_id,
        "description":    description,
        "created_at":     datetime.utcnow(),
    })

# âââ Customer endpoints âââââââââââââââââââââââââââââââââââââââââââââââââââââââ

@router.get("/user/loop-balance")
async def get_loop_balance_paise(user_id: str = Depends(get_current_user)):
    """Return current LOOP credit balance for the logged-in user."""
    balance = await _get_balance(user_id)
    return {"loop_balance": round(balance / 100, 2) if balance else 0.0}


@router.get("/user/loop-ledger")
async def get_loop_ledger(
    limit: int = 20,
    skip: int = 0,
    user_id: str = Depends(get_current_user),
):
    """Return paginated LOOP transaction history (newest first)."""
    rows = await db.loop_ledger.find({"user_id": user_id}) \
        .sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.loop_ledger.count_documents({"user_id": user_id})
    for r in rows:
        r.pop("_id", None)
    return {"rows": rows, "total": total, "has_more": (skip + limit) < total}


# âââ Admin endpoints âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

@router.post("/admin/loop/credit")
async def admin_credit_loop(
    req: AdminCreditRequest,
    _admin_id: str = Depends(verify_admin),
):
    """Manually credit LOOP balance to a user (e.g. goodwill, promo)."""
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    new_balance = await credit_loop_balance_paise(
        req.user_id, int(req.amount * 100),
        reference_type="admin_credit",
        reference_id=f"admin-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        description=req.description,
    )
    return {"success": True, "new_balance": round(new_balance / 100, 2)}


@router.post("/admin/loop/recalc/{user_id}")
async def recalc_loop_balance_paise(
    user_id: str,
    _admin_id: str = Depends(verify_admin),
):
    """
    Recompute loop_balance_paise from ledger rows (reconciliation / crash-recovery).
    Credits - Debits = correct balance. Updates users.loop_balance_paise.
    """
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$type",
            "total": {"$sum": "$amount_paise"}
        }}
    ]
    agg = await db.loop_ledger.aggregate(pipeline).to_list(10)
    totals = {row["_id"]: row["total"] for row in agg}
    correct = round(totals.get("credit", 0.0) - totals.get("debit", 0.0), 2)
    await db.users.update_one({"id": user_id}, {"$set": {"loop_balance_paise": correct}})
    return {"user_id": user_id, "recalculated_balance": correct}


# âââ Task 25: MSO spend-signal stub ââââââââââââââââââââââââââââââââââââââââââ

@router.post("/mso/spend-signal")
async def mso_spend_signal(
    payload: MsoSpendSignal,
    x_mso_secret: Optional[str] = Header(default=None),
):
    """
    Cable-TV MSO webhook: issue LOOP credits when a subscriber's monthly
    cable bill is settled.

    Auth: shared secret in X-Mso-Secret header (pilot stub).
    TODO: Replace with per-MSO OAuth2 or signed JWT before launch.

    Credit rate: 2% of cable-TV monthly spend (LOOP_EARN_PERCENT_CABLE_TV).
    Idempotency: reference_id = '{user_id}:{mso_id}:{billing_month}' â
    duplicate calls for the same month are ignored.
    """
    if x_mso_secret != MSO_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid MSO secret")

    if payload.amount_spent <= 0:
        raise HTTPException(status_code=400, detail="amount_spent must be positive")

    # Idempotency key
    ref_id = f"{payload.user_id}:{payload.mso_id}:{payload.billing_month}"
    existing = await db.loop_ledger.find_one({"reference_id": ref_id})
    if existing:
        return {
            "success": True,
            "message": "Already processed",
            "loop_credits_issued": existing["amount_paise"],
        }

    loop_amount = round(payload.amount_spent * LOOP_EARN_PERCENT_CABLE_TV, 2)
    new_balance = await credit_loop_balance_paise(
        payload.user_id,
        loop_amount_paise,
        reference_type="cable_tv_earn",
        reference_id=ref_id,
        description=f"Cable-TV cashback: â¹{payload.amount_spent:.0f} bill with {payload.mso_id} ({payload.billing_month})",
    )
    return {
        "success": True,
        "loop_credits_issued": loop_amount_paise,
        "new_balance": new_balance,
        "message": f"Issued â¹{loop_amount_paise:.2f} LOOP credits for â¹{payload.amount_spent:.0f} cable bill",
    }
