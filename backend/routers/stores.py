"""
routers/stores.py — Dark-store management & serviceability (Task 20)

Haversine distance is computed in pure Python — no Mongo geo operators —
so the existing mongomock-based contract tests can cover these routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from math import radians, sin, cos, sqrt, asin
from typing import Optional
import uuid
from pydantic import BaseModel
from database import db, verify_admin, clean_mongo_doc, clean_mongo_docs

router = APIRouter(tags=["Stores"])


# ---------------------------------------------------------------------------
# Pure-Python Haversine (avoids mongomock geo limitations in CI)
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * R * asin(sqrt(a))


async def find_serving_store(lat: float, lng: float) -> Optional[dict]:
    """
    Return the nearest active store that can serve the given coordinates,
    or None if no store's radius covers the point.
    """
    stores = await db.stores.find({"is_active": True}).to_list(100)
    best = None
    best_dist = float("inf")
    for store in stores:
        slat = store.get("lat")
        slng = store.get("lng")
        if slat is None or slng is None:
            continue
        dist = haversine_km(lat, lng, float(slat), float(slng))
        if dist <= store.get("radius_km", 5.0) and dist < best_dist:
            best = store
            best_dist = dist
    return best


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class StoreCreate(BaseModel):
    name: str
    address: str
    lat: float
    lng: float
    radius_km: float = 5.0
    is_active: bool = True


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: Optional[float] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@router.get("/stores")
async def list_stores():
    """List all active dark stores (public — used by customer app)."""
    stores = await db.stores.find({"is_active": True}).to_list(100)
    return {"stores": clean_mongo_docs(stores)}


@router.get("/stores/serviceability")
async def check_serviceability(
    lat: float = Query(..., description="Delivery latitude"),
    lng: float = Query(..., description="Delivery longitude"),
):
    """
    Check whether a delivery coordinate is within any active store's service radius.

    Returns:
        { "serviceable": true,  "store": { ...store doc... } }
      | { "serviceable": false, "store": null }
    """
    store = await find_serving_store(lat, lng)
    if store:
        return {"serviceable": True, "store": clean_mongo_doc(store)}
    return {"serviceable": False, "store": None}


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@router.post("/admin/stores")
async def create_store(data: StoreCreate, admin=Depends(verify_admin)):
    """Create a new dark store (admin only)."""
    store = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "address": data.address.strip(),
        "lat": data.lat,
        "lng": data.lng,
        "radius_km": data.radius_km,
        "is_active": data.is_active,
        "created_at": datetime.utcnow(),
    }
    await db.stores.insert_one(store)
    return clean_mongo_doc(store)


@router.put("/admin/stores/{store_id}")
async def update_store(store_id: str, data: StoreUpdate, admin=Depends(verify_admin)):
    """Update store details or toggle active/inactive (admin only)."""
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = datetime.utcnow()
    result = await db.stores.update_one({"id": store_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Store not found")
    store = await db.stores.find_one({"id": store_id})
    return clean_mongo_doc(store)


@router.get("/admin/stores")
async def admin_list_stores(admin=Depends(verify_admin)):
    """List all stores including inactive (admin only)."""
    stores = await db.stores.find({}).to_list(100)
    return {"stores": clean_mongo_docs(stores)}
