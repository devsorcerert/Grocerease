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
