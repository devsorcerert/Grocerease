import os
import asyncio
import uuid
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

logging.basicConfig(level=logging.INFO)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "grocerease")

async def init_db():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    # 1. Create a Default Store
    store_id = "store_default_01"
    store = await db.stores.find_one({"id": store_id})
    if not store:
        await db.stores.insert_one({
            "id": store_id,
            "name": "Central Dark Store",
            "address": "123 Main St, Central District",
            "lat": 17.385044,  # Example: Hyderabad center
            "lng": 78.486671,
            "service_radius_km": 500.0,  # Very large radius for testing
            "is_active": True
        })
        logging.info(f"Created default store: {store_id}")
    else:
        logging.info(f"Default store {store_id} already exists.")
        
    # 2. Populate Store Inventory with all existing products
    products = await db.products.find().to_list(10000)
    inventory_items = []
    for p in products:
        product_id = p["id"]
        inv = await db.store_inventory.find_one({"store_id": store_id, "product_id": product_id})
        if not inv:
            inventory_items.append({
                "store_id": store_id,
                "product_id": product_id,
                "stock": 100,
                "is_active": True
            })
    
    if inventory_items:
        await db.store_inventory.insert_many(inventory_items)
        logging.info(f"Added {len(inventory_items)} products to store {store_id} inventory.")
    else:
        logging.info("Store inventory already populated.")
        
    # 3. Create a Test Rider
    rider_phone = "9999999999"
    rider = await db.riders.find_one({"phone": rider_phone})
    if not rider:
        await db.riders.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Test Rider",
            "phone": rider_phone,
            "password": pwd_context.hash("password123"),
            "status": "offline",
            "current_lat": None,
            "current_lng": None,
            "current_order_id": None
        })
        logging.info(f"Created test rider with phone: {rider_phone}")
    else:
        logging.info("Test rider already exists.")

if __name__ == "__main__":
    asyncio.run(init_db())
