"""
GrocerEase — Checkout Summary Endpoint Fix
FIX [2]: Remove auto-applied rewards_discount from checkout total.
         Rewards are earned AFTER delivery, not deducted at checkout.
         Replace the existing /api/checkout/summary handler in server.py with this.
"""

CASHBACK_RATES = {
    "Base": 0.01,
    "Silver": 0.02,
    "Gold": 0.03,
    "Platinum": 0.05,
}

# Replace your existing checkout/summary endpoint with this:
"""
@app.get("/api/checkout/summary")
async def checkout_summary(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    token_user_id = str(current_user["_id"])

    # Get cart items
    cart = await db.carts.find_one({"user_id": token_user_id})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")

    subtotal = sum(item["price"] * item["quantity"] for item in cart["items"])

    # Delivery fee logic (free above ₹299)
    delivery_fee = 0.0 if subtotal >= 299 else 30.0

    # FIX [2]: total = subtotal + delivery_fee (NO rewards_discount deducted)
    total = subtotal + delivery_fee

    # Show what cashback the user WILL EARN after delivery
    tier = current_user.get("tier", "Base")
    cashback_rate = CASHBACK_RATES.get(tier, 0.01)
    rewards_will_earn = round(subtotal * cashback_rate, 2)

    return {
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "total": round(total, 2),
        "rewards_will_earn": rewards_will_earn,   # informational only
        "tier": tier,
        # NOTE: rewards_discount and rewards_earned fields REMOVED
        # Rewards credit happens post-delivery in delivery_routes.py admin/update-status
    }
"""

# Also update /api/orders/create-pending (new endpoint for Razorpay pre-payment):
"""
@app.post("/api/orders/create-pending")
async def create_pending_order(payload: CreateOrderRequest, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    # Creates order in "payment_pending" status — NOT confirmed yet
    # Confirmed only after Razorpay signature verification in /api/payments/razorpay/verify
    cart = await db.carts.find_one({"user_id": str(current_user["_id"])})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")

    address = await db.addresses.find_one({"_id": ObjectId(payload.address_id), "user_id": str(current_user["_id"])})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    subtotal = sum(item["price"] * item["quantity"] for item in cart["items"])
    delivery_fee = 0.0 if subtotal >= 299 else 30.0
    total = subtotal + delivery_fee

    tier = current_user.get("tier", "Base")
    cashback_rate = CASHBACK_RATES.get(tier, 0.01)
    rewards_will_earn = round(subtotal * cashback_rate, 2)

    order_doc = {
        "user_id": str(current_user["_id"]),
        "items": cart["items"],
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "total": round(total, 2),
        "rewards_will_earn": rewards_will_earn,
        "delivery_address": address["full_address"],
        "address_id": str(address["_id"]),
        "payment_method": payload.payment_method,
        "status": "payment_pending",      # KEY: not "placed" yet
        "payment_status": "pending",
        "created_at": datetime.utcnow(),
    }
    result = await db.orders.insert_one(order_doc)
    return {"order_id": str(result.inserted_id)}
"""

# In payment_routes.py verify endpoint — after successful verification, credit rewards:
"""
# After updating order to confirmed in verify_razorpay_payment:
order = await db.orders.find_one({"_id": ObjectId(payload.order_id)})
tier = current_user.get("tier", "Base")
rewards_will_earn = order.get("rewards_will_earn", 0)

# Credit rewards to user wallet (earned, not pre-deducted)
if rewards_will_earn > 0:
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$inc": {
                "rewards_balance": rewards_will_earn,
                "total_spent": order["total"]
            }
        }
    )
    # Upgrade tier if thresholds crossed
    user = await db.users.find_one({"_id": current_user["_id"]})
    total_spent = user.get("total_spent", 0)
    new_tier = "Base"
    if total_spent >= 10000: new_tier = "Platinum"
    elif total_spent >= 5000: new_tier = "Gold"
    elif total_spent >= 2000: new_tier = "Silver"
    if new_tier != user.get("tier"):
        await db.users.update_one({"_id": current_user["_id"]}, {"$set": {"tier": new_tier}})
"""
