from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime
import razorpay
import os
import logging
import uuid
from typing import Optional
from database import db, get_current_user, verify_admin, clean_mongo_doc
from models import CreatePaymentRequest, VerifyPaymentRequest, RefundRequest
from routers.orders import transition_order_status

router = APIRouter(prefix="/payments", tags=["Payments"])

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")

if not RAZORPAY_KEY_ID:
    raise RuntimeError("FATAL: RAZORPAY_KEY_ID environment variable is not set. Refusing to start with insecure fallback.")

if not RAZORPAY_KEY_SECRET:
    raise RuntimeError("FATAL: RAZORPAY_KEY_SECRET environment variable is not set. Refusing to start with insecure fallback.")

RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET") or ""

def get_razorpay_client():
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        return None
    try:
        return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception as e:
        logging.error(f"Failed to initialize Razorpay Client: {e}")
        return None

@router.post("/razorpay/create")
async def create_razorpay_payment(payload: CreatePaymentRequest, user_id: str = Depends(get_current_user)):
    order = await db.orders.find_one({"id": payload.order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=500, detail="Razorpay integration not configured")
        
    try:
        # Amount in paise
        amount_paise = int(order["total"] * 100)
        razorpay_order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": order["id"],
            "payment_capture": 1
        }
        
        razorpay_order = client.order.create(data=razorpay_order_data)
        
        # Save Razorpay order ID in our order doc
        await db.orders.update_one(
            {"id": order["id"]},
            {"$set": {"razorpay_order_id": razorpay_order["id"]}}
        )
        
        return {
            "razorpay_order_id": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"]
        }
    except Exception as e:
        logging.error(f"Error creating Razorpay order: {e}")
        raise HTTPException(status_code=500, detail=f"Razorpay order creation failed: {str(e)}")

@router.post("/razorpay/verify")
async def verify_razorpay_payment(payload: VerifyPaymentRequest, user_id: str = Depends(get_current_user)):
    # 1. Fetch local order
    order = await db.orders.find_one({"id": payload.order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Idempotency check: if already paid, return success immediately
    if order.get("payment_status") == "paid":
        return {"success": True, "message": "Payment already processed", "order_id": order["id"]}
        
    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=500, detail="Razorpay integration not configured")
        
    # 2. Verify signature
    is_dev = os.environ.get("ENV", "development") != "production"
    is_mock_order = payload.razorpay_order_id.startswith("rzp_mock_")

    if is_mock_order and is_dev:
        # Bypass signature check for dev mock payments
        logging.warning("DEV MODE: Skipping signature verification for mock payment")
    else:
        try:
            client.utility.verify_payment_signature({
                'razorpay_order_id': payload.razorpay_order_id,
                'razorpay_payment_id': payload.razorpay_payment_id,
                'razorpay_signature': payload.razorpay_signature
            })
        except Exception as e:
            logging.error(f"Razorpay signature verification failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid payment signature")
        
    # 3. Handle successful capture actions: transition status, award rewards, clear cart
    await transition_order_status(order["id"], "paid", user_id, "Razorpay payment verified")
    
    # Update user rewards and monthly spend
    user = await db.users.find_one({"id": user_id})
    if user:
        new_spend = user.get("monthly_spend", 0.0) + order["total"]
        new_total_spend = user.get("total_spend", 0.0) + order["total"]
        new_reward = user.get("current_reward", 0.0) + order.get("rewards_will_earn", 0.0)
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "monthly_spend": new_spend,
                "total_spend": new_total_spend,
                "current_reward": new_reward
            }}
        )
        
    # Clear cart
    await db.cart_items.delete_many({"user_id": user_id})
    
    return {"success": True, "message": "Payment verified and order confirmed"}

@router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    
    if not signature:
        raise HTTPException(status_code=400, detail="Signature missing")
        
    # Force webhook verification in production mode
    is_prod = os.environ.get("ENV", "development").lower() == "production"
    if is_prod and not RAZORPAY_WEBHOOK_SECRET:
        logging.error("FATAL: Webhook secret missing in production mode.")
        raise HTTPException(status_code=500, detail="Webhook misconfigured")
        
    if RAZORPAY_WEBHOOK_SECRET:
        client = get_razorpay_client()
        if not client:
            raise HTTPException(status_code=500, detail="Razorpay integration not configured")
        try:
            client.utility.verify_webhook_signature(body.decode(), signature, RAZORPAY_WEBHOOK_SECRET)
        except Exception as e:
            logging.error(f"Webhook signature verification failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
            
    # Process event
    try:
        import json
        event_data = json.loads(body.decode())
        event_name = event_data.get("event")
        
        if event_name == "payment.captured":
            payment_entity = event_data["payload"]["payment"]["entity"]
            razorpay_order_id = payment_entity.get("order_id")
            
            if razorpay_order_id:
                # Find matching order
                order = await db.orders.find_one({"razorpay_order_id": razorpay_order_id})
                if order:
                    # Idempotency check
                    if order.get("payment_status") != "paid":
                        user_id = order["user_id"]
                        await transition_order_status(order["id"], "paid", "system", "Payment captured via Razorpay Webhook")
                        
                        user = await db.users.find_one({"id": user_id})
                        if user:
                            new_spend = user.get("monthly_spend", 0.0) + order["total"]
                            new_total_spend = user.get("total_spend", 0.0) + order["total"]
                            new_reward = user.get("current_reward", 0.0) + order.get("rewards_will_earn", 0.0)
                            
                            await db.users.update_one(
                                {"id": user_id},
                                {"$set": {
                                    "monthly_spend": new_spend,
                                    "total_spend": new_total_spend,
                                    "current_reward": new_reward
                                }}
                            )
                        await db.cart_items.delete_many({"user_id": user_id})
    except Exception as e:
        logging.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"status": "ok"}

@router.post("/admin/refund")
async def initiate_refund(payload: RefundRequest, admin=Depends(verify_admin)):
    order = await db.orders.find_one({"id": payload.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Only paid orders can be refunded")
        
    client = get_razorpay_client()
    refund_id = f"rf_mock_{uuid.uuid4().hex[:12]}"
    
    if client and order.get("razorpay_order_id") and not order.get("razorpay_order_id", "").startswith("mock"):
        try:
            # Query payments for the order to get the payment ID
            payments = client.order.payments(order["razorpay_order_id"])
            if payments and payments.get("items"):
                payment_id = payments["items"][0]["id"]
                refund_amount = int(payload.amount * 100) if payload.amount else int(order["total"] * 100)
                refund_res = client.payment.refund(payment_id, {"amount": refund_amount, "notes": {"reason": payload.reason}})
                refund_id = refund_res["id"]
        except Exception as e:
            logging.error(f"Razorpay API refund failed: {e}. Falling back to mock refund.")
            
    # Record refund in database
    refund_doc = {
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "refund_id": refund_id,
        "amount": payload.amount or order["total"],
        "reason": payload.reason,
        "status": "processed",
        "created_at": datetime.utcnow()
    }
    await db.refunds.insert_one(refund_doc)
    
    # Transition order state
    await transition_order_status(order["id"], "refunded", admin.get("user_id", "admin"), f"Refunded: {payload.reason}")
    return {"success": True, "refund_id": refund_id, "message": "Refund processed successfully"}

@router.get("/admin/reconciliation")
async def payments_reconciliation(admin=Depends(verify_admin)):
    """
    Match local database paid orders against Razorpay API payments
    """
    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=500, detail="Razorpay integration not configured")
        
    try:
        # Fetch last 100 payments from Razorpay
        payments = client.payment.all({"count": 100})
        items = payments.get("items", [])
        
        mismatches = []
        matched_count = 0
        
        for r_pay in items:
            receipt = r_pay.get("notes", {}).get("receipt") or r_pay.get("description")
            r_order_id = r_pay.get("order_id")
            
            # Look up order in local DB
            order = None
            if receipt:
                order = await db.orders.find_one({"id": receipt})
            if not order and r_order_id:
                order = await db.orders.find_one({"razorpay_order_id": r_order_id})
                
            if order:
                local_paid = order.get("payment_status") == "paid"
                r_status = r_pay.get("status")
                r_paid = r_status in ["captured", "refunded"]
                
                # Check for mismatch
                if local_paid != r_paid:
                    mismatches.append({
                        "order_id": order["id"],
                        "razorpay_order_id": r_order_id,
                        "payment_id": r_pay.get("id"),
                        "local_status": order.get("payment_status"),
                        "razorpay_status": r_status,
                        "amount_mismatch": order["total"] != (r_pay.get("amount", 0) / 100.0)
                    })
                else:
                    matched_count += 1
            else:
                mismatches.append({
                    "order_id": "NOT_FOUND",
                    "razorpay_order_id": r_order_id,
                    "payment_id": r_pay.get("id"),
                    "local_status": None,
                    "razorpay_status": r_pay.get("status"),
                    "amount_mismatch": False
                })
                
        return {
            "reconciliation_run_at": datetime.utcnow(),
            "total_razorpay_payments_checked": len(items),
            "matched_successfully": matched_count,
            "mismatches_found": len(mismatches),
            "mismatches": mismatches
        }
    except Exception as e:
        logging.error(f"Error during payments reconciliation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
