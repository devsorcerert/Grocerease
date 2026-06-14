from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
import uuid
import jwt
from database import db, hash_password, verify_password, create_access_token, get_current_user, clean_mongo_doc, security, SECRET_KEY, ALGORITHM
from pydantic import BaseModel

router = APIRouter(prefix="/rider", tags=["Rider"])

class RiderLogin(BaseModel):
    phone: str
    password: str

class RiderLocation(BaseModel):
    lat: float
    lng: float

class RiderOrderStatus(BaseModel):
    order_id: str
    status: str  # reached_store | picked_up | out_for_delivery | delivered

VALID_RIDER_STATUSES = ["reached_store", "picked_up", "out_for_delivery", "delivered"]
STATUS_TO_ORDER_STATUS = {
    "picked_up": "picked_up",
    "out_for_delivery": "out_for_delivery",
    "delivered": "delivered"
}

async def get_current_rider(credentials=Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        rider_id = payload.get("rider_id")
        if not rider_id:
            raise HTTPException(status_code=401, detail="Invalid rider token")
        return rider_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid rider token")

@router.post("/login")
async def rider_login(data: RiderLogin):
    rider = await db.riders.find_one({"phone": data.phone})
    if not rider or not verify_password(data.password, rider.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    if rider.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
    token = create_access_token({"rider_id": rider["id"], "role": "rider"}, expires_in=timedelta(hours=12))
    current_order = None
    if rider.get("current_order_id"):
        order = await db.orders.find_one({"id": rider["current_order_id"]})
        if order:
            current_order = clean_mongo_doc(order)
    await db.riders.update_one({"id": rider["id"]}, {"$set": {"last_seen": datetime.utcnow(), "status": "online"}})
    return {
        "token": token,
        "rider_id": rider["id"],
        "name": rider.get("name"),
        "current_order": current_order
    }

@router.post("/location")
async def update_rider_location(data: RiderLocation, rider_id: str = Depends(get_current_rider)):
    await db.riders.update_one(
        {"id": rider_id},
        {"$set": {"last_lat": data.lat, "last_lng": data.lng, "last_seen": datetime.utcnow()}}
    )
    return {"success": True}

@router.post("/order-status")
async def update_order_status(data: RiderOrderStatus, rider_id: str = Depends(get_current_rider)):
    if data.status not in VALID_RIDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_RIDER_STATUSES}")
    order = await db.orders.find_one({"id": data.order_id, "assigned_rider_id": rider_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to you")
    order_status = STATUS_TO_ORDER_STATUS.get(data.status)
    if order_status:
        from routers.orders import transition_order_status
        await transition_order_status(order["id"], order_status, rider_id, f"Rider updated to {data.status}")
    if data.status == "delivered":
        await db.riders.update_one({"id": rider_id}, {"$set": {"current_order_id": None, "status": "online"}})
    return {"success": True}

@router.get("/current-order")
async def get_current_order(rider_id: str = Depends(get_current_rider)):
    rider = await db.riders.find_one({"id": rider_id})
    if not rider or not rider.get("current_order_id"):
        return {"order": None}
    order = await db.orders.find_one({"id": rider["current_order_id"]})
    return {"order": clean_mongo_doc(order) if order else None}

@router.post("/push-token")
async def save_rider_push_token(payload: dict, rider_id: str = Depends(get_current_rider)):
    token = payload.get("token", "").strip()
    if token:
        await db.riders.update_one({"id": rider_id}, {"$set": {"push_token": token}})
    return {"success": True}
