"""
GrocerEase — Razorpay Payment Integration
Add these routes to server.py
Requires: pip install razorpay
"""
import hmac
import hashlib
import razorpay
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

router = APIRouter(prefix="/api/payments", tags=["payments"])

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

def get_razorpay_client():
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay keys not configured")
    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

class CreatePaymentRequest(BaseModel):
    order_id: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: str

@router.post("/razorpay/create")
async def create_razorpay_order(
    payload: CreatePaymentRequest,
    current_user: dict = Depends(get_current_user),  # reuse your existing auth dep
    db=Depends(get_database),
):
    """Create a Razorpay order for the given GrocerEase order_id."""
    order = await db.orders.find_one({"_id": payload.order_id, "user_id": str(current_user["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    client = get_razorpay_client()
    amount_paise = int(order["total"] * 100)  # Razorpay uses paise

    rz_order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": payload.order_id,
        "notes": {"grocerease_order_id": payload.order_id},
    })

    # Save razorpay_order_id to our order doc
    await db.orders.update_one(
        {"_id": payload.order_id},
        {"$set": {"razorpay_order_id": rz_order["id"], "payment_status": "pending"}}
    )

    return {
        "razorpay_order_id": rz_order["id"],
        "amount": amount_paise,
        "currency": "INR",
    }


@router.post("/razorpay/verify")
async def verify_razorpay_payment(
    payload: VerifyPaymentRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Verify Razorpay signature and mark order as paid."""
    # Signature verification — CRITICAL security step
    body = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    expected_sig = hmac.new(
        RAZORPAY_KEY_SECRET.encode(), body.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Mark order paid and trigger fulfillment
    await db.orders.update_one(
        {"_id": payload.order_id},
        {
            "$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "razorpay_payment_id": payload.razorpay_payment_id,
            }
        }
    )

    # Apply rewards cashback
    order = await db.orders.find_one({"_id": payload.order_id})
    if order and order.get("rewards_earned", 0) > 0:
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {"rewards_balance": order["rewards_earned"], "total_spent": order["total"]}}
        )

    return {"status": "success", "order_id": payload.order_id}


@router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request, db=Depends(get_database)):
    """Razorpay webhook for async payment confirmations.
    Add this URL in Razorpay Dashboard → Webhooks.
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

    if webhook_secret:
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event = await request.json()
    if event.get("event") == "payment.captured":
        payment = event["payload"]["payment"]["entity"]
        order_id = payment["notes"].get("grocerease_order_id")
        if order_id:
            await db.orders.update_one(
                {"_id": order_id},
                {"$set": {"payment_status": "paid", "status": "confirmed"}}
            )

    return {"status": "ok"}
