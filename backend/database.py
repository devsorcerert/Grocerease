from fastapi import HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import time
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
    """Remove MongoDB _id field from document"""
    if isinstance(doc, dict) and "_id" in doc:
        del doc["_id"]
    return doc

def clean_mongo_docs(docs):
    """Remove MongoDB _id field from list of documents"""
    return [clean_mongo_doc(doc) for doc in docs]

# Rate Limiting Store
_rate_limit_store = {}

async def rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    if ip not in _rate_limit_store:
        _rate_limit_store[ip] = []
    _rate_limit_store[ip] = [t for t in _rate_limit_store[ip] if now - t < 60]
    if len(_rate_limit_store[ip]) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again in a minute."
        )
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

