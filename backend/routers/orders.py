from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta
import uuid
import logging
from typing import Optional, List
from pydantic import BaseModel
from database import db, get_current_user, verify_admin, clean_mongo_doc, clean_mongo_docs, send_push_notification, insert_notification
from routers.stores import find_serving_store
from models import CreateOrderRequest, OrderCreate
from routers.loop_ledger import credit_loop_balance, debit_loop_balance, MAX_REDEEM_FRACTION

router = APIRouter(prefix="/orders", tags=["Orders"])

# Spending tiers & rewards
def calculate_spending_tiers_and_rewards(current_monthly_spend: float, order_total: float) -> dict:
    new_monthly_spend = current_monthly_spend + order_total
    
    tiers = [
        {"threshold": 25000, "reward": 1000, "tier_name": "Platinum"},
        {"threshold": 13000, "reward": 500, "tier_name": "Gold"},
        {"threshold": 7000, "reward": 250, "tier_name": "Silver"},
        {"threshold": 0, "reward": 0, "tier_name": "Base"}
    ]
    
    current_tier = {"threshold": 0, "reward": 0, "tier_name": "Base"}
    for tier in tiers:
        if new_monthly_spend >= tier["threshold"]:
            current_tier = tier
            break
            
    order_reward_percentage = 0.01  # 1% cashback base
    if current_tier["tier_name"] == "Platinum":
        order_reward_percentage = 0.05
    elif current_tier["tier_name"] == "Gold":
        order_reward_percentage = 0.03
    elif current_tier["tier_name"] == "Silver":
        order_reward_percentage = 0.02
        
    order_cashback = order_total * order_reward_percentage
    
    return {
        "new_monthly_spend": new_monthly_spend,
        "current_tier": current_tier,
        "order_cashback": order_cashback,
        "total_available_reward": current_tier["reward"]
    }

# Unified state machine transition function
async def transition_order_status(order_id: str, to_status: str, changed_by: str, reason: Optional[str] = None):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    old_status = order.get("status", "created")
    if old_status == to_status:
        return
        
    # Updates to apply
    tracking_message = f"Order status updated from {old_status} to {to_status}."
    if reason:
        tracking_message += f" Reason: {reason}"
        
    update_doc = {
        "status": to_status,
        "updated_at": datetime.utcnow()
    }
    
    # Map payment_status and delivery_status based on status transitions
    if to_status == "paid":
        update_doc["payment_status"] = "paid"
        update_doc["delivery_status"] = "preparing"
    elif to_status == "cod_confirmed":
        update_doc["payment_status"] = "pending_cod"
        update_doc["delivery_status"] = "pending"
    elif to_status == "cancelled":
        update_doc["cancelled_at"] = datetime.utcnow()
        # If paid, payment status goes to refund_pending
        if order.get("payment_status") == "paid":
            update_doc["payment_status"] = "refund_pending"
        # Restore stock
        for item in order.get("items", []):
            await db.products.update_one(
                {"id": item["product_id"]},
                {"$inc": {"stock": item["quantity"]}}
            )
    elif to_status == "refunded":
        update_doc["payment_status"] = "refunded"
    elif to_status in ["preparing", "packed", "reached_store", "picked_up", "out_for_delivery", "delivered"]:
        update_doc["delivery_status"] = to_status
        if to_status == "delivered" and order.get("payment_method", "").lower() == "cod":
            update_doc["payment_status"] = "paid"
            
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": update_doc,
            "$push": {
                "tracking_updates": {
                    "timestamp": datetime.utcnow(),
                    "status": to_status,
                    "message": tracking_message
                }
            }
        }
    )
    
    # Insert audit event
    await db.order_events.insert_one({
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "from_status": old_status,
        "to_status": to_status,
        "changed_by": changed_by,
        "reason": reason,
        "timestamp": datetime.utcnow()
    })

    # Trigger push notification & insert to notifications collection
    STATUS_MESSAGES = {
        "confirmed": ("Order Confirmed ✅", "Your order has been received and is being prepared."),
        "out_for_delivery": ("Order On The Way 🛵", "Your delivery partner is heading to you!"),
        "delivered": ("Order Delivered 🎉", "Your order has arrived. Enjoy your groceries!"),
        "cancelled": ("Order Cancelled", "Your order has been cancelled."),
    }
    user_id_of_order = order["user_id"]
    if to_status in STATUS_MESSAGES:
        title, body = STATUS_MESSAGES[to_status]
        user = await db.users.find_one({"id": user_id_of_order})
        if user and user.get("push_token"):
            await send_push_notification(user["push_token"], title, body, {"order_id": order_id})
        # Also save to notifications collection
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id_of_order,
            "title": title,
            "message": body,
            "type": "order",
            "read": False,
            "created_at": datetime.utcnow()
        })

# Helper for atomic stock reservation
async def try_reserve_stock(items: List[dict]) -> List[dict]:
    deducted_items = []
    for item in items:
        # Atomically deduct stock
        res = await db.products.find_one_and_update(
            {"id": item["product_id"], "stock": {"$gte": item["quantity"]}},
            {"$inc": {"stock": -item["quantity"]}}
        )
        if not res:
            # Rollback already deducted items
            for rolled_back in deducted_items:
                await db.products.update_one(
                    {"id": rolled_back["product_id"]},
                    {"$inc": {"stock": rolled_back["quantity"]}}
                )
            # Find product name for error message
            p = await db.products.find_one({"id": item["product_id"]})
            name = p.get("name", item["product_id"]) if p else item["product_id"]
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {name} or product not found"
            )
        deducted_items.append(item)
    return deducted_items

# Core order creation business logic
async def create_order_core(payload: CreateOrderRequest, user_id: str, is_pending: bool):
    # 1. Fetch flat cart items
    cart_items = await db.cart_items.find({"user_id": user_id}).to_list(1000)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")
        
    # 2. Verify address
    address = await db.addresses.find_one({"id": payload.address_id, "user_id": user_id})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
        
    subtotal = 0.0
    items_to_save = []
    
    # 2b. Serviceability check (Task 20)
    # If the saved address carries lat/lng, verify a store can reach it.
    # Addresses without coordinates skip the check (fail-open for pilot).
    addr_lat = address.get("lat")
    addr_lng = address.get("lng")
    serving_store = None
    if addr_lat is not None and addr_lng is not None:
        serving_store = await find_serving_store(float(addr_lat), float(addr_lng))
        if serving_store is None:
            raise HTTPException(
                status_code=400,
                detail="Sorry, we don't deliver to your address yet. Check back soon!"
            )

    # 3. Validate & freeze prices
    for item in cart_items:
        product = await db.products.find_one({"id": item["product_id"]})
        if not product:
            raise HTTPException(status_code=400, detail=f"Product not found: {item['product_id']}")
            
        item_price = product.get("price", 0.0)
        subtotal += item_price * item["quantity"]
        
        items_to_save.append({
            "product_id": item["product_id"],
            "name": product.get("name", "Unknown"),
            "price": item_price,
            "quantity": item["quantity"],
            "brand": product.get("brand", "Unknown")
        })
        
    delivery_fee = 0.0 if subtotal >= 299.0 else 30.0
    discount = 0.0
    
    # 4. Process coupon
    if payload.coupon_code:
        coupon = await db.coupons.find_one({"code": payload.coupon_code.upper(), "is_active": True})
        if coupon and datetime.utcnow() <= coupon["valid_until"] and subtotal >= coupon.get("min_order_value", 0):
            if coupon.get("discount_percentage", 0) > 0:
                discount = (subtotal * coupon["discount_percentage"]) / 100.0
                if coupon.get("max_discount") and discount > coupon["max_discount"]:
                    discount = coupon["max_discount"]
            elif coupon.get("discount_amount", 0) > 0:
                discount = coupon["discount_amount"]
                
    total = subtotal + delivery_fee - discount
    if total < 0:
        total = 0.0

    # Task 15: LOOP credit redemption
    loop_credits_requested = getattr(payload, "loop_credits_to_redeem", 0.0) or 0.0
    loop_credits_used = 0.0
    if loop_credits_requested > 0:
        user_for_loop = await db.users.find_one({"id": user_id}) or {}
        available_loop = round(user_for_loop.get("loop_balance", 0.0), 2)
        max_redeemable = round(total * MAX_REDEEM_FRACTION, 2)   # 50% cap
        loop_credits_used = round(min(loop_credits_requested, available_loop, max_redeemable), 2)
        total = round(total - loop_credits_used, 2)
        if total < 0:
            total = 0.0

    user = await db.users.find_one({"id": user_id})
    if user is None:
        # Admin users are not in db.users — fall back gracefully with zero spend
        user = await db.admins.find_one({"id": user_id}) or {}
    rewards_info = calculate_spending_tiers_and_rewards(user.get("monthly_spend", 0.0), total)
    rewards_will_earn = rewards_info["order_cashback"]
    
    # 5. Atomically deduct stock
    # Note: Stock is reserved immediately upon order creation for both COD and prepaid (pending payment)
    # If the user cancels the pending payment or it expires, the stock is rolled back.
    await try_reserve_stock(items_to_save)
    
    order_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "items": items_to_save,
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "discount": round(discount, 2),
        "coupon_code": payload.coupon_code.upper() if payload.coupon_code else None,
        "total": round(total, 2),
        "loop_credits_used": round(loop_credits_used, 2),
        "rewards_will_earn": round(rewards_will_earn, 2),
        "delivery_address": address["full_address"],
        "address_id": payload.address_id,
        "payment_method": payload.payment_method,
        "status": "created",
        "payment_status": "pending",
        "created_at": datetime.utcnow(),
        "delivery_status": "pending",
        "estimated_delivery": datetime.utcnow() + timedelta(hours=1),
        "store_id": serving_store["id"] if serving_store else None,
        "tracking_updates": [
            {
                "timestamp": datetime.utcnow(),
                "status": "created",
                "message": "Order created."
            }
        ]
    }
    
    await db.orders.insert_one(order_dict)

    # Task 15: Debit LOOP balance now that order is committed
    if loop_credits_used > 0:
        await debit_loop_balance(
            user_id, loop_credits_used,
            reference_type="order_redeem",
            reference_id=order_dict["id"],
            description=f"Redeemed at checkout for order #{order_dict['id'][:8].upper()}",
        )

    # Initial state machine transitions
    if is_pending:
        await transition_order_status(order_dict["id"], "pending_payment", user_id, "Prepaid order created - payment pending")
    else:
        # For COD: instantly confirm and clear user cart
        await transition_order_status(order_dict["id"], "cod_confirmed", user_id, "COD order created and confirmed")
        # Update user spending and rewards immediately for COD
        new_spend = user.get("monthly_spend", 0.0) + total
        new_total_spend = user.get("total_spend", 0.0) + total
        new_reward = user.get("current_reward", 0.0) + rewards_will_earn
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "monthly_spend": new_spend,
                "total_spend": new_total_spend,
                "current_reward": new_reward
            }}
        )
        # Task 15: Credit LOOP cashback earned on this COD order
        if rewards_will_earn > 0:
            await credit_loop_balance(
                user_id, rewards_will_earn,
                reference_type="order_earn",
                reference_id=order_dict["id"],
                description=f"Cashback earned on order #{order_dict['id'][:8].upper()}",
            )
        await db.cart_items.delete_many({"user_id": user_id})
        await insert_notification(
            user_id,
            "Order Confirmed! 🎉",
            f"Your order #{order_dict['id'][:8].upper()} has been confirmed. Expected delivery in ~60 minutes.",
            "order",
            f"/order-tracking/{order_dict['id']}",
        )

    final_order = await db.orders.find_one({"id": order_dict["id"]})
    res_dict = clean_mongo_doc(final_order)
    res_dict["success"] = True
    res_dict["order_id"] = order_dict["id"]
    return res_dict

@router.post("/create")
async def create_order_endpoint(payload: CreateOrderRequest, user_id: str = Depends(get_current_user)):
    return await create_order_core(payload, user_id, is_pending=False)

@router.post("/create-pending")
async def create_pending_order(payload: CreateOrderRequest, user_id: str = Depends(get_current_user)):
    return await create_order_core(payload, user_id, is_pending=True)

@router.post("")
async def legacy_create_order(order_data: OrderCreate, user_id: str = Depends(get_current_user)):
    """
    Backwards-compatible legacy order creation endpoint.
    Automatically resolves to order_core.
    """
    # Create fake address_id for compatibility if needed, or query one
    address = await db.addresses.find_one({"user_id": user_id})
    if not address:
        raise HTTPException(status_code=400, detail="An address is required to place an order. Please add an address first.")
        
    payload = CreateOrderRequest(
        address_id=address["id"],
        payment_method=order_data.payment_method,
        coupon_code=None
    )
    is_pending = order_data.payment_method.lower() != "cod"
    return await create_order_core(payload, user_id, is_pending=is_pending)

@router.get("/user/orders")
@router.get("")
async def get_user_orders(
    user_id: str = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    query = {"user_id": user_id}
    if status:
        query["status"] = status
        
    total = await db.orders.count_documents(query)
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "orders": clean_mongo_docs(orders),
        "total": total,
        "has_more": (skip + limit) < total
    }

@router.post("/{order_id}/cancel")
async def cancel_order(order_id: str, user_id: str = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.get("status") in ["delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this order in its current status")
        
    await transition_order_status(order_id, "cancelled", user_id, "Order cancelled by customer")
    return {"message": "Order cancelled successfully", "success": True}

@router.get("/{order_id}/tracking")
async def get_order_tracking(order_id: str, user_id: str = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    assigned_rider_id = order.get("assigned_rider_id")
    delivery_partner_data = None
    if assigned_rider_id:
        rider = await db.riders.find_one({"id": assigned_rider_id})
        if rider:
            est_mins = rider.get("estimated_delivery_minutes")
            est_arrival = f"{est_mins} minutes" if est_mins is not None else "15 minutes"
            
            current_location = rider.get("current_location")
            delivery_partner_data = {
                "id": rider.get("id"),
                "name": rider.get("name", "Unknown Rider"),
                "phone": rider.get("phone", ""),
                "vehicle": rider.get("vehicle", "Bike"),
                "rating": rider.get("rating", 4.8),
                "current_location": current_location,
                "estimated_arrival": est_arrival
            }

    gps_on = (
        delivery_partner_data is not None
        and delivery_partner_data.get("current_location") is not None
    )
    tracking_data = {
        "order_id": order_id,
        "status": order.get("status", "confirmed"),
        "delivery_partner": delivery_partner_data if order.get("status") in ["picked_up", "out_for_delivery"] else None,
        "delivery_address": order.get("delivery_address", ""),
        "estimated_delivery": order.get("estimated_delivery", datetime.utcnow() + timedelta(hours=1)),
        "tracking_updates": order.get("tracking_updates", []),
        "gps_tracking_enabled": gps_on
    }
    
    return clean_mongo_doc(tracking_data)

# Admin endpoints
class AssignRiderRequest(BaseModel):
    rider_id: str

@router.post("/admin/{order_id}/assign-rider")
async def assign_rider_to_order(order_id: str, payload: AssignRiderRequest, admin=Depends(verify_admin)):
    rider_id = payload.rider_id.strip()
    if not rider_id:
        raise HTTPException(status_code=422, detail="rider_id is required")

    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rider = await db.riders.find_one({"id": rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"assigned_rider_id": rider_id, "updated_at": datetime.utcnow()}}
    )
    await db.riders.update_one(
        {"id": rider_id},
        {"$set": {"current_order_id": order_id, "updated_at": datetime.utcnow()}}
    )

    title = "New Order Assigned 📦"
    message = f"You have been assigned order #{order_id[:8]}. Check the app for details."
    push_token = rider.get("push_token")
    if push_token:
        await send_push_notification(push_token, title, message, {"order_id": order_id})
    await insert_notification(rider_id, title, message, "order", f"/order/{order_id}")

    return {"success": True, "order_id": order_id, "rider_id": rider_id}


@router.get("/admin/list")
async def admin_get_orders(
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    admin=Depends(verify_admin),
    limit: int = 100,
    skip: int = 0
):
    query = {}
    if status:
        query["status"] = status
    if payment_method:
        query["payment_method"] = payment_method
        
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.orders.count_documents(query)
    
    return {
        "orders": clean_mongo_docs(orders),
        "total": total
    }

@router.put("/admin/orders/{order_id}/status")
@router.put("/{order_id}/status")
async def admin_update_order_status(order_id: str, payload: dict, admin=Depends(verify_admin)):
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required")
        
    # Make sure transition_order_status is called
    await transition_order_status(order_id, new_status, admin.get("user_id", "admin"), "Status updated by admin")
    return {"message": "Order status updated successfully"}

@router.get("/checkout/summary")
async def get_checkout_summary(coupon_code: Optional[str] = None, user_id: str = Depends(get_current_user)):
    cart_items = await db.cart_items.find({"user_id": user_id}).to_list(1000)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")
        
    subtotal = 0.0
    for item in cart_items:
        product = await db.products.find_one({"id": item["product_id"]})
        if product:
            item_price = product.get("price", 0.0)
            subtotal += item_price * item["quantity"]
            
    delivery_fee = 0.0 if subtotal >= 299.0 else 30.0
    discount = 0.0
    
    if coupon_code:
        coupon = await db.coupons.find_one({"code": coupon_code.upper(), "is_active": True})
        if coupon and datetime.utcnow() <= coupon["valid_until"] and subtotal >= coupon.get("min_order_value", 0):
            if coupon.get("discount_percentage", 0) > 0:
                discount = (subtotal * coupon["discount_percentage"]) / 100.0
                if coupon.get("max_discount") and discount > coupon["max_discount"]:
                    discount = coupon["max_discount"]
            elif coupon.get("discount_amount", 0) > 0:
                discount = coupon["discount_amount"]
                
    total = subtotal + delivery_fee - discount
    if total < 0:
        total = 0.0

    # Task 15: LOOP credit redemption
    loop_credits_requested = getattr(payload, "loop_credits_to_redeem", 0.0) or 0.0
    loop_credits_used = 0.0
    if loop_credits_requested > 0:
        user_for_loop = await db.users.find_one({"id": user_id}) or {}
        available_loop = round(user_for_loop.get("loop_balance", 0.0), 2)
        max_redeemable = round(total * MAX_REDEEM_FRACTION, 2)   # 50% cap
        loop_credits_used = round(min(loop_credits_requested, available_loop, max_redeemable), 2)
        total = round(total - loop_credits_used, 2)
        if total < 0:
            total = 0.0

    user = await db.users.find_one({"id": user_id})
    if user is None:
        # Admin users are not in db.users — fall back gracefully with zero spend
        user = await db.admins.find_one({"id": user_id}) or {}
    rewards_info = calculate_spending_tiers_and_rewards(user.get("monthly_spend", 0.0), total)
    rewards_will_earn = rewards_info["order_cashback"]
    
    return {
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "discount": round(discount, 2),
        "total": round(total, 2),
        "rewards_will_earn": round(rewards_will_earn, 2),
        "tier": rewards_info["current_tier"]["tier_name"]
    }

@router.post("/checkout/calculate-rewards")
async def calculate_checkout_rewards(checkout_data: dict, user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        user = await db.admins.find_one({"id": user_id}) or {}
        
    subtotal = checkout_data.get("subtotal", 0.0)
    current_monthly_spend = user.get("monthly_spend", 0.0)
    current_reward_balance = user.get("current_reward", 0.0)
    
    rewards_info = calculate_spending_tiers_and_rewards(current_monthly_spend, subtotal)
    
    max_applicable_reward = min(current_reward_balance, subtotal)
    reward_applied = max_applicable_reward
    final_total = subtotal - reward_applied
    
    return {
        "subtotal": subtotal,
        "current_reward_balance": current_reward_balance,
        "rewards_auto_applied": reward_applied,
        "final_total": final_total,
        "new_tier_info": rewards_info["current_tier"],
        "order_cashback_earned": rewards_info["order_cashback"],
        "breakdown": {
            "original_amount": subtotal,
            "rewards_applied": reward_applied,
            "amount_to_pay": final_total,
            "cashback_earning": rewards_info["order_cashback"]
        }
    }

