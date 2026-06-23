"""
routers/riders.py — Rider-facing endpoints

Task 27: POST /rider/availability — online/offline toggle
Task 30: POST /rider/register    — self-onboarding (creates pending_approval rider)
Task 31: GET  /rider/order-queue — return full queued order list
         Delivered handler now promotes next queued order to current
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from typing import Optional
import uuid
import jwt
from pydantic import BaseModel
from database import (
    db, hash_password, verify_password, create_access_token,
    clean_mongo_doc, security, SECRET_KEY, ALGORITHM
)

router = APIRouter(prefix="/rider", tags=["Rider"])

MAX_QUEUE_SIZE = 3  # max orders a single rider can hold (1 active + 2 queued)


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

async def get_current_rider(credentials=Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        rider_id = payload.get("rider_id")
        if not rider_id:
            raise HTTPException(status_code=401, detail="Invalid rider token")
        return rider_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid rider token")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RiderLogin(BaseModel):
    phone: str
    password: str

class RiderRegister(BaseModel):
    """Task 30: rider self-onboarding."""
    name: str
    phone: str
    password: str
    vehicle: Optional[str] = "Bike"

class RiderLocation(BaseModel):
    lat: float
    lng: float

class RiderOrderStatus(BaseModel):
    order_id: str
    status: str  # reached_store | picked_up | out_for_delivery | delivered

class RiderAvailability(BaseModel):
    """Task 27: online/offline toggle."""
    available: bool


# ---------------------------------------------------------------------------
# Status constants
# ---------------------------------------------------------------------------

VALID_RIDER_STATUSES = ["reached_store", "picked_up", "out_for_delivery", "delivered"]
STATUS_TO_ORDER_STATUS = {
    "reached_store": "reached_store",
    "picked_up": "picked_up",
    "out_for_delivery": "out_for_delivery",
    "delivered": "delivered",
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register")
async def rider_self_register(data: RiderRegister):
    """
    Task 30 — Rider self-onboarding.
    Creates a rider with status 'pending_approval'; admin must approve before
    the rider can log in (POST /admin/riders/{id}/approve).
    """
    phone = data.phone.strip()
    if await db.riders.find_one({"phone": phone}):
        raise HTTPException(status_code=400, detail="Phone number already registered")
    rider = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "phone": phone,
        "password": hash_password(data.password),
        "vehicle": (data.vehicle or "Bike").strip(),
        "status": "pending_approval",   # admin gate
        "current_order_id": None,
        "order_queue": [],              # Task 31
        "current_location": None,
        "push_token": None,
        "rating": 5.0,
        "created_at": datetime.utcnow(),
    }
    await db.riders.insert_one(rider)
    return {
        "success": True,
        "rider_id": rider["id"],
        "message": "Registration received. An admin will review and approve your account.",
    }


@router.post("/login")
async def rider_login(data: RiderLogin):
    rider = await db.riders.find_one({"phone": data.phone})
    if not rider or not verify_password(data.password, rider.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    if rider.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
    if rider.get("status") == "pending_approval":
        raise HTTPException(status_code=403, detail="Account pending admin approval.")

    token = create_access_token(
        {"rider_id": rider["id"], "role": "rider"}, expires_in=timedelta(hours=12)
    )
    current_order = None
    if rider.get("current_order_id"):
        order = await db.orders.find_one({"id": rider["current_order_id"]})
        if order:
            current_order = clean_mongo_doc(order)

    await db.riders.update_one(
        {"id": rider["id"]},
        {"$set": {"last_seen": datetime.utcnow(), "status": "online"}}
    )
    return {
        "token": token,
        "rider_id": rider["id"],
        "name": rider.get("name"),
        "current_order": current_order,
    }


@router.post("/availability")
async def set_availability(data: RiderAvailability, rider_id: str = Depends(get_current_rider)):
    """
    Task 27 — Online/offline toggle.
    A rider with an active order cannot go offline.
    """
    rider = await db.riders.find_one({"id": rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    if not data.available and rider.get("current_order_id"):
        raise HTTPException(
            status_code=400,
            detail="Cannot go offline while delivering an order. Complete or hand off first."
        )

    new_status = "online" if data.available else "offline"
    await db.riders.update_one(
        {"id": rider_id},
        {"$set": {"status": new_status, "last_seen": datetime.utcnow()}}
    )
    return {"success": True, "status": new_status}


@router.post("/location")
async def update_rider_location(data: RiderLocation, rider_id: str = Depends(get_current_rider)):
    await db.riders.update_one(
        {"id": rider_id},
        {"$set": {
            "current_location": {
                "lat": data.lat, "lng": data.lng,
                "updated_at": datetime.utcnow()
            },
            "last_seen": datetime.utcnow(),
        }}
    )
    return {"success": True}


@router.post("/order-status")
async def update_order_status(data: RiderOrderStatus, rider_id: str = Depends(get_current_rider)):
    if data.status not in VALID_RIDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {VALID_RIDER_STATUSES}"
        )
    order = await db.orders.find_one({"id": data.order_id, "assigned_rider_id": rider_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to you")

    order_status = STATUS_TO_ORDER_STATUS.get(data.status)
    if order_status:
        from routers.orders import transition_order_status
        await transition_order_status(
            order["id"], order_status, rider_id, f"Rider updated to {data.status}"
        )

    if data.status == "delivered":
        # Task 31: promote next queued order (if any) to current
        rider = await db.riders.find_one({"id": rider_id})
        queue = rider.get("order_queue", [])
        if queue:
            next_order_id = queue[0]
            remaining_queue = queue[1:]
            await db.riders.update_one(
                {"id": rider_id},
                {"$set": {
                    "current_order_id": next_order_id,
                    "order_queue": remaining_queue,
                    "status": "online",
                }}
            )
        else:
            await db.riders.update_one(
                {"id": rider_id},
                {"$set": {
                    "current_order_id": None,
                    "order_queue": [],
                    "status": "online",
                }}
            )
    return {"success": True}


@router.get("/current-order")
async def get_current_order(rider_id: str = Depends(get_current_rider)):
    rider = await db.riders.find_one({"id": rider_id})
    if not rider or not rider.get("current_order_id"):
        return {"order": None}
    order = await db.orders.find_one({"id": rider["current_order_id"]})
    return {"order": clean_mongo_doc(order) if order else None}


@router.get("/order-queue")
async def get_order_queue(rider_id: str = Depends(get_current_rider)):
    """
    Task 31 — Return the rider's full order queue (queued orders, not current).
    The current active order is returned by GET /rider/current-order.
    """
    rider = await db.riders.find_one({"id": rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    queue_ids = rider.get("order_queue", [])
    orders = []
    for oid in queue_ids:
        o = await db.orders.find_one({"id": oid})
        if o:
            orders.append(clean_mongo_doc(o))
    return {"order_queue": orders}


@router.post("/push-token")
async def save_rider_push_token(payload: dict, rider_id: str = Depends(get_current_rider)):
    token = payload.get("token", "").strip()
    if token:
        await db.riders.update_one({"id": rider_id}, {"$set": {"push_token": token}})
    return {"success": True}
