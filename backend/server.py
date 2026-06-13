from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import time
import hmac
import hashlib
import httpx
import razorpay
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL') or os.environ.get('MONGODB_URL')
if not mongo_url:
    # Default fallback for local testing if nothing is provided
    mongo_url = "mongodb://localhost:27017"
client = AsyncIOMotorClient(mongo_url)
db_name = os.environ.get('DB_NAME') or 'grocerease'
db = client[db_name]

_otp_store = {}
DEBUG_MODE = os.environ.get("DEBUG", "false").lower() == "true"
FAST2SMS_API_KEY = os.environ.get("FAST2SMS_API_KEY", "")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID") or ""
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET") or ""

if os.environ.get("ENV", "development") != "development":
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise RuntimeError("FATAL: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured via environment variables in production mode.")
else:
    if not RAZORPAY_KEY_ID:
        RAZORPAY_KEY_ID = "rzp_test_T0sGXqleYVJXe7"
    if not RAZORPAY_KEY_SECRET:
        RAZORPAY_KEY_SECRET = "wPwUglFR3xnF1SAE5dTcTemd"
# Rate Limiting Store and Dependency
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


# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

@app.on_event("startup")
async def startup_db_client():
    try:
        # Ping the database to verify the connection
        await client.admin.command('ping')
        logging.info("Successfully connected to MongoDB!")
        
        # Create MongoDB indexes
        await db.users.create_index("email", unique=True)
        await db.users.create_index("phone", unique=True, sparse=True)
        await db.orders.create_index("user_id")
        await db.orders.create_index("id", unique=True)
        await db.products.create_index("category")
        await db.products.create_index("id", unique=True)
        await db.products.create_index([("name", "text"), ("description", "text")])
        logging.info("MongoDB indexes verified/created successfully!")
    except Exception as e:
        logging.error(f"Failed to connect to MongoDB or initialize indexes on startup: {e}")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@api_router.get("/health")
async def api_health_check():
    return {"status": "ok"}



def clean_mongo_doc(doc):
    """Remove MongoDB _id field from document"""
    if isinstance(doc, dict) and "_id" in doc:
        del doc["_id"]
    return doc

def clean_mongo_docs(docs):
    """Remove MongoDB _id field from list of documents"""
    return [clean_mongo_doc(doc) for doc in docs]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or os.environ.get("JWT_SECRET")
if not SECRET_KEY:
    logging.warning("JWT_SECRET_KEY environment variable is not set! Using insecure fallback secret key.")
    raise RuntimeError("FATAL: JWT_SECRET_KEY environment variable is not set. Refusing to start with insecure fallback.")

ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# Models
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    id_token: str
    name: str
    email: Optional[str] = None
    photo: Optional[str] = None

class CableTVLink(BaseModel):
    user_id_nuid: str
    phone: str
    service_provider: str

class ProductCreate(BaseModel):
    name: str
    category: str
    subcategory: str
    price: float
    original_price: Optional[float] = None
    image: str
    stock: int = 100
    unit: str = "1 kg"
    description: Optional[str] = ""
    sku: Optional[str] = None
    barcode: Optional[str] = None
    brand: Optional[str] = None
    supplier: Optional[str] = None
    min_stock_level: Optional[int] = 10
    max_stock_level: Optional[int] = 1000
    discount_percentage: Optional[float] = 0.0
    is_active: Optional[bool] = True
    tags: Optional[List[str]] = []
    weight: Optional[float] = None
    dimensions: Optional[str] = None
    shelf_life_days: Optional[int] = None

class BulkProductUpload(BaseModel):
    products: List[dict]

class CartItem(BaseModel):
    product_id: str
    quantity: int

class OrderCreate(BaseModel):
    items: List[dict]
    subtotal: float = 0
    reward_applied: float = 0
    total: float = 0
    payment_method: str = "COD"
    delivery_address: Optional[str] = None
    phone: Optional[str] = None

class VideoCreate(BaseModel):
    title: str
    description: str
    thumbnail: str
    stream_url: Optional[str] = None
    duration: str = "00:00"
    ingredients: List[dict] = []
    is_live: bool = False

class SendOtpRequest(BaseModel):
    phone: str

class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None

class CreatePaymentRequest(BaseModel):
    order_id: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: str

class CouponCreate(BaseModel):
    code: str
    discount_percentage: Optional[float] = 0.0
    discount_amount: Optional[float] = 0.0
    min_order_value: float = 0.0
    max_discount: Optional[float] = None
    valid_until: datetime
    is_active: bool = True

class CouponValidate(BaseModel):
    code: str
    subtotal: float

class CreateOrderRequest(BaseModel):
    address_id: str
    payment_method: str
    coupon_code: Optional[str] = None


# Auth Routes
@api_router.post("/auth/register")
async def register(user: UserRegister, _=Depends(rate_limit)):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = {
        "id": str(uuid.uuid4()),
        "name": user.name,
        "email": user.email,
        "password": hash_password(user.password),
        "phone": user.phone,
        "address": user.address,
        "city": user.city,
        "pincode": user.pincode,
        "cable_tv_linked": False,
        "cable_tv_details": None,
        "monthly_spend": 0.0,
        "total_spend": 0.0,
        "current_reward": 0.0,
        "is_admin": False,
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(user_dict)
    token = create_access_token({"user_id": user_dict["id"]})
    refresh_token = create_access_token({"user_id": user_dict["id"], "type": "refresh"})
    
    return {"token": token, "refresh_token": refresh_token, "user": {"id": user_dict["id"], "name": user_dict["name"], "email": user_dict["email"], "phone": user_dict["phone"], "address": user_dict["address"], "city": user_dict["city"], "pincode": user_dict["pincode"]}}

@api_router.post("/auth/update-profile")
async def update_profile(profile: ProfileUpdate, user_id: str = Depends(get_current_user)):
    update_data = {}
    if profile.name is not None:
        update_data["name"] = profile.name
    if profile.email is not None:
        update_data["email"] = profile.email
    if profile.phone is not None:
        update_data["phone"] = profile.phone
    if profile.address is not None:
        update_data["address"] = profile.address
    if profile.city is not None:
        update_data["city"] = profile.city
    if profile.pincode is not None:
        update_data["pincode"] = profile.pincode
    
    if update_data:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
    return {"success": True}

@api_router.post("/auth/login")
async def login(user: UserLogin, _=Depends(rate_limit)):
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": db_user["id"]})
    refresh_token = create_access_token({"user_id": db_user["id"], "type": "refresh"})
    return {"token": token, "refresh_token": refresh_token, "user": {"id": db_user["id"], "name": db_user["name"], "email": db_user["email"], "phone": db_user.get("phone"), "photo": db_user.get("photo"), "is_admin": db_user.get("is_admin", False), "auth_provider": db_user.get("auth_provider", "email")}}

@api_router.post("/auth/logout")
async def logout(user_id: str = Depends(get_current_user)):
    """
    Logout endpoint - In JWT implementation, logout is handled client-side
    by removing the token. Server-side logout would require token blacklisting.
    """
    try:
        # Log the logout event for audit purposes
        print(f"User {user_id} logged out at {datetime.utcnow()}")
        
        # In a production environment, you might want to:
        # 1. Add token to blacklist in database/Redis
        # 2. Record logout event for analytics
        # 3. Clean up any user sessions
        
        return {"message": "Logout successful", "success": True}
    except Exception:
        raise HTTPException(status_code=500, detail="Logout failed")

@api_router.post("/auth/refresh")
async def refresh_token(request: dict):
    """
    Refresh token endpoint for token renewal
    Expects: {"refresh_token": "old_refresh_token"}
    Returns: {"token": "new_access_token", "refresh_token": "new_refresh_token"}
    """
    try:
        old_refresh_token = request.get("refresh_token")
        if not old_refresh_token:
            raise HTTPException(status_code=400, detail="Refresh token required")
        
        # Decode and validate the refresh token
        try:
            payload = jwt.decode(old_refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("user_id")
            token_type = payload.get("type")
            
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid refresh token - no user_id")
            
            # Verify it's actually a refresh token
            if token_type != "refresh":
                raise HTTPException(status_code=401, detail="Invalid token type")
            
            # Verify user still exists
            user = await db.users.find_one({"id": user_id})
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            
            # Generate new tokens with proper user_id
            new_access_token = create_access_token({"user_id": user_id})
            new_refresh_token = create_access_token({"user_id": user_id, "type": "refresh"})
            
            return {
                "token": new_access_token,
                "refresh_token": new_refresh_token
            }
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Refresh token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Token refresh failed")

@api_router.post("/auth/google")
async def google_auth(auth_data: GoogleAuthRequest, _=Depends(rate_limit)):
    # Verify the Google ID Token securely
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={auth_data.id_token}",
                timeout=10
            )
            if response.status_code != 200:
                logging.error(f"Google TokenInfo verification failed: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, 
                    detail="Invalid or expired Google ID Token"
                )
            
            token_info = response.json()
            
            # Additional validation
            verified_email = token_info.get("email")
            if not verified_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="Email address not found in Google ID Token"
                )
            
            # Verify the audience (client ID) matches our app's client IDs
            aud = token_info.get("aud")
            allowed_clients = {
                "418665414188-rl2jg740eersokldgp9ojnr6ue7uvc0r.apps.googleusercontent.com",
                "418665414188-mdmkg84jnujtmr3nvhkop74ifp78nr9k.apps.googleusercontent.com",
                "418665414188-3teeuukmq7m66m5lra36mc6be32i1n2f.apps.googleusercontent.com"
            }
            if aud not in allowed_clients:
                logging.error(f"Google ID Token audience mismatch: {aud}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google ID Token audience verification failed"
                )
            
            # Use securely verified email and details
            email = verified_email.lower()
            name = token_info.get("name", auth_data.name)
            photo = token_info.get("picture", auth_data.photo)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Google authentication error during token verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=f"Google authentication failed: {str(e)}"
        )
        
    db_user = await db.users.find_one({"email": email})
    
    if not db_user:
        user_dict = {
            "id": str(uuid.uuid4()),
            "name": name,
            "email": email,
            "password": None,
            "phone": None,
            "photo": photo,
            "cable_tv_linked": False,
            "cable_tv_details": None,
            "monthly_spend": 0.0,
            "total_spend": 0.0,
            "current_reward": 0.0,
            "is_admin": False,
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user_dict)
        db_user = user_dict
    else:
        update_fields = {}
        if "id" not in db_user:
            db_user["id"] = str(uuid.uuid4())
            update_fields["id"] = db_user["id"]
        
        # Keep name and photo updated in database
        if db_user.get("name") != name or db_user.get("photo") != photo:
            update_fields["name"] = name
            update_fields["photo"] = photo
            db_user["name"] = name
            db_user["photo"] = photo
            
        if update_fields:
            await db.users.update_one(
                {"_id": db_user["_id"]},
                {"$set": update_fields}
            )
    
    token = create_access_token({"user_id": db_user["id"]})
    refresh_token = create_access_token({"user_id": db_user["id"], "type": "refresh"})
    return {"token": token, "refresh_token": refresh_token, "user": {"id": db_user["id"], "name": db_user["name"], "email": db_user["email"], "phone": db_user.get("phone"), "photo": db_user.get("photo"), "is_admin": db_user.get("is_admin", False), "auth_provider": db_user.get("auth_provider", "email")}}


class SocialAuthRequest(BaseModel):
    provider: str  # "google", "apple", "email"
    email: str
    name: Optional[str] = None
    photo: Optional[str] = None
    session_token: Optional[str] = None

@api_router.post("/auth/social")
async def social_auth(auth_data: SocialAuthRequest, _=Depends(rate_limit)):
    """Unified social auth endpoint for Google, Apple, and other providers"""
    if not auth_data.email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    db_user = await db.users.find_one({"email": auth_data.email})
    
    if not db_user:
        # Create new user
        user_dict = {
            "id": str(uuid.uuid4()),
            "name": auth_data.name or auth_data.email.split("@")[0],
            "email": auth_data.email,
            "password": None,
            "phone": None,
            "photo": auth_data.photo,
            "auth_provider": auth_data.provider,
            "cable_tv_linked": False,
            "cable_tv_details": None,
            "monthly_spend": 0.0,
            "total_spend": 0.0,
            "current_reward": 0.0,
            "is_admin": False,
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user_dict)
        db_user = user_dict
    else:
        if "id" not in db_user:
            db_user["id"] = str(uuid.uuid4())
            await db.users.update_one(
                {"_id": db_user["_id"]},
                {"$set": {"id": db_user["id"]}}
            )
    
    # Store session if provided
    if auth_data.session_token:
        await db.user_sessions.update_one(
            {"user_id": db_user["id"]},
            {"$set": {
                "session_token": auth_data.session_token,
                "user_id": db_user["id"],
                "expires_at": datetime.utcnow() + timedelta(days=7),
                "created_at": datetime.utcnow()
            }},
            upsert=True
        )
    
    token = create_access_token({"user_id": db_user["id"]})
    refresh_token = create_access_token({"user_id": db_user["id"], "type": "refresh"})
    
    return {
        "token": token,
        "refresh_token": refresh_token,
        "user": {
            "id": db_user["id"],
            "name": db_user.get("name", ""),
            "email": db_user["email"],
            "photo": db_user.get("photo"),
            "auth_provider": db_user.get("auth_provider", auth_data.provider),
            "is_admin": db_user.get("is_admin", False)
        }
    }


@api_router.get("/auth/me")
async def get_me(user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user.get("phone"),
        "address": user.get("address"),
        "city": user.get("city"),
        "pincode": user.get("pincode"),
        "cable_tv_linked": user.get("cable_tv_linked", False),
        "cable_tv_details": user.get("cable_tv_details"),
        "monthly_spend": user.get("monthly_spend", 0.0),
        "current_reward": user.get("current_reward", 0.0),
        "is_admin": user.get("is_admin", False)
    }

# Cable TV Routes
@api_router.post("/cable-tv/link")
async def link_cable_tv(data: CableTVLink, user_id: str = Depends(get_current_user)):
    """
    Cable TV linking with infrastructure ready for real API integration
    Future: Will integrate with actual cable TV provider APIs for verification
    """
    try:
        # Infrastructure provision: Real API integration placeholder
        verification_result = await verify_cable_tv_details(data.dict())
        
        cable_tv_details = {
            **data.dict(),
            "verification_status": verification_result.get("status", "mock_success"),
            "api_response": verification_result.get("response", "Mock verification - API integration pending"),
            "linked_at": datetime.utcnow(),
            "sync_enabled": True,  # Provision for real-time spending sync
            "last_sync": datetime.utcnow()
        }
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "cable_tv_linked": True,
                "cable_tv_details": cable_tv_details
            }}
        )
        
        return {
            "success": True,
            "message": "Cable TV linked successfully",
            "verification_status": cable_tv_details["verification_status"],
            "infrastructure_ready": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cable TV linking failed: {str(e)}")

async def verify_cable_tv_details(cable_details: dict) -> dict:
    """
    Infrastructure function ready for real cable TV API integration
    Current: Mock verification
    Future: Real API calls to cable TV providers
    """
    # Mock verification - Replace with real API calls
    service_provider = cable_details.get("service_provider", "")
    user_id_nuid = cable_details.get("user_id_nuid", "")
    phone = cable_details.get("phone", "")
    
    # Provision for real API integration
    if service_provider and user_id_nuid and phone:
        # Mock successful verification
        return {
            "status": "verified",
            "response": f"Mock verification successful for {service_provider}",
            "api_integration_required": True,
            "supported_providers": ["Tata Sky", "Airtel Digital TV", "Dish TV", "Sun Direct", "Hathway", "DEN Networks"]
        }
    else:
        return {
            "status": "failed",
            "response": "Invalid cable TV details provided",
            "api_integration_required": True
        }

@api_router.get("/cable-tv/sync-status")
async def get_cable_tv_sync_status(user_id: str = Depends(get_current_user)):
    """
    Get cable TV sync status - ready for real API integration
    """
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("cable_tv_linked"):
        raise HTTPException(status_code=404, detail="Cable TV not linked")
    
    cable_details = user.get("cable_tv_details", {})
    
    return {
        "linked": True,
        "service_provider": cable_details.get("service_provider"),
        "verification_status": cable_details.get("verification_status", "unknown"),
        "last_sync": cable_details.get("last_sync"),
        "sync_enabled": cable_details.get("sync_enabled", False),
        "infrastructure_ready": True,
        "api_integration_status": "pending"
    }

@api_router.post("/cable-tv/force-sync")
async def force_cable_tv_sync(user_id: str = Depends(get_current_user)):
    """
    Force sync with cable TV provider - infrastructure ready for real API
    """
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("cable_tv_linked"):
        raise HTTPException(status_code=404, detail="Cable TV not linked")
    
    # Mock sync process - Replace with real API calls
    sync_result = {
        "status": "success",
        "last_sync": datetime.utcnow(),
        "spending_data": {
            "current_month": user.get("monthly_spend", 0),
            "sync_method": "mock",
            "api_integration_required": True
        }
    }
    
    # Update last sync time
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"cable_tv_details.last_sync": datetime.utcnow()}}
    )
    
    return sync_result

# Product Routes
@api_router.get("/products")
async def get_products(
    category: Optional[str] = None, 
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = None,  # price_asc, price_desc, name_asc, name_desc, popularity, rating
    in_stock: Optional[bool] = None,
    brand: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    query = {}
    
    # Category filter
    if category:
        query["category"] = category
    
    # Search filter (searches in name, description, brand)
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}}
        ]
    
    # Price range filter
    if min_price is not None or max_price is not None:
        query["price"] = {}
        if min_price is not None:
            query["price"]["$gte"] = min_price
        if max_price is not None:
            query["price"]["$lte"] = max_price
    
    # Stock filter
    if in_stock is not None:
        if in_stock:
            query["stock"] = {"$gt": 0}
        else:
            query["stock"] = 0
    
    # Brand filter
    if brand:
        query["brand"] = brand
    
    # Sorting
    sort_options = {
        "price_asc": ("price", 1),
        "price_desc": ("price", -1),
        "name_asc": ("name", 1),
        "name_desc": ("name", -1),
        "popularity": ("popularity", -1),
        "rating": ("rating", -1)
    }
    
    sort_field, sort_order = sort_options.get(sort_by, ("created_at", -1))
    
    # Get total count for pagination
    total_count = await db.products.count_documents(query)
    
    # Fetch products with pagination
    products = await db.products.find(query).sort(sort_field, sort_order).skip(skip).limit(limit).to_list(limit)
    
    # Remove MongoDB _id field
    for product in products:
        if "_id" in product:
            del product["_id"]
    
    return {
        "products": products,
        "total": total_count,
        "limit": limit,
        "skip": skip,
        "has_more": (skip + limit) < total_count
    }


@api_router.get("/products/filters/options")
async def get_filter_options():
    """Get available filter options for products"""
    # Get unique categories
    categories = await db.products.distinct("category")
    
    # Get unique brands
    brands = await db.products.distinct("brand")
    
    # Get price range
    all_products = await db.products.find({}, {"price": 1}).to_list(10000)
    prices = [p.get("price", 0) for p in all_products if p.get("price")]
    
    min_price = min(prices) if prices else 0
    max_price = max(prices) if prices else 0
    
    return {
        "categories": sorted([c for c in categories if c]),
        "brands": sorted([b for b in brands if b]),
        "price_range": {
            "min": round(min_price, 2),
            "max": round(max_price, 2)
        }
    }

@api_router.post("/products/compare")
async def compare_products(product_ids: List[str]):
    """Compare multiple products"""
    if len(product_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 products required for comparison")
    if len(product_ids) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 products can be compared")
    
    products = []
    for product_id in product_ids:
        product = await db.products.find_one({"id": product_id})
        if product:
            products.append(clean_mongo_doc(product))
    
    if len(products) < 2:
        raise HTTPException(status_code=404, detail="Not enough products found")
    
    # Calculate comparison metrics
    price_comparison = {
        "lowest": min(p.get("price", float('inf')) for p in products),
        "highest": max(p.get("price", 0) for p in products),
        "average": sum(p.get("price", 0) for p in products) / len(products)
    }
    
    return {
        "products": products,
        "comparison": {
            "price": price_comparison,
            "total_compared": len(products)
        }
    }

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return clean_mongo_doc(product)

@api_router.post("/products")
async def create_product(product: ProductCreate, user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    product_dict = {
        "id": str(uuid.uuid4()),
        **product.dict(),
        "created_at": datetime.utcnow()
    }
    await db.products.insert_one(product_dict)
    return clean_mongo_doc(product_dict)

@api_router.post("/products/bulk")
async def bulk_upload_products(upload: BulkProductUpload, user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    products_to_insert = []
    for product_data in upload.products:
        product_dict = {
            "id": str(uuid.uuid4()),
            **product_data,
            "created_at": datetime.utcnow()
        }
        products_to_insert.append(product_dict)
    
    if products_to_insert:
        await db.products.insert_many(products_to_insert)
    
    return {"success": True, "count": len(products_to_insert), "message": f"{len(products_to_insert)} products uploaded"}

@api_router.get("/products/analytics")
async def get_product_analytics(user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all products for analytics
    all_products = await db.products.find().to_list(10000)
    
    # Calculate KPIs
    total_products = len(all_products)
    total_stock_value = sum(p.get("price", 0) * p.get("stock", 0) for p in all_products)
    low_stock_items = len([p for p in all_products if p.get("stock", 0) < p.get("min_stock_level", 10)])
    out_of_stock = len([p for p in all_products if p.get("stock", 0) == 0])
    active_products = len([p for p in all_products if p.get("is_active", True)])
    
    # Category breakdown
    category_stats = {}
    for product in all_products:
        cat = product.get("category", "Uncategorized")
        if cat not in category_stats:
            category_stats[cat] = {"count": 0, "stock_value": 0}
        category_stats[cat]["count"] += 1
        category_stats[cat]["stock_value"] += product.get("price", 0) * product.get("stock", 0)
    
    return {
        "total_products": total_products,
        "active_products": active_products,
        "total_stock_value": round(total_stock_value, 2),
        "low_stock_items": low_stock_items,
        "out_of_stock": out_of_stock,
        "categories": category_stats,
        "avg_price": round(sum(p.get("price", 0) for p in all_products) / total_products if total_products > 0 else 0, 2)
    }

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return {"success": True, "message": "Product deleted"}

# Cart Routes
@api_router.get("/cart")
async def get_cart(user_id: str = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        return {"user_id": user_id, "items": []}
    return clean_mongo_doc(cart)

@api_router.post("/cart/add")
async def add_to_cart(item: CartItem, user_id: str = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user_id})
    
    if not cart:
        cart = {"user_id": user_id, "items": []}
    
    item_exists = False
    for cart_item in cart["items"]:
        if cart_item["product_id"] == item.product_id:
            cart_item["quantity"] += item.quantity
            item_exists = True
            break
    
    if not item_exists:
        cart["items"].append(item.dict())
    
    cart["updated_at"] = datetime.utcnow()
    
    await db.carts.update_one({"user_id": user_id}, {"$set": cart}, upsert=True)
    return clean_mongo_doc(cart)

@api_router.post("/cart/add-bulk")
async def add_bulk_ingredients_to_cart(ingredients: dict, user_id: str = Depends(get_current_user)):
    """
    Bulk add ingredients from GrocerEase TV videos to cart
    Infrastructure ready for real ingredient-product mapping APIs
    """
    try:
        cart = await db.carts.find_one({"user_id": user_id})
        
        if not cart:
            cart = {"user_id": user_id, "items": []}
        
        added_count = 0
        failed_ingredients = []
        
        for ingredient in ingredients.get("ingredient_list", []):
            product_id = ingredient.get("product_id")
            quantity = ingredient.get("quantity", 1)
            
            if not product_id:
                # Infrastructure provision: Future API integration for ingredient-product mapping
                failed_ingredients.append({
                    "name": ingredient.get("name", "Unknown"),
                    "reason": "Product mapping not available - API integration required"
                })
                continue
                
            # Verify product exists
            product = await db.products.find_one({"id": product_id})
            if not product:
                failed_ingredients.append({
                    "name": ingredient.get("name", product_id),
                    "reason": "Product not found in database"
                })
                continue
            
            # Add to cart logic
            item_exists = False
            for cart_item in cart["items"]:
                if cart_item["product_id"] == product_id:
                    cart_item["quantity"] += quantity
                    item_exists = True
                    break
            
            if not item_exists:
                cart["items"].append({"product_id": product_id, "quantity": quantity})
            
            added_count += 1
        
        cart["updated_at"] = datetime.utcnow()
        await db.carts.update_one({"user_id": user_id}, {"$set": cart}, upsert=True)
        
        return {
            "success": True,
            "cart": clean_mongo_doc(cart),
            "added_count": added_count,
            "failed_ingredients": failed_ingredients,
            "message": f"Successfully added {added_count} ingredients to cart"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add ingredients: {str(e)}")

@api_router.post("/cart/update")
async def update_cart_item(item: CartItem, user_id: str = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    for cart_item in cart["items"]:
        if cart_item["product_id"] == item.product_id:
            if item.quantity <= 0:
                cart["items"].remove(cart_item)
            else:
                cart_item["quantity"] = item.quantity
            break
    
    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": cart["items"]}})
    return clean_mongo_doc(cart)

@api_router.delete("/cart/clear")
async def clear_cart(user_id: str = Depends(get_current_user)):
    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": []}})
    return {"success": True}

# Auto-Rewards Calculation
def calculate_spending_tiers_and_rewards(current_monthly_spend: float, order_total: float) -> dict:
    """
    Calculate automatic rewards based on spending tiers
    Infrastructure ready for advanced reward algorithms and external reward APIs
    """
    new_monthly_spend = current_monthly_spend + order_total
    
    # Current tier system - can be enhanced with external reward APIs
    tiers = [
        {"threshold": 25000, "reward": 1000, "tier_name": "Platinum"},
        {"threshold": 13000, "reward": 500, "tier_name": "Gold"},
        {"threshold": 7000, "reward": 250, "tier_name": "Silver"},
        {"threshold": 0, "reward": 0, "tier_name": "Base"}
    ]
    
    current_tier = {"threshold": 0, "reward": 0, "tier_name": "Base"}
    for tier in tiers:
        if new_monthly_spend >= tier["threshold"]:
            current_tier = tier
            break
    
    # Calculate additional rewards for order
    order_reward_percentage = 0.01  # 1% cashback base
    if current_tier["tier_name"] == "Platinum":
        order_reward_percentage = 0.05  # 5% for platinum
    elif current_tier["tier_name"] == "Gold":
        order_reward_percentage = 0.03  # 3% for gold
    elif current_tier["tier_name"] == "Silver":
        order_reward_percentage = 0.02  # 2% for silver
    
    order_cashback = order_total * order_reward_percentage
    
    return {
        "new_monthly_spend": new_monthly_spend,
        "current_tier": current_tier,
        "order_cashback": order_cashback,
        "total_available_reward": current_tier["reward"],
        "rewards_breakdown": {
            "tier_reward": current_tier["reward"],
            "order_cashback": order_cashback,
            "infrastructure_ready": True
        }
    }

@api_router.post("/checkout/calculate-rewards")
async def calculate_checkout_rewards(checkout_data: dict, user_id: str = Depends(get_current_user)):
    """
    Calculate rewards that will be auto-applied during checkout
    """
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subtotal = checkout_data.get("subtotal", 0)
    current_monthly_spend = user.get("monthly_spend", 0.0)
    current_reward_balance = user.get("current_reward", 0.0)
    
    rewards_info = calculate_spending_tiers_and_rewards(current_monthly_spend, subtotal)
    
    # Auto-apply available rewards (up to order total)
    max_applicable_reward = min(current_reward_balance, subtotal)
    
    # Calculate final totals
    reward_applied = max_applicable_reward
    final_total = subtotal - reward_applied
    
    return {
        "subtotal": subtotal,
        "current_reward_balance": current_reward_balance,
        "rewards_auto_applied": reward_applied,
        "final_total": final_total,
        "new_tier_info": rewards_info["current_tier"],
        "order_cashback_earned": rewards_info["order_cashback"],
        "infrastructure_ready": True,
        "breakdown": {
            "original_amount": subtotal,
            "rewards_applied": reward_applied,
            "amount_to_pay": final_total,
            "cashback_earning": rewards_info["order_cashback"]
        }
    }

# Order Routes
@api_router.post("/orders")
async def create_order(order_data: OrderCreate, user_id: str = Depends(get_current_user)):
    """
    Create order with automatic rewards application
    """
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate subtotal from items if not provided
    subtotal = order_data.subtotal
    if subtotal == 0 and order_data.items:
        subtotal = sum(item.get("price", 0) * item.get("quantity", 1) for item in order_data.items)
    
    # Calculate rewards and apply them automatically
    rewards_info = calculate_spending_tiers_and_rewards(
        user.get("monthly_spend", 0.0), 
        subtotal
    )
    
    # Auto-apply rewards (user's available reward balance)
    current_reward_balance = user.get("current_reward", 0.0)
    reward_applied = min(current_reward_balance, subtotal)
    final_total = subtotal - reward_applied
    
    # Build delivery address
    delivery_address = order_data.delivery_address
    if not delivery_address:
        delivery_address = f"{user.get('address', '')}, {user.get('city', '')}, {user.get('pincode', '')}"
    
    order_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "items": order_data.items,
        "subtotal": subtotal,
        "reward_applied": reward_applied,
        "total": final_total,
        "payment_method": order_data.payment_method,
        "phone": order_data.phone or user.get("phone", ""),
        "tier_info": rewards_info["current_tier"],
        "order_cashback_earned": rewards_info["order_cashback"],
        "rewards_auto_applied": True,
        "status": "confirmed",
        "delivery_status": "confirmed",
        "estimated_delivery": datetime.utcnow() + timedelta(hours=1),
        "delivery_address": delivery_address,
        "created_at": datetime.utcnow(),
        "tracking_updates": [
            {
                "timestamp": datetime.utcnow(),
                "status": "confirmed",
                "message": "Order confirmed and being prepared"
            }
        ]
    }
    
    await db.orders.insert_one(order_dict)
    
    # Update user spending and rewards
    new_reward_balance = (current_reward_balance - reward_applied) + rewards_info["order_cashback"]
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "monthly_spend": rewards_info["new_monthly_spend"],
            "total_spend": user.get("total_spend", 0.0) + order_data.subtotal,
            "current_reward": rewards_info["total_available_reward"] + rewards_info["order_cashback"]
        }}
    )
    
    # Clear cart
    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": []}})
    
    return {
        **clean_mongo_doc(order_dict),
        "rewards_breakdown": {
            "rewards_used": reward_applied,
            "cashback_earned": rewards_info["order_cashback"],
            "new_reward_balance": new_reward_balance,
            "new_tier": rewards_info["current_tier"]["tier_name"]
        },
        "tracking_url": f"/order-tracking/{order_dict['id']}"
    }

@api_router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str, user_id: str = Depends(get_current_user)):
    """
    Get real-time order tracking information with delivery partner details
    Infrastructure ready for GPS tracking and delivery partner APIs
    """
    order = await db.orders.find_one({"id": order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Mock delivery partner data - Infrastructure ready for real delivery partner APIs
    delivery_partner_data = {
        "id": "dp_001",
        "name": "Rajesh Kumar",
        "phone": "+91 98765 43210", 
        "vehicle": "Bike - MH 12 AB 1234",
        "rating": 4.8,
        "current_location": {
            "latitude": 19.0760 + (hash(order_id) % 100) * 0.001,  # Mock location variation
            "longitude": 72.8777 + (hash(order_id) % 100) * 0.001
        },
        "estimated_arrival": "15 minutes"
    }
    
    # Enhanced tracking data with infrastructure provisions
    tracking_data = {
        "order_id": order_id,
        "status": order.get("delivery_status", "confirmed"),
        "delivery_partner": delivery_partner_data if order.get("delivery_status") in ["picked_up", "out_for_delivery"] else None,
        "delivery_address": order.get("delivery_address", ""),
        "estimated_delivery": order.get("estimated_delivery", datetime.utcnow() + timedelta(hours=1)),
        "tracking_updates": order.get("tracking_updates", []),
        "infrastructure_ready": True,
        "gps_tracking_enabled": True,
        "real_time_updates": True
    }
    
    return clean_mongo_doc(tracking_data)

@api_router.get("/orders")
async def get_user_orders(user_id: str = Depends(get_current_user)):
    """
    Get all orders for the current user with tracking capabilities
    """
    orders_cursor = db.orders.find({"user_id": user_id}).sort("created_at", -1)
    orders = await orders_cursor.to_list(length=50)
    
    for order in orders:
        order["tracking_available"] = True
        order["tracking_url"] = f"/order-tracking/{order['id']}"
    
    return [clean_mongo_doc(order) for order in orders]

# Video Routes
@api_router.get("/videos")
async def get_videos():
    videos = await db.videos.find().sort("created_at", -1).to_list(100)
    return clean_mongo_docs(videos)

@api_router.get("/videos/{video_id}")
async def get_video(video_id: str):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return clean_mongo_doc(video)

@api_router.post("/videos")
async def create_video(video: VideoCreate, user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    video_dict = {
        "id": str(uuid.uuid4()),
        **video.dict(),
        "created_at": datetime.utcnow()
    }
    await db.videos.insert_one(video_dict)
    return clean_mongo_doc(video_dict)

# Categories
@api_router.get("/categories")
async def get_categories():
    categories = [
        {"id": "1", "name": "Fruits & Vegetables", "icon": "leaf"},
        {"id": "2", "name": "Dairy & Breakfast", "icon": "coffee"},
        {"id": "3", "name": "Munchies", "icon": "pizza"},
        {"id": "4", "name": "Cold Drinks & Juices", "icon": "cup"},
        {"id": "5", "name": "Instant & Frozen", "icon": "ice-cream"},
        {"id": "6", "name": "Tea, Coffee & More", "icon": "coffee"},
        {"id": "7", "name": "Bakery & Biscuits", "icon": "bread"},
        {"id": "8", "name": "Sweet Tooth", "icon": "candy"},
        {"id": "9", "name": "Atta, Rice & Dal", "icon": "wheat"},
        {"id": "10", "name": "Masala & Spices", "icon": "chili"},
        {"id": "11", "name": "Sauces & Spreads", "icon": "sauce"},
        {"id": "12", "name": "Chicken, Meat & Fish", "icon": "drumstick"},
        {"id": "13", "name": "Cleaning Essentials", "icon": "spray"},
        {"id": "14", "name": "Personal Care", "icon": "sparkles"},
        {"id": "15", "name": "Home & Kitchen", "icon": "home"},
    ]
    return categories

# Service Providers
@api_router.get("/service-providers")
async def get_service_providers():
    providers = [
        {"id": "1", "name": "Tata Sky", "logo": ""},
        {"id": "2", "name": "Airtel Digital TV", "logo": ""},
        {"id": "3", "name": "Dish TV", "logo": ""},
        {"id": "4", "name": "Sun Direct", "logo": ""},
        {"id": "5", "name": "Hathway", "logo": ""},
        {"id": "6", "name": "DEN Networks", "logo": ""},
    ]
    return providers

# Brand Banners (FMCG Integration Provision)
@api_router.get("/brand-banners")
async def get_brand_banners():
    """
    API endpoint for FMCG brand promotional banners
    Future integration: Connect with brand management system
    """
    banners = [
        {
            "id": "1",
            "brand": "Amul",
            "offer_text": "20% OFF",
            "description": "On all dairy products",
            "banner_image": "",  # Provision for brand banner image
            "background_color": "#FEE2E2",
            "valid_until": "2025-12-31",
            "category": "Dairy & Breakfast",
            "is_active": True
        },
        {
            "id": "2",
            "brand": "Britannia",
            "offer_text": "Buy 2 Get 1",
            "description": "On biscuits & cookies",
            "banner_image": "",
            "background_color": "#DBEAFE",
            "valid_until": "2025-12-31",
            "category": "Bakery & Biscuits",
            "is_active": True
        },
        {
            "id": "3",
            "brand": "Tata Tea",
            "offer_text": "₹50 OFF",
            "description": "On 500g pack",
            "banner_image": "",
            "background_color": "#FEF3C7",
            "valid_until": "2025-12-31",
            "category": "Tea, Coffee & More",
            "is_active": True
        },
        {
            "id": "4",
            "brand": "Nestlé",
            "offer_text": "15% OFF",
            "description": "On coffee range",
            "banner_image": "",
            "background_color": "#E0E7FF",
            "valid_until": "2025-12-31",
            "category": "Tea, Coffee & More",
            "is_active": True
        },
    ]
    # Filter only active banners
    active_banners = [b for b in banners if b.get("is_active", True)]
    return active_banners

# Admin: Create/Update Brand Banner
@api_router.post("/brand-banners")
async def create_brand_banner(banner: dict, user_id: str = Depends(get_current_user)):
    """Admin endpoint to create brand promotional banners"""
    user = await db.users.find_one({"id": user_id})
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    banner_dict = {
        "id": str(uuid.uuid4()),
        **banner,
        "created_at": datetime.utcnow()
    }
    await db.brand_banners.insert_one(banner_dict)
    return clean_mongo_doc(banner_dict)


# ======================== ADMIN ENDPOINTS ========================

# Admin credentials
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "")
ADMIN_PASSWORD_RAW = os.environ.get("ADMIN_PASSWORD", "")

if os.environ.get("ENV", "development") != "development":
    if not ADMIN_EMAIL or (not ADMIN_PASSWORD_HASH and not ADMIN_PASSWORD_RAW):
        raise RuntimeError("FATAL: ADMIN_EMAIL and either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH must be configured via environment variables in production mode.")
else:
    if not ADMIN_EMAIL:
        ADMIN_EMAIL = "grocereasetv@gmail.com"
    if not ADMIN_PASSWORD_HASH and not ADMIN_PASSWORD_RAW:
        import secrets
        generated_pwd = secrets.token_urlsafe(12)
        ADMIN_PASSWORD_RAW = generated_pwd
        print(f"\n==================================================")
        print(f"BOOTSTRAP: Generated development admin password:")
        print(f"  Email: {ADMIN_EMAIL}")
        print(f"  Password: {generated_pwd}")
        print(f"==================================================\n")

# Admin login
@api_router.post("/admin/login")
async def admin_login(login_data: UserLogin):
    if login_data.email.lower().strip() != ADMIN_EMAIL.lower().strip():
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    # Try raw match first, then hashed verification
    password_ok = False
    if ADMIN_PASSWORD_RAW and login_data.password == ADMIN_PASSWORD_RAW:
        password_ok = True
    elif ADMIN_PASSWORD_HASH:
        try:
            password_ok = verify_password(login_data.password, ADMIN_PASSWORD_HASH)
        except Exception:
            # Fallback if ADMIN_PASSWORD_HASH was mistakenly set to a raw password string in environment
            password_ok = (login_data.password == ADMIN_PASSWORD_HASH)
            
    if not password_ok:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    token = create_access_token({"user_id": "admin", "is_admin": True})
    refresh_token_val = create_access_token({"user_id": "admin", "is_admin": True, "type": "refresh"})
    return {
        "token": token,
        "refresh_token": refresh_token_val,
        "user": {
            "id": "admin",
            "name": "Admin",
            "email": ADMIN_EMAIL,
            "is_admin": True
        },
        "message": "Admin login successful"
    }

# Middleware to check admin access
async def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        is_admin = payload.get("is_admin", False)
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid admin token")

# Get all KPIs
@api_router.get("/admin/kpis")
async def get_all_kpis(admin=Depends(verify_admin)):
    # Get all orders
    orders = await db.orders.find().to_list(None)
    users = await db.users.find().to_list(None)
    products = await db.products.find().to_list(None)
    
    # Calculate all KPIs
    total_orders = len(orders)
    total_revenue = sum(order.get("total", 0) for order in orders)
    total_deliveries = len([o for o in orders if o.get("status") == "delivered"])
    
    # Operational KPIs
    avg_delivery_time = 45  # Mock value
    delivery_efficiency = 92.5 if total_deliveries > 0 else 0
    order_accuracy_rate = 95.0
    fulfilment_speed = 30  # minutes
    
    # Financial KPIs
    aov = total_revenue / total_orders if total_orders > 0 else 0
    revenue_per_delivery = total_revenue / total_deliveries if total_deliveries > 0 else 0
    gross_margin = 25.0
    cost_per_delivery = 50.0
    
    # Customer KPIs
    total_customers = len(users)
    returning_customers = len([u for u in users if u.get("order_count", 0) > 1])
    customer_retention_rate = (returning_customers / total_customers * 100) if total_customers > 0 else 0
    customer_satisfaction = 87.0  # Based on NPS
    cac = 250.0  # Customer acquisition cost
    clv = 5000.0  # Customer lifetime value
    
    # Inventory KPIs
    total_products = len(products)
    out_of_stock = len([p for p in products if p.get("stock", 0) == 0])
    inventory_turnover = 4.5
    
    # TV Integration KPIs
    orders_via_qr = len([o for o in orders if o.get("source") == "qr_code"])
    tv_users_linked = len([u for u in users if u.get("cable_tv_linked", False)])
    qr_conversion_rate = (orders_via_qr / total_orders * 100) if total_orders > 0 else 0
    
    # Brand Analytics
    brand_orders = {}
    for order in orders:
        items = order.get("items", [])
        for item in items:
            brand = item.get("brand", "Unknown")
            brand_orders[brand] = brand_orders.get(brand, 0) + 1
    
    top_brand = max(brand_orders.items(), key=lambda x: x[1])[0] if brand_orders else "N/A"
    avg_brand_consumption = sum(brand_orders.values()) / len(users) if users else 0
    
    return {
        # Operational
        "nps": 72,  # Net Promoter Score
        "avgDeliveryTime": avg_delivery_time,
        "deliveryEfficiency": delivery_efficiency,
        "orderAccuracyRate": order_accuracy_rate,
        "fulfilmentSpeed": fulfilment_speed,
        "totalDeliveries": total_deliveries,
        
        # Financial
        "totalRevenue": total_revenue,
        "aov": round(aov, 2),
        "revenuePerDelivery": round(revenue_per_delivery, 2),
        "grossMargin": gross_margin,
        "costPerDelivery": cost_per_delivery,
        
        # Customer
        "customerRetentionRate": round(customer_retention_rate, 2),
        "customerSatisfaction": customer_satisfaction,
        "cac": cac,
        "clv": clv,
        
        # Inventory
        "inventoryTurnover": inventory_turnover,
        "totalProducts": total_products,
        "outOfStock": out_of_stock,
        
        # TV Integration
        "ordersViaQR": orders_via_qr,
        "tvUsersLinked": tv_users_linked,
        "qrConversionRate": round(qr_conversion_rate, 2),
        
        # Brand Analytics
        "topBrand": top_brand,
        "avgBrandConsumption": round(avg_brand_consumption, 2),
        "competitivePricingIndex": 1.05
    }

# Admin Orders
@api_router.get("/admin/orders")
async def admin_get_orders(
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    admin=Depends(verify_admin),
    limit: int = 100,
    skip: int = 0
):
    query = {}
    if status:
        query["status"] = status
    if payment_method:
        query["payment_method"] = payment_method
        
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.orders.count_documents(query)
    
    return {
        "orders": clean_mongo_docs(orders),
        "total": total
    }

@api_router.put("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, payload: dict, admin=Depends(verify_admin)):
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required")
        
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    tracking_updates = order.get("tracking_updates", [])
    tracking_updates.append({
        "timestamp": datetime.utcnow(),
        "status": new_status,
        "message": f"Order status updated to {new_status}"
    })
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": new_status,
            "delivery_status": new_status,
            "tracking_updates": tracking_updates,
            "updated_at": datetime.utcnow()
        }}
    )
    return {"message": "Order status updated successfully"}

# Product Management
@api_router.get("/admin/products")
async def admin_get_products(admin=Depends(verify_admin), limit: int = 100, skip: int = 0):
    products = await db.products.find().skip(skip).limit(limit).to_list(limit)
    total = await db.products.count_documents({})
    return {
        "products": clean_mongo_docs(products),
        "total": total
    }

@api_router.post("/admin/products")
async def admin_create_product(product: dict, admin=Depends(verify_admin)):
    product_dict = {
        "id": str(uuid.uuid4()),
        **product,
        "created_at": datetime.utcnow()
    }
    await db.products.insert_one(product_dict)
    return clean_mongo_doc(product_dict)

@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, product: dict, admin=Depends(verify_admin)):
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": {**product, "updated_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product updated successfully"}

@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin=Depends(verify_admin)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

# Excel import
from fastapi import File, UploadFile
import pandas as pd
import io

@api_router.post("/admin/products/upload-excel")
async def upload_products_excel(file: UploadFile = File(...), admin=Depends(verify_admin)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be Excel format (.xlsx or .xls)")
    
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Expected columns: Name, Category, Brand, Price, OfferPrice, Stock, Description, Image
        required_columns = ['Name', 'Category', 'Price']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        added_count = 0
        updated_count = 0
        
        for _, row in df.iterrows():
            product_name = str(row['Name']).strip()
            
            # Check if product exists
            existing_product = await db.products.find_one({"name": product_name})
            
            product_dict = {
                "name": product_name,
                "category": str(row['Category']).strip(),
                "brand": str(row.get('Brand', '')).strip() if pd.notna(row.get('Brand')) else '',
                "price": float(row['Price']),
                "offerPrice": float(row['OfferPrice']) if pd.notna(row.get('OfferPrice')) else None,
                "stock": int(row.get('Stock', 0)) if pd.notna(row.get('Stock')) else 0,
                "description": str(row.get('Description', '')).strip() if pd.notna(row.get('Description')) else '',
                "image": str(row.get('Image', '')).strip() if pd.notna(row.get('Image')) else '',
                "updated_at": datetime.utcnow()
            }
            
            if existing_product:
                # Update existing product
                await db.products.update_one(
                    {"name": product_name},
                    {"$set": product_dict}
                )
                updated_count += 1
            else:
                # Add new product
                product_dict["id"] = str(uuid.uuid4())
                product_dict["created_at"] = datetime.utcnow()
                await db.products.insert_one(product_dict)
                added_count += 1
        
        return {
            "message": "Excel uploaded successfully",
            "added": added_count,
            "updated": updated_count,
            "total": added_count + updated_count
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing Excel file: {str(e)}")

# Get categories
@api_router.get("/admin/categories")
async def admin_get_categories(admin=Depends(verify_admin)):
    categories = await db.products.distinct("category")
    return {"categories": categories}


# User Settings & Account Management Routes

@api_router.post("/auth/change-password")
async def change_password(
    password_data: dict,
    user_id: str = Depends(get_current_user)
):
    """Change user password"""
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Both passwords required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_password(current_password, user["password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    hashed_new_password = hash_password(new_password)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password": hashed_new_password, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Password changed successfully", "success": True}

@api_router.delete("/auth/delete-account")
async def delete_account(user_id: str = Depends(get_current_user)):
    """Delete user account"""
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user's orders and cart
    await db.orders.delete_many({"user_id": user_id})
    await db.carts.delete_many({"user_id": user_id})
    
    return {"message": "Account deleted successfully", "success": True}

# Address Management Routes

class NearestAddressRequest(BaseModel):
    lat: float
    lng: float

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance in km between two lat/lng points."""
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))

@api_router.post("/user/addresses/nearest")
async def nearest_address(payload: NearestAddressRequest, user_id: str = Depends(get_current_user)):
    """
    Find the saved address nearest to the user's current GPS location.
    Returns the matched address only if it's within 500 metres (0.5 km).
    """
    MATCH_RADIUS_KM = 0.5

    # Retrieve all addresses for this user that have coordinates
    addresses = await db.addresses.find({
        "user_id": user_id, 
        "lat": {"$ne": None}, 
        "lng": {"$ne": None}
    }).to_list(100)

    if not addresses:
        return {"matched_address": None}

    closest = None
    closest_dist = float("inf")

    for addr in addresses:
        lat = addr.get("lat")
        lng = addr.get("lng")
        if lat is None or lng is None:
            continue
        try:
            dist = haversine_km(payload.lat, payload.lng, float(lat), float(lng))
            if dist < closest_dist:
                closest_dist = dist
                closest = addr
        except Exception as e:
            print("Error calculating distance:", e)
            continue

    if closest and closest_dist <= MATCH_RADIUS_KM:
        return {"matched_address": clean_mongo_doc(closest), "distance_km": round(closest_dist, 3)}

    return {"matched_address": None}

@api_router.get("/user/addresses")
async def get_addresses(user_id: str = Depends(get_current_user)):
    """Get all addresses for user"""
    addresses = await db.addresses.find({"user_id": user_id}).to_list(100)
    return {"addresses": clean_mongo_docs(addresses)}

@api_router.post("/user/addresses")
async def add_address(address_data: dict, user_id: str = Depends(get_current_user)):
    """Add new address"""
    address_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        **address_data,
        "created_at": datetime.utcnow()
    }
    await db.addresses.insert_one(address_dict)
    return clean_mongo_doc(address_dict)

@api_router.put("/user/addresses/{address_id}")
async def update_address(
    address_id: str,
    address_data: dict,
    user_id: str = Depends(get_current_user)
):
    """Update existing address"""
    result = await db.addresses.update_one(
        {"id": address_id, "user_id": user_id},
        {"$set": {**address_data, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"message": "Address updated successfully"}

@api_router.delete("/user/addresses/{address_id}")
async def delete_address(address_id: str, user_id: str = Depends(get_current_user)):
    """Delete address"""
    result = await db.addresses.delete_one({"id": address_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"message": "Address deleted successfully"}

@api_router.post("/user/addresses/{address_id}/set-default")
async def set_default_address(address_id: str, user_id: str = Depends(get_current_user)):
    """Set address as default"""
    # Remove default from all addresses
    await db.addresses.update_many(
        {"user_id": user_id},
        {"$set": {"is_default": False}}
    )
    
    # Set this address as default
    result = await db.addresses.update_one(
        {"id": address_id, "user_id": user_id},
        {"$set": {"is_default": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    
    return {"message": "Default address updated"}

# Payment Methods Routes

@api_router.get("/user/payment-methods")
async def get_payment_methods(user_id: str = Depends(get_current_user)):
    """Get all payment methods for user"""
    methods = await db.payment_methods.find({"user_id": user_id}).to_list(100)
    return {"payment_methods": clean_mongo_docs(methods)}

@api_router.post("/user/payment-methods")
async def add_payment_method(method_data: dict, user_id: str = Depends(get_current_user)):
    """Add new payment method"""
    method_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        **method_data,
        "created_at": datetime.utcnow()
    }
    await db.payment_methods.insert_one(method_dict)
    return clean_mongo_doc(method_dict)

@api_router.delete("/user/payment-methods/{method_id}")
async def delete_payment_method(method_id: str, user_id: str = Depends(get_current_user)):
    """Delete payment method"""
    result = await db.payment_methods.delete_one({"id": method_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"message": "Payment method deleted successfully"}

# Notification Preferences Routes

@api_router.post("/user/notification-preferences")
async def update_notification_preferences(
    preferences: dict,
    user_id: str = Depends(get_current_user)
):
    """Update notification preferences"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "notification_preferences": preferences,
            "updated_at": datetime.utcnow()
        }}
    )
    return {"message": "Notification preferences updated", "success": True}

@api_router.get("/user/notification-preferences")
async def get_notification_preferences(user_id: str = Depends(get_current_user)):
    """Get notification preferences"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"preferences": user.get("notification_preferences", {
        "order_updates": True,
        "promotions": True,
        "new_arrivals": False,
        "price_drops": True
    })}

# Enhanced Orders Routes

@api_router.get("/user/orders")
async def get_user_orders(
    user_id: str = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get user orders with optional filters"""
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    total = await db.orders.count_documents(query)
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "orders": clean_mongo_docs(orders),
        "total": total,
        "has_more": (skip + limit) < total
    }

@api_router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, user_id: str = Depends(get_current_user)):
    """Cancel an order"""
    order = await db.orders.find_one({"id": order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("status") in ["delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this order")
    
    update_data = {"status": "cancelled", "cancelled_at": datetime.utcnow()}
    if order.get("payment_status") == "paid":
        update_data["payment_status"] = "refund_pending"
        
    await db.orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    # Restore stock
    if order.get("payment_status") == "paid" or order.get("payment_method") == "cod":
        for item in order.get("items", []):
            await db.products.update_one(
                {"id": item.get("product_id")},
                {"$inc": {"stock": item.get("quantity", 1)}}
            )
    
    return {"message": "Order cancelled successfully", "success": True}


# Support Messages
class SupportMessage(BaseModel):
    message: str

@api_router.post("/support/messages")
async def send_support_message(msg: SupportMessage, user_id: str = Depends(get_current_user)):
    """Save support message and return auto-response"""
    message_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "message": msg.message,
        "created_at": datetime.utcnow(),
    }
    await db.support_messages.insert_one(message_doc)
    
    # Auto-response logic
    lower_msg = msg.message.lower()
    if "order" in lower_msg and ("track" in lower_msg or "where" in lower_msg):
        reply = "You can track your order from the Orders section. Go to Orders > Tap on your order > Track Order."
    elif "cancel" in lower_msg:
        reply = "You can cancel your order from the Order Tracking page if it hasn't been picked up yet."
    elif "payment" in lower_msg or "pay" in lower_msg:
        reply = "For payment issues, please share your order ID. Our team will investigate and respond within 2 hours."
    elif "refund" in lower_msg:
        reply = "Refunds are processed within 5-7 business days. Please share your order ID for status."
    elif "quality" in lower_msg or "damaged" in lower_msg:
        reply = "We're sorry about the quality issue. Please share your order ID and we'll arrange a replacement or refund."
    else:
        reply = "Thank you for reaching out. Our support team will respond shortly. Support hours: 9 AM - 9 PM IST."
    
    return {"reply": reply, "message_id": message_doc["id"]}


# SMS OTP Utilities & Routes
async def send_sms_fast2sms(phone: str, otp: str):
    if not FAST2SMS_API_KEY:
        if DEBUG_MODE:
            print(f"\n========================================\n[DEV MODE] OTP for {phone}: {otp}\n========================================\n")
        else:
            print(f"\n========================================\n[DEV MODE] OTP requested for {phone} (actual OTP hidden in production)\n========================================\n")
        return True
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://www.fast2sms.com/dev/bulkV2",
                headers={"authorization": FAST2SMS_API_KEY},
                json={
                    "route": "otp",
                    "variables_values": otp,
                    "numbers": phone.replace("+91", ""),
                },
                timeout=10,
            )
            if resp.status_code != 200 or not resp.json().get("return"):
                if DEBUG_MODE:
                    print(f"[SMS FAILED] Fallback to printing OTP for {phone}: {otp}")
                else:
                    print(f"[SMS FAILED] Fallback: SMS failed to send to {phone}")
                return False
            return True
    except Exception as e:
        if DEBUG_MODE:
            print(f"[SMS EXCEPTION] Fallback to printing OTP for {phone}: {otp} (Error: {str(e)})")
        else:
            print(f"[SMS EXCEPTION] Fallback: SMS exception for {phone}")
        return False

@api_router.post("/auth/send-otp")
async def send_otp(payload: SendOtpRequest, _=Depends(rate_limit)):
    phone = payload.phone.strip()
    if not phone.startswith("+91") or len(phone) != 13:
        raise HTTPException(status_code=422, detail="Invalid Indian phone number. Format: +91XXXXXXXXXX")
        
    otp = str(random.randint(100000, 999999))
    _otp_store[phone] = {"otp": otp, "expires": time.time() + 300}
    
    await send_sms_fast2sms(phone, otp)
    
    existing_user = await db.users.find_one({"phone": phone})
    return {"is_new_user": existing_user is None, "message": "OTP sent successfully"}

@api_router.post("/auth/verify-otp")
async def verify_otp(payload: VerifyOtpRequest, _=Depends(rate_limit)):
    phone = payload.phone.strip()
    stored = _otp_store.get(phone)
    
    if not stored:
        raise HTTPException(status_code=400, detail="OTP expired or not requested. Please request a new OTP.")
    if time.time() > stored["expires"]:
        del _otp_store[phone]
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if stored["otp"] != payload.otp:
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please check and try again.")
            
    del _otp_store[phone]
        
    user = await db.users.find_one({"phone": phone})
    
    if not user:
        if not payload.name or not payload.name.strip():
            raise HTTPException(status_code=422, detail="Name is required for new users.")
            
        user_id = str(uuid.uuid4())
        user_dict = {
            "id": user_id,
            "name": payload.name.strip(),
            "email": f"{phone.replace('+', '')}@grocerease.com",
            "password": None,
            "phone": phone,
            "address": None,
            "city": None,
            "pincode": None,
            "cable_tv_linked": False,
            "cable_tv_details": None,
            "monthly_spend": 0.0,
            "total_spend": 0.0,
            "current_reward": 0.0,
            "is_admin": False,
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user_dict)
        user = user_dict
    else:
        user_id = user["id"]
        
    token = create_access_token({"user_id": user_id})
    refresh_token = create_access_token({"user_id": user_id, "type": "refresh"})
    
    return {
        "token": token,
        "access_token": token,
        "refresh_token": refresh_token,
        "user": {
            "id": user_id,
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "cable_tv_linked": user.get("cable_tv_linked", False),
            "monthly_spend": user.get("monthly_spend", 0.0),
            "current_reward": user.get("current_reward", 0.0),
            "is_admin": user.get("is_admin", False)
        }
    }


# Coupon Routes
@api_router.get("/admin/coupons")
async def get_coupons(admin=Depends(verify_admin)):
    coupons = await db.coupons.find().to_list(100)
    return clean_mongo_docs(coupons)

@api_router.post("/admin/coupons")
async def create_coupon(coupon: CouponCreate, admin=Depends(verify_admin)):
    existing = await db.coupons.find_one({"code": coupon.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    
    coupon_dict = {
        "id": str(uuid.uuid4()),
        **coupon.dict(),
        "code": coupon.code.upper(),
        "created_at": datetime.utcnow()
    }
    await db.coupons.insert_one(coupon_dict)
    return clean_mongo_doc(coupon_dict)

@api_router.post("/checkout/validate-coupon")
async def validate_coupon(payload: CouponValidate, user_id: str = Depends(get_current_user)):
    coupon = await db.coupons.find_one({"code": payload.code.upper(), "is_active": True})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid or inactive coupon code")
        
    if datetime.utcnow() > coupon["valid_until"]:
        raise HTTPException(status_code=400, detail="Coupon has expired")
        
    if payload.subtotal < coupon.get("min_order_value", 0):
        raise HTTPException(status_code=400, detail=f"Minimum order value for this coupon is ₹{coupon['min_order_value']}")
        
    discount = 0.0
    if coupon.get("discount_percentage", 0) > 0:
        discount = (payload.subtotal * coupon["discount_percentage"]) / 100.0
        if coupon.get("max_discount") and discount > coupon["max_discount"]:
            discount = coupon["max_discount"]
    elif coupon.get("discount_amount", 0) > 0:
        discount = coupon["discount_amount"]
        
    return {"valid": True, "discount": round(discount, 2), "code": coupon["code"]}

# Checkout & Order Routing
@api_router.get("/checkout/summary")
async def get_checkout_summary(coupon_code: Optional[str] = None, user_id: str = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Freeze prices from DB
    subtotal = 0
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]})
        if product:
            item["price"] = product.get("price", item["price"])
            subtotal += item["price"] * item["quantity"]
        
    delivery_fee = 0.0 if subtotal >= 299 else 30.0
    discount = 0.0
    
    if coupon_code:
        coupon = await db.coupons.find_one({"code": coupon_code.upper(), "is_active": True})
        if coupon and datetime.utcnow() <= coupon["valid_until"] and subtotal >= coupon.get("min_order_value", 0):
            if coupon.get("discount_percentage", 0) > 0:
                discount = (subtotal * coupon["discount_percentage"]) / 100.0
                if coupon.get("max_discount") and discount > coupon["max_discount"]:
                    discount = coupon["max_discount"]
            elif coupon.get("discount_amount", 0) > 0:
                discount = coupon["discount_amount"]
                
    total = subtotal + delivery_fee - discount
    if total < 0: total = 0
    
    user = await db.users.find_one({"id": user_id})
    rewards_info = calculate_spending_tiers_and_rewards(user.get("monthly_spend", 0.0), total)
    rewards_will_earn = rewards_info["order_cashback"]
    
    return {
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "discount": round(discount, 2),
        "total": round(total, 2),
        "rewards_will_earn": rewards_will_earn,
        "tier": rewards_info["current_tier"]["tier_name"]
    }

@api_router.post("/orders/create")
async def create_order_endpoint(payload: CreateOrderRequest, user_id: str = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
        
    address = await db.addresses.find_one({"id": payload.address_id, "user_id": user_id})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
        
    subtotal = 0
    # Price freeze & stock validation
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]})
        if not product:
            raise HTTPException(status_code=400, detail=f"Product not found: {item['product_id']}")
        if product.get("stock", 0) < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.get('name')}")
        item["price"] = product.get("price", item["price"])
        subtotal += item["price"] * item["quantity"]
        
    delivery_fee = 0.0 if subtotal >= 299 else 30.0
    discount = 0.0
    
    if payload.coupon_code:
        coupon = await db.coupons.find_one({"code": payload.coupon_code.upper(), "is_active": True})
        if coupon and datetime.utcnow() <= coupon["valid_until"] and subtotal >= coupon.get("min_order_value", 0):
            if coupon.get("discount_percentage", 0) > 0:
                discount = (subtotal * coupon["discount_percentage"]) / 100.0
                if coupon.get("max_discount") and discount > coupon["max_discount"]:
                    discount = coupon["max_discount"]
            elif coupon.get("discount_amount", 0) > 0:
                discount = coupon["discount_amount"]
                
    total = subtotal + delivery_fee - discount
    if total < 0: total = 0
    
    user = await db.users.find_one({"id": user_id})
    rewards_info = calculate_spending_tiers_and_rewards(user.get("monthly_spend", 0.0), total)
    rewards_will_earn = rewards_info["order_cashback"]
    
    order_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "items": cart["items"],
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "discount": round(discount, 2),
        "coupon_code": payload.coupon_code.upper() if payload.coupon_code else None,
        "total": round(total, 2),
        "rewards_will_earn": rewards_will_earn,
        "delivery_address": address["full_address"],
        "address_id": payload.address_id,
        "payment_method": payload.payment_method,
        "status": "confirmed",
        "payment_status": "paid",
        "created_at": datetime.utcnow(),
        "delivery_status": "confirmed",
        "estimated_delivery": datetime.utcnow() + timedelta(hours=1),
        "tracking_updates": [
            {
                "timestamp": datetime.utcnow(),
                "status": "confirmed",
                "message": "Order confirmed and being prepared"
            }
        ]
    }
    await db.orders.insert_one(order_dict)
    
    # Deduct stock for COD
    for item in cart["items"]:
        await db.products.update_one(
            {"id": item["product_id"]},
            {"$inc": {"stock": -item["quantity"]}}
        )
        
    new_spend = user.get("monthly_spend", 0.0) + total
    new_total_spend = user.get("total_spend", 0.0) + total
    new_reward = user.get("current_reward", 0.0) + rewards_will_earn
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "monthly_spend": new_spend,
            "total_spend": new_total_spend,
            "current_reward": new_reward
        }}
    )
        
    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": []}})
    return {"success": True, "order_id": order_dict["id"]}

@api_router.post("/orders/create-pending")
async def create_pending_order(payload: CreateOrderRequest, user_id: str = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
        
    address = await db.addresses.find_one({"id": payload.address_id, "user_id": user_id})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
        
    subtotal = 0
    # Price freeze & stock validation
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]})
        if not product:
            raise HTTPException(status_code=400, detail=f"Product not found: {item['product_id']}")
        if product.get("stock", 0) < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.get('name')}")
        item["price"] = product.get("price", item["price"])
        subtotal += item["price"] * item["quantity"]
        
    delivery_fee = 0.0 if subtotal >= 299 else 30.0
    discount = 0.0
    
    if payload.coupon_code:
        coupon = await db.coupons.find_one({"code": payload.coupon_code.upper(), "is_active": True})
        if coupon and datetime.utcnow() <= coupon["valid_until"] and subtotal >= coupon.get("min_order_value", 0):
            if coupon.get("discount_percentage", 0) > 0:
                discount = (subtotal * coupon["discount_percentage"]) / 100.0
                if coupon.get("max_discount") and discount > coupon["max_discount"]:
                    discount = coupon["max_discount"]
            elif coupon.get("discount_amount", 0) > 0:
                discount = coupon["discount_amount"]
                
    total = subtotal + delivery_fee - discount
    if total < 0: total = 0
    
    user = await db.users.find_one({"id": user_id})
    rewards_info = calculate_spending_tiers_and_rewards(user.get("monthly_spend", 0.0), total)
    rewards_will_earn = rewards_info["order_cashback"]
    
    order_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "items": cart["items"],
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "discount": round(discount, 2),
        "coupon_code": payload.coupon_code.upper() if payload.coupon_code else None,
        "total": round(total, 2),
        "rewards_will_earn": rewards_will_earn,
        "delivery_address": address["full_address"],
        "address_id": payload.address_id,
        "payment_method": payload.payment_method,
        "status": "payment_pending",
        "payment_status": "pending",
        "created_at": datetime.utcnow(),
        "delivery_status": "pending",
        "estimated_delivery": datetime.utcnow() + timedelta(hours=1),
        "tracking_updates": [
            {
                "timestamp": datetime.utcnow(),
                "status": "pending",
                "message": "Waiting for payment verification"
            }
        ]
    }
    await db.orders.insert_one(order_dict)
    
    return {"success": True, "order_id": order_dict["id"]}


# Razorpay Payments Integration
def get_razorpay_client():
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        return None
    try:
        return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except:
        return None

@api_router.post("/payments/razorpay/create")
async def create_razorpay_order(payload: CreatePaymentRequest, user_id: str = Depends(get_current_user)):
    order = await db.orders.find_one({"id": payload.order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    amount_paise = int(order["total"] * 100)
    client = get_razorpay_client()
    
    if client:
        try:
            rz_order = client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": payload.order_id,
                "notes": {"grocerease_order_id": payload.order_id}
            })
            rz_order_id = rz_order["id"]
        except Exception as e:
            if os.environ.get("ENV", "development") != "development":
                raise HTTPException(status_code=400, detail=f"Razorpay order creation failed: {str(e)}")
            rz_order_id = f"rzp_mock_{uuid.uuid4().hex[:14]}"
    else:
        if os.environ.get("ENV", "development") != "development":
            raise HTTPException(status_code=400, detail="Razorpay is not configured on the server")
        rz_order_id = f"rzp_mock_{uuid.uuid4().hex[:14]}"
        
    await db.orders.update_one(
        {"id": payload.order_id},
        {"$set": {"razorpay_order_id": rz_order_id, "payment_status": "pending"}}
    )
    
    return {
        "razorpay_order_id": rz_order_id,
        "amount": amount_paise,
        "currency": "INR"
    }

@api_router.post("/payments/razorpay/verify")
async def verify_razorpay_payment(payload: VerifyPaymentRequest, user_id: str = Depends(get_current_user)):
    if payload.razorpay_order_id.startswith("rzp_mock_"):
        if os.environ.get("ENV", "development") != "development":
            raise HTTPException(status_code=400, detail="Mock payments are disabled in production")
        success = True
    else:
        if not RAZORPAY_KEY_SECRET:
            raise HTTPException(status_code=500, detail="Razorpay keys not configured for verification")
            
        body = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
        expected_sig = hmac.new(
            RAZORPAY_KEY_SECRET.encode(), body.encode(), hashlib.sha256
        ).hexdigest()
        success = hmac.compare_digest(expected_sig, payload.razorpay_signature)
        
    if not success:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
        
    await db.orders.update_one(
        {"id": payload.order_id},
        {
            "$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "razorpay_payment_id": payload.razorpay_payment_id,
                "delivery_status": "confirmed",
                "tracking_updates": [
                    {
                        "timestamp": datetime.utcnow(),
                        "status": "confirmed",
                        "message": "Payment verified. Preparing your order."
                    }
                ]
            }
        }
    )
    
    order = await db.orders.find_one({"id": payload.order_id})
    user = await db.users.find_one({"id": user_id})
    if order and user:
        rewards_will_earn = order.get("rewards_will_earn", 0.0)
        new_spend = user.get("monthly_spend", 0.0) + order["total"]
        new_total_spend = user.get("total_spend", 0.0) + order["total"]
        new_reward = user.get("current_reward", 0.0) + rewards_will_earn
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "monthly_spend": new_spend,
                "total_spend": new_total_spend,
                "current_reward": new_reward
            }}
        )
        
        # Deduct stock
        for item in order.get("items", []):
            await db.products.update_one(
                {"id": item["product_id"]},
                {"$inc": {"stock": -item["quantity"]}}
            )
        
        await db.carts.update_one({"user_id": user_id}, {"$set": {"items": []}})
        
    return {"status": "success", "order_id": payload.order_id}

@api_router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    
    if webhook_secret and signature:
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
            
    try:
        event = await request.json()
        if event.get("event") == "payment.captured":
            payment = event["payload"]["payment"]["entity"]
            order_id = payment["notes"].get("grocerease_order_id")
            if order_id:
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {"payment_status": "paid", "status": "confirmed"}}
                )
    except:
        pass
        
    return {"status": "ok"}


app.include_router(api_router)


env_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
if os.environ.get("ENV", "development") != "development":
    if not env_origins:
        raise RuntimeError("FATAL: ALLOWED_ORIGINS environment variable must be configured in production mode.")
    origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
else:
    if env_origins:
        origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
    else:
        origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:8081",
            "http://localhost:19006"
        ]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
