from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import uuid
from pydantic import BaseModel
from typing import Optional
from database import db, verify_admin, hash_password, clean_mongo_doc

router = APIRouter(prefix="/admin/riders", tags=["Admin Riders"])


class CreateRiderRequest(BaseModel):
    name: str
    phone: str
    password: str
    vehicle: Optional[str] = "Bike"


@router.post("")
async def create_rider(data: CreateRiderRequest, admin=Depends(verify_admin)):
    phone = data.phone.strip()
    if await db.riders.find_one({"phone": phone}):
        raise HTTPException(status_code=400, detail="A rider with this phone number already exists")

    rider = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "phone": phone,
        "password": hash_password(data.password),
        "vehicle": (data.vehicle or "Bike").strip(),
        "status": "offline",
        "current_order_id": None,
        "current_location": None,
        "push_token": None,
        "rating": 5.0,
        "created_at": datetime.utcnow(),
    }
    await db.riders.insert_one(rider)
    rider.pop("password")
    return clean_mongo_doc(rider)


@router.get("")
async def list_riders(admin=Depends(verify_admin)):
    riders = await db.riders.find({}).to_list(500)
    return [
        {
            "id": r["id"],
            "name": r.get("name", ""),
            "phone": r.get("phone", ""),
            "vehicle": r.get("vehicle", "Bike"),
            "status": r.get("status", "offline"),
            "current_order_id": r.get("current_order_id"),
            "availability": r.get("current_order_id") is None,
        }
        for r in riders
    ]


# ---------------------------------------------------------------------------
# Task 30 (admin half) — Rider onboarding review
# ---------------------------------------------------------------------------

@router.get("/pending")
async def list_pending_riders(admin=Depends(verify_admin)):
    """List riders awaiting approval (status = pending_approval)."""
    riders = await db.riders.find({"status": "pending_approval"}).to_list(200)
    return [
        {
            "id": r["id"],
            "name": r.get("name", ""),
            "phone": r.get("phone", ""),
            "vehicle": r.get("vehicle", "Bike"),
            "created_at": r.get("created_at"),
        }
        for r in riders
    ]


@router.post("/{rider_id}/approve")
async def approve_rider(rider_id: str, admin=Depends(verify_admin)):
    """Approve a pending rider — sets status to offline (ready to log in)."""
    rider = await db.riders.find_one({"id": rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    if rider.get("status") != "pending_approval":
        raise HTTPException(
            status_code=400,
            detail=f"Rider is not pending approval (current status: {rider.get('status')})"
        )
    await db.riders.update_one(
        {"id": rider_id},
        {"$set": {"status": "offline", "approved_at": datetime.utcnow()}}
    )
    return {"success": True, "rider_id": rider_id, "status": "offline"}


@router.post("/{rider_id}/suspend")
async def suspend_rider(rider_id: str, admin=Depends(verify_admin)):
    """Suspend a rider (blocks login)."""
    result = await db.riders.update_one(
        {"id": rider_id},
        {"$set": {"status": "suspended"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rider not found")
    return {"success": True, "rider_id": rider_id, "status": "suspended"}
