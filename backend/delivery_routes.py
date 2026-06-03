"""
GrocerEase — Delivery & Order Tracking Routes
Provides order status updates and basic delivery agent assignment.
For V1 pilot: manual delivery agent assignment via admin.
For V2: integrate Dunzo/Borzo/Shadowfax API.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import os

router = APIRouter(prefix="/api/orders", tags=["orders"])

ORDER_STATUSES = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]


class UpdateOrderStatusRequest(BaseModel):
    order_id: str
    status: str
    delivery_agent_name: Optional[str] = None
    delivery_agent_phone: Optional[str] = None
    eta_minutes: Optional[int] = None


class OrderTrackingResponse(BaseModel):
    order_id: str
    status: str
    status_label: str
    delivery_agent_name: Optional[str]
    delivery_agent_phone: Optional[str]
    eta_minutes: Optional[int]
    timeline: list


STATUS_LABELS = {
    "placed": "Order Placed",
    "confirmed": "Order Confirmed",
    "preparing": "Being Packed",
    "out_for_delivery": "Out for Delivery",
    "delivered": "Delivered",
    "cancelled": "Cancelled",
}

STATUS_ICONS = {
    "placed": "🛒",
    "confirmed": "✅",
    "preparing": "📦",
    "out_for_delivery": "🛵",
    "delivered": "🎉",
    "cancelled": "❌",
}


@router.get("/{order_id}/tracking")
async def get_order_tracking(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Get real-time order tracking info."""
    order = await db.orders.find_one({
        "_id": order_id,
        "user_id": str(current_user["_id"])
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current_status = order.get("status", "placed")
    current_idx = ORDER_STATUSES.index(current_status) if current_status in ORDER_STATUSES else 0

    timeline = []
    for i, status in enumerate(ORDER_STATUSES):
        if status == "cancelled":
            continue
        timeline.append({
            "status": status,
            "label": STATUS_LABELS.get(status, status),
            "icon": STATUS_ICONS.get(status, "•"),
            "completed": i <= current_idx and current_status != "cancelled",
            "active": status == current_status,
            "timestamp": order.get(f"{status}_at"),
        })

    return {
        "order_id": order_id,
        "status": current_status,
        "status_label": STATUS_LABELS.get(current_status, current_status),
        "delivery_agent_name": order.get("delivery_agent_name"),
        "delivery_agent_phone": order.get("delivery_agent_phone"),
        "eta_minutes": order.get("eta_minutes"),
        "timeline": timeline,
        "items": order.get("items", []),
        "total": order.get("total", 0),
        "delivery_address": order.get("delivery_address", ""),
        "payment_method": order.get("payment_method", ""),
        "payment_status": order.get("payment_status", ""),
        "rewards_earned": order.get("rewards_earned", 0),
    }


@router.post("/admin/update-status")
async def admin_update_order_status(
    payload: UpdateOrderStatusRequest,
    db=Depends(get_database),
    # Admin auth — reuse your existing admin dependency
):
    """
    Admin endpoint to update order status and assign delivery agent.
    Called from admin portal or manually during V1 pilot.
    """
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of: {ORDER_STATUSES}")

    update: dict = {
        "status": payload.status,
        f"{payload.status}_at": datetime.utcnow(),
    }
    if payload.delivery_agent_name:
        update["delivery_agent_name"] = payload.delivery_agent_name
    if payload.delivery_agent_phone:
        update["delivery_agent_phone"] = payload.delivery_agent_phone
    if payload.eta_minutes:
        update["eta_minutes"] = payload.eta_minutes

    result = await db.orders.update_one({"_id": payload.order_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")

    # TODO V2: trigger push notification to user here
    # await send_push_notification(user_id, f"Your order is now: {STATUS_LABELS[payload.status]}")

    return {"status": "updated", "order_id": payload.order_id, "new_status": payload.status}


@router.get("/my-orders")
async def get_my_orders(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
    page: int = 1,
    limit: int = 10,
):
    """Paginated order history for the current user."""
    skip = (page - 1) * limit
    cursor = db.orders.find(
        {"user_id": str(current_user["_id"])},
        sort=[("created_at", -1)],
    ).skip(skip).limit(limit)

    orders = []
    async for order in cursor:
        order["_id"] = str(order["_id"])
        orders.append({
            "order_id": order["_id"],
            "status": order.get("status", "placed"),
            "status_label": STATUS_LABELS.get(order.get("status", "placed"), ""),
            "total": order.get("total", 0),
            "items_count": len(order.get("items", [])),
            "created_at": order.get("created_at"),
            "payment_method": order.get("payment_method", ""),
        })

    total = await db.orders.count_documents({"user_id": str(current_user["_id"])})
    return {"orders": orders, "total": total, "page": page, "pages": (total + limit - 1) // limit}
