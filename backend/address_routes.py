"""
GrocerEase — User Address Management Routes
FIX [4]: Saved addresses with geolocation matching.
Add to server.py: from address_routes import router as address_router
                  app.include_router(address_router)
"""
import math
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/user", tags=["addresses"])


class AddressRequest(BaseModel):
    label: str = "Home"          # Home / Work / Other
    full_address: str
    landmark: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class NearestAddressRequest(BaseModel):
    lat: float
    lng: float


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Distance in km between two lat/lng points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))


@router.get("/addresses")
async def get_saved_addresses(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    """Return all saved addresses for the current user."""
    addresses = []
    async for addr in db.addresses.find({"user_id": str(current_user["_id"])}, sort=[("created_at", -1)]):
        addr["id"] = str(addr.pop("_id"))
        addresses.append(addr)
    return {"addresses": addresses}


@router.post("/addresses")
async def save_address(payload: AddressRequest, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    """Save a new delivery address for the user."""
    doc = {
        "user_id": str(current_user["_id"]),
        "label": payload.label,
        "full_address": payload.full_address,
        "landmark": payload.landmark,
        "lat": payload.lat,
        "lng": payload.lng,
        "created_at": datetime.utcnow(),
    }
    result = await db.addresses.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return {"address": doc}


@router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    result = await db.addresses.delete_one({"_id": ObjectId(address_id), "user_id": str(current_user["_id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"status": "deleted"}


@router.post("/addresses/nearest")
async def nearest_address(payload: NearestAddressRequest, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    """
    FIX [4]: Find the saved address nearest to the user's current GPS location.
    Returns the matched address only if it's within 500 metres (0.5 km).
    """
    MATCH_RADIUS_KM = 0.5

    addresses = []
    async for addr in db.addresses.find({"user_id": str(current_user["_id"]), "lat": {"$ne": None}, "lng": {"$ne": None}}):
        addr["id"] = str(addr.pop("_id"))
        addresses.append(addr)

    if not addresses:
        return {"matched_address": None}

    closest = None
    closest_dist = float("inf")

    for addr in addresses:
        dist = haversine_km(payload.lat, payload.lng, addr["lat"], addr["lng"])
        if dist < closest_dist:
            closest_dist = dist
            closest = addr

    if closest and closest_dist <= MATCH_RADIUS_KM:
        return {"matched_address": closest, "distance_km": round(closest_dist, 3)}

    return {"matched_address": None}
