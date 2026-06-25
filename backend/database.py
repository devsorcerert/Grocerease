from fastapi import HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import time
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
from typing import Optional


class MotorClientProxy:
    def __init__(self, mongo_url: str):
        self._mongo_url = mongo_url
        self._client = None
        self._loop = None

    @property
    def client(self):
        import asyncio
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None
        if self._client is None or self._loop is not current_loop:
            self._client = AsyncIOMotorClient(self._mongo_url)
            self._loop = current_loop
        return self._client

    def __getattr__(self, name):
        return getattr(self.client, name)

    def __getitem__(self, name):
        return self.client[name]

    def __repr__(self):
        return repr(self.client)

    def __str__(self):
        return str(self.client)


class MotorDatabaseProxy:
    def __init__(self, client_proxy, db_name: str):
        self._client_proxy = client_proxy
        self._db_name = db_name

    @property
    def db(self):
        return self._client_proxy[self._db_name]

    def __getattr__(self, name):
        return getattr(self.db, name)

    def __getitem__(self, name):
        return self.db[name]

    def __repr__(self):
        return repr(self.db)

    def __str__(self):
        return str(self.db)

mongo_url = os.environ.get('MONGO_URL') or os.environ.get('MONGODB_URL')
if not mongo_url:
    mongo_url = "mongodb://localhost:27017"

client = MotorClientProxy(mongo_url)
db_name = os.environ.get('DB_NAME') or 'grocerease'
db = MotorDatabaseProxy(client, db_name)

DEBUG_MODE = os.environ.get("DEBUG", "false").lower() == "true"
SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or os.environ.get("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("FATAL: JWT_SECRET_KEY environment variable is not set. Refusing to start with insecure fallback.")

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_in: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_in if expires_in is not None else timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.PyJWTError as e:
        logging.warning(f"User authentication token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

async def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        is_admin = payload.get("is_admin", False)
        role = payload.get("role", "")
        if not is_admin or role not in ["super-admin", "ops", "support", "admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except jwt.PyJWTError as e:
        logging.warning(f"Admin authentication failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid admin token")

def clean_mongo_doc(doc):
    """Remove MongoDB _id and normalize legacy field aliases for API reads.

    READ-ONLY: aliases are remapped in the returned dict only — the DB is never
    written back.  Safe to call on any document type; product-specific keys
    (offerPrice, original_price, image_url) are no-ops on non-product docs.
    """
    if not isinstance(doc, dict):
        return doc
    doc.pop("_id", None)

    # Normalize image field name
    # We want to output 'image_url' (CONTRACTS.md §7)
    # Priority: existing image_url > image
    if "image" in doc and "image_url" not in doc:
        doc["image_url"] = doc.pop("image")
    elif "image" in doc and "image_url" in doc:
        doc.pop("image")

    # Guarded helper to safely convert float prices to paise ints
    def _to_paise(val):
        if val is None:
            return None
        try:
            val_float = float(val)
            # If the original schema was float but it's >= 1000 and has no decimal part,
            # it MIGHT have already been paise. But we rely on the key name instead.
            return int(val_float * 100)
        except (ValueError, TypeError):
            return None

    # Map Selling Price -> price_paise
    if "price_paise" not in doc:
        legacy_price = doc.pop("price", None)
        legacy_offer = doc.pop("offer_price", None) or doc.pop("offerPrice", None)
        # Use offer_price as selling price if available, else price
        selling_price = legacy_offer if legacy_offer is not None else legacy_price
        if selling_price is not None:
            doc["price_paise"] = _to_paise(selling_price)
    else:
        # Already has price_paise, just clean up legacy keys
        doc.pop("price", None)
        doc.pop("offer_price", None)
        doc.pop("offerPrice", None)
        
    # Map MRP -> mrp_paise
    if "mrp_paise" not in doc:
        legacy_mrp = doc.pop("original_price", None) or doc.pop("mrp", None)
        if legacy_mrp is not None:
            doc["mrp_paise"] = _to_paise(legacy_mrp)
    else:
        doc.pop("original_price", None)
        doc.pop("mrp", None)

    return doc

def clean_mongo_docs(docs):
    """Apply clean_mongo_doc to a list of documents."""
    return [clean_mongo_doc(doc) for doc in docs]

# Rate Limiting Store
import redis.asyncio as aioredis

REDIS_URL = os.environ.get("REDIS_URL", "")
_redis_client = None
_rate_limit_store = {}  # Fallback for dev when Redis is not available

async def get_redis():
    global _redis_client
    if REDIS_URL and _redis_client is None:
        _redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client

async def rate_limit(request: Request):
    if os.environ.get("DB_NAME") == "grocerease_test":
        return
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = 60
    max_requests = 30
    
    redis = await get_redis()
    if redis:
        key = f"rate_limit:{ip}"
        try:
            current = await redis.incr(key)
            if current == 1:
                await redis.expire(key, window)
            if current > max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again in a minute."
                )
            return
        except Exception as e:
            logging.warning(f"Redis rate limit error, falling back to in-memory: {e}")
    
    # In-memory fallback (dev only)
    if ip not in _rate_limit_store:
        _rate_limit_store[ip] = []
    _rate_limit_store[ip] = [t for t in _rate_limit_store[ip] if now - t < window]
    if len(_rate_limit_store[ip]) >= max_requests:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again in a minute.")
    _rate_limit_store[ip].append(now)

# Persistent OTP helpers using MongoDB
async def set_otp(key: str, otp: str, expires_in_seconds: int = 300):
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in_seconds)
    await db.otps.update_one(
        {"key": key},
        {"$set": {"otp": otp, "expires_at": expires_at}},
        upsert=True
    )

async def verify_and_clear_otp(key: str, otp: str) -> bool:
    doc = await db.otps.find_one({"key": key})
    if not doc:
        return False
    # Manually check expiry
    if datetime.utcnow() > doc["expires_at"]:
        await db.otps.delete_one({"key": key})
        return False
    if doc["otp"] == otp:
        await db.otps.delete_one({"key": key})
        return True
    return False

# Twilio SMS integration
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER", "")

import httpx

async def send_sms_twilio(phone: str, message_body: str) -> bool:
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_PHONE_NUMBER:
        if DEBUG_MODE:
            print(f"\n========================================\n[DEV SMS] To {phone}: {message_body}\n========================================\n")
        else:
            print(f"\n[DEV SMS] SMS requested for {phone} (hidden in prod)\n")
        return True
    try:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
        auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        data = {
            "From": TWILIO_PHONE_NUMBER,
            "To": phone,
            "Body": message_body
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, auth=auth, data=data, timeout=10)
            if resp.status_code == 201:
                logging.info(f"Twilio SMS sent successfully to {phone}")
                return True
            else:
                logging.error(f"Twilio SMS failed to {phone}: {resp.status_code} {resp.text}")
                return False
    except Exception as e:
        logging.error(f"Twilio SMS exception for {phone}: {e}")
        return False

async def send_push_notification(push_token: str, title: str, body: str, data: dict = {}):
    if not push_token or not push_token.startswith("ExponentPushToken"):
        return
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://exp.host/--/api/v2/push/send",
                json={"to": push_token, "title": title, "body": body, "data": data},
                timeout=10
            )
    except Exception as e:
        logging.error(f"Push notification failed: {e}")


async def insert_notification(user_id: str, title: str, message: str, notif_type: str, action_route: str = ""):
    """Store an in-app notification in MongoDB."""
    try:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notif_type,
            "action_route": action_route,
            "read": False,
            "created_at": datetime.utcnow(),
        })
    except Exception as e:
        logging.error(f"insert_notification failed: {e}")

