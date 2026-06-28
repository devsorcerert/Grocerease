"""
routers/loop_ledger.py — GETV Coins / LOOP Ledger

GETV Rewards System
-------------------
EARNING (monthly credit):
  • 1,000 GETV coins credited every month when cable TV + broadband bill ≥ ₹1,000
  • Triggered by MSO spend-signal webhook (POST /mso/spend-signal)
  • Idempotent — one credit per user per billing_month
  • Auto-suspended if no bill received for 2 consecutive calendar months
  • On unlink: suspension state reset, future credits stop, balance preserved

REDEMPTION (tier-based, monthly, non-cumulative):
  Qualifying spend = sum of paid Grocerease orders in current calendar month
  ─────────────────────────────────────────────────────────────
  Tier       Monthly Spend       Max Redeemable / month
  ─────────────────────────────────────────────────────────────
  Base       < ₹7,000            0 coins  (cannot redeem)
  Silver     ₹7,000 – ₹12,999   250 coins  (₹250)
  Gold       ₹13,000 – ₹24,999  500 coins  (₹500)
  Platinum   ₹25,000+           1,000 coins (₹1,000)
  ─────────────────────────────────────────────────────────────
  • Tiers reset on 1st of each calendar month (non-cumulative)
  • Monthly redemption counter tracks coins used this month
  • Available to redeem = min(wallet_balance, tier_max − already_redeemed_this_month)
  • 1 GETV coin = ₹1

GADGET REWARD:
  • ₹70,000 total spend in 6 months from date of first purchase (fixed window, not rolling)
  • Admin manages gadget fulfilment manually; backend tracks eligibility flag

User document fields (added by this module):
  loop_balance_paise          — wallet balance in paise (operational)
  loop_monthly_redeemed_paise — coins redeemed this calendar month (paise)
  loop_monthly_period         — "YYYY-MM" string for which month the above is for
  loop_last_bill_month        — "YYYY-MM" of last received cable bill
  loop_consecutive_no_bill    — consecutive months with no cable bill
  loop_suspended              — True if auto-credit suspended (≥2 no-bill months)
  loop_gadget_eligible        — True once total_spend_6m >= ₹70,000
  first_purchase_date         — set on first paid order (for gadget window)
  total_spend_paise           — cumulative lifetime spend (existing field)
"""

import uuid
import logging
from calendar import monthrange
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from database import db, get_current_user, verify_admin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["LOOP Ledger"])

# ── Constants ──────────────────────────────────────────────────────────────────
MONTHLY_COIN_CREDIT         = 1000          # GETV coins credited each month (₹1,000 value)
MIN_CABLE_BILL_FOR_CREDIT   = 1000_00       # ₹1,000 minimum monthly cable+broadband bill (paise)
SUSPENSION_THRESHOLD        = 2             # consecutive months of no-bill → suspend

# Spending tiers: (min_spend_paise, max_redeemable_paise, tier_name)
SPEND_TIERS = [
    (25_000_00, 1_000_00, "Platinum"),   # ₹25,000+ → 1,000 coins
    (13_000_00,   500_00, "Gold"),       # ₹13,000+ → 500 coins
    ( 7_000_00,   250_00, "Silver"),     # ₹7,000+  → 250 coins
    (         0,       0, "Base"),       # < ₹7,000 → 0 coins
]

GADGET_THRESHOLD_PAISE      = 70_000_00     # ₹70,000 in 6 months
GADGET_WINDOW_MONTHS        = 6

MSO_SHARED_SECRET           = "grocerease-mso-pilot-2024"  # TODO: move to env var

# ── Pydantic models ────────────────────────────────────────────────────────────
class AdminCreditRequest(BaseModel):
    user_id: str
    amount: float       # in ₹
    description: str = "Admin manual credit"

class MsoSpendSignal(BaseModel):
    user_id: str
    mso_id: str           # e.g. "gtpl", "hathway", "tataplay"
    cable_spend: float    # cable TV bill in ₹
    broadband_spend: float = 0.0   # broadband bill in ₹ (optional)
    billing_month: str    # "2024-06"


# ── Tier helper ────────────────────────────────────────────────────────────────

def get_tier(monthly_spend_paise: int) -> dict:
    """Return tier info for the given monthly Grocerease spend (paise)."""
    for min_sp, max_redeem, name in SPEND_TIERS:
        if monthly_spend_paise >= min_sp:
            return {
                "tier_name": name,
                "min_spend": round(min_sp / 100, 2),
                "max_redeemable_paise": max_redeem,
                "max_redeemable": round(max_redeem / 100, 2),
            }
    return {"tier_name": "Base", "min_spend": 0, "max_redeemable_paise": 0, "max_redeemable": 0}


def current_month_str() -> str:
    return datetime.utcnow().strftime("%Y-%m")


async def _get_monthly_spend_paise(user_id: str) -> int:
    """Sum of all paid orders for this user in the current calendar month (paise)."""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    _, last_day = monthrange(now.year, now.month)
    month_end = datetime(now.year, now.month, last_day, 23, 59, 59)

    pipeline = [
        {"$match": {
            "user_id": user_id,
            "payment_status": "paid",
            "created_at": {"$gte": month_start, "$lte": month_end},
        }},
        # orders.total is stored in rupees (float); multiply by 100 to return paise
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]
    result = await db.orders.aggregate(pipeline).to_list(1)
    if result:
        return int(round(result[0].get("total", 0) * 100))
    return 0


async def _get_monthly_redeemed_paise(user_id: str) -> int:
    """How many GETV coins (paise) the user has already redeemed this calendar month."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return 0
    stored_period = user.get("loop_monthly_period", "")
    if stored_period != current_month_str():
        return 0   # counter is from a previous month — treat as 0
    return int(user.get("loop_monthly_redeemed_paise", 0))


# ── Core ledger helpers (called by orders.py too) ─────────────────────────────

async def credit_loop_balance_paise(
    user_id: str,
    amount_paise: int,
    reference_type: str,
    reference_id: str,
    description: str,
) -> int:
    """Credit LOOP balance. Returns new balance in paise. Inserts ledger row."""
    if amount_paise <= 0:
        return await _get_balance_paise(user_id)

    result = await db.users.find_one_and_update(
        {"id": user_id},
        {"$inc": {"loop_balance_paise": amount_paise}},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    new_balance_paise = int(result.get("loop_balance_paise", 0))
    await _insert_row(user_id, "credit", amount_paise, new_balance_paise,
                      reference_type, reference_id, description)
    logger.info("GETV credit +₹%.2f for user %s → balance ₹%.2f",
                amount_paise / 100, user_id, new_balance_paise / 100)
    return new_balance_paise


async def debit_loop_balance_paise(
    user_id: str,
    amount_paise: int,
    reference_type: str,
    reference_id: str,
    description: str,
) -> int:
    """
    Debit LOOP balance. Validates tier eligibility and monthly limit before deducting.
    Returns new balance in paise.
    """
    if amount_paise <= 0:
        return await _get_balance_paise(user_id)

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    # Check wallet balance
    current_balance = int(user.get("loop_balance_paise", 0))
    if current_balance < amount_paise:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient GETV balance: have ₹{current_balance/100:.2f}, need ₹{amount_paise/100:.2f}",
        )

    # Check monthly spend tier
    monthly_spend = await _get_monthly_spend_paise(user_id)
    tier = get_tier(monthly_spend)
    tier_max = tier["max_redeemable_paise"]

    if tier_max == 0:
        raise HTTPException(
            status_code=400,
            detail=f"You need to spend ₹7,000 this month to start redeeming GETV coins. "
                   f"Current month spend: ₹{monthly_spend/100:.2f}",
        )

    # Check monthly redemption limit
    already_redeemed = await _get_monthly_redeemed_paise(user_id)
    remaining_allowance = tier_max - already_redeemed
    if amount_paise > remaining_allowance:
        raise HTTPException(
            status_code=400,
            detail=f"Monthly redemption limit reached. "
                   f"Tier: {tier['tier_name']} (max ₹{tier_max/100:.0f}/month). "
                   f"Already redeemed: ₹{already_redeemed/100:.2f}. "
                   f"Remaining: ₹{remaining_allowance/100:.2f}",
        )

    # All checks pass — deduct from wallet
    result = await db.users.find_one_and_update(
        {"id": user_id},
        {
            "$inc": {
                "loop_balance_paise": -amount_paise,
                "loop_monthly_redeemed_paise": amount_paise,
            },
            "$set": {"loop_monthly_period": current_month_str()},
        },
        return_document=True,
    )
    new_balance_paise = int(result.get("loop_balance_paise", 0))
    await _insert_row(user_id, "debit", amount_paise, new_balance_paise,
                      reference_type, reference_id, description)
    logger.info("GETV debit -₹%.2f for user %s → balance ₹%.2f",
                amount_paise / 100, user_id, new_balance_paise / 100)
    return new_balance_paise


# ── Rupee-based aliases (used by orders.py) ───────────────────────────────────

async def credit_loop_balance(user_id, amount, reference_type, reference_id, description):
    """Credit in rupees. Returns new balance in rupees."""
    paise = int(round(amount * 100))
    new_paise = await credit_loop_balance_paise(user_id, paise, reference_type, reference_id, description)
    return round(new_paise / 100, 2)


async def debit_loop_balance(user_id, amount, reference_type, reference_id, description):
    """Debit in rupees. Returns new balance in rupees."""
    paise = int(round(amount * 100))
    new_paise = await debit_loop_balance_paise(user_id, paise, reference_type, reference_id, description)
    return round(new_paise / 100, 2)


async def _get_balance_paise(user_id: str) -> int:
    user = await db.users.find_one({"id": user_id})
    return int((user or {}).get("loop_balance_paise", 0))


async def _insert_row(user_id, txn_type, amount_paise, balance_after_paise,
                      reference_type, reference_id, description):
    await db.loop_ledger.insert_one({
        "id":             str(uuid.uuid4()),
        "user_id":        user_id,
        "type":           txn_type,
        "amount":         round(amount_paise / 100, 2),
        "balance_after":  round(balance_after_paise / 100, 2),
        "reference_type": reference_type,
        "reference_id":   reference_id,
        "description":    description,
        "created_at":     datetime.utcnow(),
    })


# ── Gadget eligibility helper ─────────────────────────────────────────────────

async def check_gadget_eligibility(user_id: str):
    """
    Check if user has spent ₹70,000 within 6 months of their first purchase.
    Updates loop_gadget_eligible flag if threshold crossed.
    """
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    if user.get("loop_gadget_eligible"):
        return   # already flagged, no need to recheck

    first_purchase = user.get("first_purchase_date")
    if not first_purchase:
        return

    if isinstance(first_purchase, str):
        first_purchase = datetime.fromisoformat(first_purchase)

    window_end = datetime(
        first_purchase.year + (first_purchase.month + GADGET_WINDOW_MONTHS - 1) // 12,
        (first_purchase.month + GADGET_WINDOW_MONTHS - 1) % 12 + 1,
        1,
    )

    pipeline = [
        {"$match": {
            "user_id": user_id,
            "payment_status": "paid",
            "created_at": {"$gte": first_purchase, "$lte": window_end},
        }},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]
    result = await db.orders.aggregate(pipeline).to_list(1)
    total_spend = result[0].get("total", 0) if result else 0  # rupees

    if int(round(total_spend * 100)) >= GADGET_THRESHOLD_PAISE:  # convert rupees→paise
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"loop_gadget_eligible": True}},
        )
        logger.info("User %s qualified for gadget reward (₹70k in 6 months)", user_id)


# ── Customer API endpoints ─────────────────────────────────────────────────────

@router.get("/user/loop-balance")
async def get_loop_balance(user_id: str = Depends(get_current_user)):
    balance_paise = await _get_balance_paise(user_id)
    return {"loop_balance": round(balance_paise / 100, 2)}


@router.get("/user/loop-eligibility")
async def get_loop_eligibility(user_id: str = Depends(get_current_user)):
    """
    Returns the user's current GETV coin redemption eligibility for this month.
    Used by checkout to show/hide the LOOP redemption toggle.
    """
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    balance_paise   = int(user.get("loop_balance_paise", 0))
    suspended       = user.get("loop_suspended", False)
    cable_linked    = user.get("cable_tv_linked", False)
    gadget_eligible = user.get("loop_gadget_eligible", False)

    monthly_spend_paise   = await _get_monthly_spend_paise(user_id)
    already_redeemed_paise = await _get_monthly_redeemed_paise(user_id)
    tier                  = get_tier(monthly_spend_paise)
    tier_max_paise        = tier["max_redeemable_paise"]
    remaining_allowance   = max(0, tier_max_paise - already_redeemed_paise)
    available_to_redeem   = min(balance_paise, remaining_allowance)

    # Next tier info (to show progress bar in UI)
    next_tier = None
    for min_sp, max_r, name in SPEND_TIERS:
        if min_sp > monthly_spend_paise:
            next_tier = {
                "name": name,
                "spend_needed": round((min_sp - monthly_spend_paise) / 100, 2),
                "unlocks": round(max_r / 100, 2),
            }
    if tier["tier_name"] == "Platinum":
        next_tier = None   # already at top

    return {
        "cable_linked":           cable_linked,
        "coins_suspended":        suspended,
        "balance":                round(balance_paise / 100, 2),
        "current_month_spend":    round(monthly_spend_paise / 100, 2),
        "tier":                   tier["tier_name"],
        "tier_max_redeemable":    tier["max_redeemable"],
        "already_redeemed":       round(already_redeemed_paise / 100, 2),
        "available_to_redeem":    round(available_to_redeem / 100, 2),
        "can_redeem":             available_to_redeem > 0,
        "next_tier":              next_tier,
        "gadget_eligible":        gadget_eligible,
        "billing_period":         current_month_str(),
    }


@router.get("/user/loop-ledger")
async def get_loop_ledger(
    limit: int = 20,
    skip: int = 0,
    user_id: str = Depends(get_current_user),
):
    rows = await db.loop_ledger.find({"user_id": user_id}) \
        .sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.loop_ledger.count_documents({"user_id": user_id})
    for r in rows:
        r.pop("_id", None)
    return {"rows": rows, "total": total, "has_more": (skip + limit) < total}


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.post("/admin/loop/credit")
async def admin_credit_loop(req: AdminCreditRequest, _=Depends(verify_admin)):
    """Manually credit GETV coins to a user (promo, goodwill). Amount in ₹."""
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    new_bal = await credit_loop_balance(
        req.user_id, req.amount,
        reference_type="admin_credit",
        reference_id=f"admin-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        description=req.description,
    )
    return {"success": True, "new_balance": new_bal}


@router.post("/admin/loop/recalc/{user_id}")
async def recalc_loop_balance(user_id: str, _=Depends(verify_admin)):
    """Recompute balance from ledger rows (crash recovery / reconciliation)."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]
    agg = await db.loop_ledger.aggregate(pipeline).to_list(10)
    totals = {r["_id"]: r["total"] for r in agg}
    correct = round(totals.get("credit", 0.0) - totals.get("debit", 0.0), 2)
    correct_paise = int(round(correct * 100))
    await db.users.update_one({"id": user_id}, {"$set": {"loop_balance_paise": correct_paise}})
    return {"user_id": user_id, "recalculated_balance": correct}


# ── MSO spend-signal (cable bill webhook) ─────────────────────────────────────

@router.post("/mso/spend-signal")
async def mso_spend_signal(
    payload: MsoSpendSignal,
    x_mso_secret: Optional[str] = Header(default=None),
):
    """
    MSO webhook: cable operator reports subscriber's monthly bill.
    Issues 1,000 GETV coins if cable+broadband bill ≥ ₹1,000.
    Idempotent — one credit per user per billing_month.
    Resets suspension counter on each successful bill.
    """
    if x_mso_secret != MSO_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid MSO secret")

    total_bill_paise = int(round((payload.cable_spend + payload.broadband_spend) * 100))
    if total_bill_paise <= 0:
        raise HTTPException(status_code=400, detail="Cable spend must be positive")

    # Idempotency: one credit per user per billing month
    ref_id = f"{payload.user_id}:{payload.mso_id}:{payload.billing_month}"
    existing = await db.loop_ledger.find_one({"reference_id": ref_id, "type": "credit"})
    if existing:
        return {
            "success": True,
            "already_processed": True,
            "message": f"Bill for {payload.billing_month} already credited",
        }

    # Check minimum bill threshold
    qualifies = total_bill_paise >= MIN_CABLE_BILL_FOR_CREDIT

    # Update bill tracking on user
    user = await db.users.find_one({"id": payload.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    consecutive_no_bill = int(user.get("loop_consecutive_no_bill", 0))

    if qualifies:
        # Reset suspension on valid bill
        await db.users.update_one(
            {"id": payload.user_id},
            {"$set": {
                "loop_last_bill_month": payload.billing_month,
                "loop_consecutive_no_bill": 0,
                "loop_suspended": False,
            }},
        )
        # Credit 1,000 GETV coins
        coins_paise = MONTHLY_COIN_CREDIT * 100   # 1000 coins × 100 = 100,000 paise = ₹1,000
        new_balance_paise = await credit_loop_balance_paise(
            payload.user_id,
            coins_paise,
            reference_type="cable_tv_earn",
            reference_id=ref_id,
            description=f"1,000 GETV coins — cable bill ₹{payload.cable_spend:.0f}"
                        + (f" + broadband ₹{payload.broadband_spend:.0f}" if payload.broadband_spend else "")
                        + f" ({payload.billing_month})",
        )
        return {
            "success": True,
            "qualified": True,
            "coins_credited": MONTHLY_COIN_CREDIT,
            "new_balance": round(new_balance_paise / 100, 2),
            "message": f"₹{MONTHLY_COIN_CREDIT} GETV coins credited for {payload.billing_month} bill",
        }
    else:
        # Bill below threshold — increment no-bill counter
        new_consecutive = consecutive_no_bill + 1
        suspended = new_consecutive >= SUSPENSION_THRESHOLD
        await db.users.update_one(
            {"id": payload.user_id},
            {"$set": {
                "loop_consecutive_no_bill": new_consecutive,
                "loop_suspended": suspended,
            }},
        )
        msg = (
            f"Bill ₹{(total_bill_paise/100):.0f} is below ₹{MIN_CABLE_BILL_FOR_CREDIT/100:.0f} threshold. "
            f"No coins credited."
        )
        if suspended:
            msg += " Auto-credit suspended (2 consecutive months below threshold)."
        return {
            "success": True,
            "qualified": False,
            "coins_credited": 0,
            "suspended": suspended,
            "message": msg,
        }


# ── Compatibility alias (imported by older code) ───────────────────────────────
MAX_REDEEM_FRACTION = 1.0   # not used in new system; kept for import compatibility
