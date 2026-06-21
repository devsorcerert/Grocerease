import asyncio
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from passlib.context import CryptContext

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def init_database():
    mongo_url = os.environ.get('MONGO_URL') or os.environ.get('MONGODB_URL') or "mongodb://localhost:27017"
    db_name = os.environ.get('DB_NAME') or 'grocerease'
    
    logging.info(f"Connecting to MongoDB at {mongo_url} (DB: {db_name})...")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Ping the DB
        await client.admin.command('ping')
        logging.info("Connected successfully to MongoDB!")
        
        # 1. Create User Indexes
        logging.info("Creating users indexes...")
        await db.users.create_index("email", unique=True)
        await db.users.create_index("phone", unique=True, sparse=True)
        await db.users.create_index("id", unique=True)
        
        # 2. Create Order Indexes
        logging.info("Creating orders indexes...")
        await db.orders.create_index("user_id")
        await db.orders.create_index("id", unique=True)
        await db.orders.create_index("status")
        await db.orders.create_index("created_at")
        
        # 3. Create Product Indexes
        logging.info("Creating products indexes...")
        await db.products.create_index("category")
        await db.products.create_index("id", unique=True)
        await db.products.create_index([("name", "text"), ("description", "text")])
        
        # 4. Create Token Blacklist Indexes
        logging.info("Creating token blacklist indexes...")
        await db.blacklisted_tokens.create_index("token", unique=True)
        await db.blacklisted_tokens.create_index("expires_at", expireAfterSeconds=0)
        
        # 5. Create Cart Item Indexes
        logging.info("Creating cart items indexes...")
        await db.cart_items.create_index([("user_id", 1), ("product_id", 1)], unique=True)
        
        # 6. Create OTP Indexes
        logging.info("Creating OTP indexes...")
        await db.otps.create_index("key", unique=True)
        await db.otps.create_index("expires_at", expireAfterSeconds=0)
        
        # 7. Create Admin Indexes
        logging.info("Creating admin indexes...")
        await db.admins.create_index("email", unique=True)
        await db.admins.create_index("id", unique=True)
        
        # 8. Create Order Event Indexes
        logging.info("Creating order events indexes...")
        await db.order_events.create_index("order_id")
        await db.order_events.create_index("timestamp")
        
        # 9. Create Rider Indexes
        logging.info("Creating riders indexes...")
        await db.riders.create_index("id", unique=True)
        await db.riders.create_index("phone", unique=True)
        await db.riders.create_index("status")
        
        # Seed default admin if empty
        admin_count = await db.admins.count_documents({})
        if admin_count == 0:
            admin_email = os.environ.get("ADMIN_EMAIL", "grocereasetv@gmail.com")
            admin_password = os.environ.get("ADMIN_PASSWORD")
            if not admin_password:
                logging.warning(
                    "ADMIN_PASSWORD env var not set — skipping admin seed. "
                    "Set it before first deploy."
                )
                return

            await db.admins.insert_one({
                "id": "default-admin-id",
                "email": admin_email.lower().strip(),
                "password": hash_password(admin_password),
                "role": "super-admin",
                "name": "Super Admin",
                "created_at": datetime.utcnow()
            })
            logging.info(f"Seeded default admin user: {admin_email} with role: super-admin")
            
        logging.info("Database initialization and index creation complete!")
    except Exception as e:
        logging.error(f"Error initializing database: {e}")
        raise e
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(init_database())
