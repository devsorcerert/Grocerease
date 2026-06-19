from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import random
import time
import hmac
import hashlib
import httpx
import razorpay
from pathlib import Path
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import shared database, auth, models
from database import (
    db, client, SECRET_KEY, ALGORITHM, pwd_context, security,
    hash_password, verify_password, create_access_token,
    get_current_user, verify_admin, clean_mongo_doc,
    clean_mongo_docs, rate_limit, set_otp, verify_and_clear_otp,
    send_sms_twilio, DEBUG_MODE
)
from models import (
    UserRegister, ProfileUpdate, UserLogin, GoogleAuthRequest,
    CableTVLink, ProductCreate, BulkProductUpload, CartItem,
    OrderCreate, VideoCreate, SendOtpRequest, VerifyOtpRequest,
    CreatePaymentRequest, VerifyPaymentRequest, CouponCreate,
    CouponValidate, CreateOrderRequest, LogoutRequest,
    SocialAuthRequest, RefundRequest, NearestAddressRequest,
    SupportMessage, SendEmailOtpRequest
)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# BUG-05 fix: ensure all JSON responses include charset=utf-8 so ₹, •, emojis
# render correctly on Android clients that default to Latin-1 decoding.
@app.middleware("http")
async def add_utf8_charset(request: Request, call_next):
    response = await call_next(request)
    ct = response.headers.get("content-type", "")
    if "application/json" in ct and "charset" not in ct:
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response

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
        await db.blacklisted_tokens.create_index("token", unique=True)
        await db.blacklisted_tokens.create_index("expires_at", expireAfterSeconds=0)
        # Create persistent OTP index
        await db.otps.create_index("key", unique=True)
        await db.otps.create_index("expires_at", expireAfterSeconds=0)
        # Create admin indexes
        await db.admins.create_index("email", unique=True)
        await db.admins.create_index("id", unique=True)
        # Create rider indexes
        await db.riders.create_index("id", unique=True)
        await db.riders.create_index("phone", unique=True)
        await db.riders.create_index("status")
        
        # Seed default admin if empty
        admin_count = await db.admins.count_documents({})
        if admin_count == 0:
            admin_email = os.environ.get("ADMIN_EMAIL", "grocereasetv@gmail.com")
            admin_password = os.environ.get("ADMIN_PASSWORD")
            if not admin_password:
                if os.environ.get("ENV") == "production":
                    raise RuntimeError("FATAL: ADMIN_PASSWORD environment variable is not set. Refusing to start in production without it.")
                admin_password = ""
            
            await db.admins.insert_one({
                "id": "default-admin-id",
                "email": admin_email.lower().strip(),
                "password": hash_password(admin_password),
                "role": "super-admin",
                "name": "Super Admin",
                "created_at": datetime.utcnow()
            })
            logging.info(f"Startup seeded default admin: {admin_email}")
            
        logging.info("MongoDB indexes verified/created successfully!")
    except Exception as e:
        logging.error(f"Failed to connect to MongoDB or initialize indexes on startup: {e}")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@api_router.get("/health")
async def api_health_check():
    return {"status": "ok"}



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
    refresh_token = create_access_token({"user_id": user_dict["id"], "type": "refresh"}, expires_in=timedelta(days=30))
    
    return {"token": token, "refresh_token": refresh_token, "user": {"id": user_dict["id"], "name": user_dict["name"], "email": user_dict["email"], "phone": user_dict["phone"], "address": user_dict["address"], "city": user_dict["city"], "pincode": user_dict["pincode"]}}

@api_router.post("/auth/update-profile")
async def update_profile(profile: ProfileUpdate, user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    update_data = {}
    if profile.name is not None:
        update_data["name"] = profile.name
        
    if profile.email is not None:
        new_email = profile.email.strip().lower()
        if new_email != user.get("email", "").strip().lower():
            # Check if email is already in use by another user
            existing = await db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
                
            # Verification is required to change email
            if not profile.email_otp:
                raise HTTPException(status_code=400, detail="Email verification OTP is required to change email address")
                
            if not await verify_and_clear_otp(new_email, profile.email_otp):
                raise HTTPException(status_code=400, detail="Incorrect or expired email OTP. Please check and try again.")
                
            update_data["email"] = new_email
            
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
    refresh_token = create_access_token({"user_id": db_user["id"], "type": "refresh"}, expires_in=timedelta(days=30))
    return {"token": token, "refresh_token": refresh_token, "user": {"id": db_user["id"], "name": db_user["name"], "email": db_user["email"], "phone": db_user.get("phone"), "photo": db_user.get("photo"), "is_admin": db_user.get("is_admin", False), "auth_provider": db_user.get("auth_provider", "email")}}


@api_router.post("/auth/logout")
async def logout(payload: LogoutRequest, user_id: str = Depends(get_current_user)):
    """
    Logout endpoint - Blacklists the user's refresh token
    """
    try:
        # Log the logout event for audit purposes
        print(f"User {user_id} logged out at {datetime.utcnow()}")
        
        if payload.refresh_token:
            try:
                # Decode to extract the expiration timestamp
                decoded = jwt.decode(payload.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
                exp = decoded.get("exp")
                expires_at = datetime.utcfromtimestamp(exp) if exp else datetime.utcnow() + timedelta(days=30)
                
                # Insert the token into blacklisted_tokens
                await db.blacklisted_tokens.update_one(
                    {"token": payload.refresh_token},
                    {"$setOnInsert": {
                        "token": payload.refresh_token,
                        "expires_at": expires_at,
                        "blacklisted_at": datetime.utcnow()
                    }},
                    upsert=True
                )
            except Exception as e:
                # Invalid or already expired token doesn't need to block logout
                logging.warning(f"Failed to blacklist refresh token during logout: {e}")
        
        return {"message": "Logout successful", "success": True}
    except Exception as e:
        logging.error(f"Logout error: {e}")
        raise HTTPException(status_code=500, detail="Logout failed")

@api_router.post("/auth/refresh")
async def refresh_token(request: dict):
    """
    Refresh token endpoint for token renewal with rotation and blacklisting
    Expects: {"refresh_token": "old_refresh_token"}
    Returns: {"token": "new_access_token", "refresh_token": "new_refresh_token"}
    """
    try:
        old_refresh_token = request.get("refresh_token")
        if not old_refresh_token:
            raise HTTPException(status_code=400, detail="Refresh token required")
            
        # Check if the token is already blacklisted
        is_blacklisted = await db.blacklisted_tokens.find_one({"token": old_refresh_token})
        if is_blacklisted:
            raise HTTPException(status_code=401, detail="Token has been blacklisted")
        
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
                user = await db.admins.find_one({"id": user_id})
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            
            # Rotate refresh token: blacklist the old one and generate a new pair
            exp = payload.get("exp")
            expires_at = datetime.utcfromtimestamp(exp) if exp else datetime.utcnow() + timedelta(days=30)
            
            await db.blacklisted_tokens.update_one(
                {"token": old_refresh_token},
                {"$setOnInsert": {
                    "token": old_refresh_token,
                    "expires_at": expires_at,
                    "blacklisted_at": datetime.utcnow()
                }},
                upsert=True
            )
            
            # Generate new tokens
            new_access_token = create_access_token({"user_id": user_id})
            new_refresh_token = create_access_token({"user_id": user_id, "type": "refresh"}, expires_in=timedelta(days=30))
            
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

# All valid OAuth client IDs for Firebase project grocerease-499205 (Web, Android, iOS)
_GOOGLE_ALLOWED_CLIENTS = {
    "418665414188-rl2jg740eersokldgp9ojnr6ue7uvc0r.apps.googleusercontent.com",   # Web
    "418665414188-mdmkg84jnujtmr3nvhkop74ifp78nr9k.apps.googleusercontent.com",   # Android
    "418665414188-3teeuukmq7m66m5lra36mc6be32i1n2f.apps.googleusercontent.com",   # iOS
    "418665414188-m1mffc26v4tu1nstlsesvgg9tnjmcmnt.apps.googleusercontent.com",   # Android (EAS)
    "418665414188-7pv8nmqhjeft1lm30op078c8qehfc0jb.apps.googleusercontent.com",   # Android (debug)
    "418665414188-7kpqp9m1jdgcur0eodir1f99mbqo4fq5.apps.googleusercontent.com",   # Android (release)
}

@api_router.post("/auth/google")
async def google_auth(auth_data: GoogleAuthRequest, _=Depends(rate_limit)):
    # Verify Google ID Token locally via google-auth (no quota, no deprecated tokeninfo endpoint)
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        import asyncio

        loop = asyncio.get_event_loop()
        # verify_oauth2_token is synchronous â offload to thread pool
        token_info = await loop.run_in_executor(
            None,
            lambda: google_id_token.verify_oauth2_token(
                auth_data.id_token,
                google_requests.Request(),
                clock_skew_in_seconds=10,
            ),
        )

        aud = token_info.get("aud", "")
        if aud not in _GOOGLE_ALLOWED_CLIENTS:
            logging.error(f"Google ID Token audience mismatch: {aud}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google ID Token audience verification failed",
            )

        verified_email = token_info.get("email")
        if not verified_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address not found in Google ID Token",
            )

        email = verified_email.lower()
        name = token_info.get("name") or auth_data.name
        photo = token_info.get("picture") or auth_data.photo

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Google authentication error during token verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {str(e)}",
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
    # BUG-12 fix: check db.users first, then fall through to db.admins.
    # Admin tokens carry user_id = "default-admin-id" which only exists in
    # db.admins, not db.users — so the old code 404-ed and auto-logged admins out.
    user = await db.users.find_one({"id": user_id})
    if user:
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
            "is_admin": user.get("is_admin", False),
            "total_spend": user.get("total_spend", 0.0),
        }

    # Not in db.users — check db.admins (admin JWT path)
    admin = await db.admins.find_one({"id": user_id})
    if admin:
        return {
            "id": admin["id"],
            "name": admin.get("name", "Admin"),
            "email": admin.get("email", ""),
            "phone": None,
            "address": None,
            "city": None,
            "pincode": None,
            "cable_tv_linked": False,
            "cable_tv_details": None,
            "monthly_spend": 0.0,
            "current_reward": 0.0,
            "is_admin": True,
            "role": admin.get("role", "admin"),
            "total_spend": 0.0,
        }

    raise HTTPException(status_code=404, detail="User not found")

@api_router.post("/user/push-token")
async def save_push_token(payload: dict, user_id: str = Depends(get_current_user)):
    token = payload.get("token", "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"push_token": token, "push_token_updated_at": datetime.utcnow()}}
    )
    return {"success": True}

@api_router.get("/user/notifications")
async def get_user_notifications_legacy(user_id: str = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"notifications": clean_mongo_docs(notifications)}

# Cable TV Routes
@api_router.post("/cable-tv/link")
async def link_cable_tv(data: CableTVLink, user_id: str = Depends(get_current_user)):
    """
    Cable TV linking is not implemented yet. Real-time billing integrations are gated.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Cable TV verification is not implemented yet. Real-time billing integrations are gated."
    )

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
    
    # Category filter — BUG-08 fix: case-insensitive match so "Cleaning Essentials"
    # matches products stored as "cleaning_essentials", "Cleaning & Essentials", etc.
    if category:
        import re as _re_cat
        query["category"] = {"$regex": f"^{_re_cat.escape(category)}$", "$options": "i"}
    
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
    
    # Remove MongoDB _id field; normalize image field name (BUG-06 fix)
    for product in products:
        product.pop("_id", None)
        # BUG-06: initial seed stored image as 'image_url'; frontend expects 'product.image'
        product["image"] = product.pop("image_url", product.get("image", ""))
    
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

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return {"success": True, "message": "Product deleted"}

# Cart routes are imported from routers/cart.py
from routers.orders import calculate_spending_tiers_and_rewards

# Redundant local rewards and order routes removed (handled by routers/orders.py)

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
            "offer_text": "â¹50 OFF",
            "description": "On 500g pack",
            "banner_image": "",
            "background_color": "#FEF3C7",
            "valid_until": "2025-12-31",
            "category": "Tea, Coffee & More",
            "is_active": True
        },
        {
            "id": "4",
            "brand": "NestlÃ©",
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
    email = login_data.email.lower().strip()
    db_admin = await db.admins.find_one({"email": email})
    
    password_ok = False
    admin_id = "admin"
    admin_name = "Admin"
    admin_role = "admin"
    
    if db_admin:
        admin_id = db_admin.get("id", "admin")
        admin_name = db_admin.get("name", "Admin")
        admin_role = db_admin.get("role", "admin")
        if db_admin.get("password"):
            password_ok = verify_password(login_data.password, db_admin["password"])
        # Also check env-var credentials — always authoritative
        # (DB hash may be stale if ADMIN_PASSWORD changed after initial seeding)
        if not password_ok and email == ADMIN_EMAIL.lower().strip():
            if ADMIN_PASSWORD_RAW and login_data.password == ADMIN_PASSWORD_RAW:
                password_ok = True
            elif ADMIN_PASSWORD_HASH:
                try:
                    password_ok = verify_password(login_data.password, ADMIN_PASSWORD_HASH)
                except Exception:
                    password_ok = (login_data.password == ADMIN_PASSWORD_HASH)
    else:
        # Fallback to environment credentials if needed (e.g. dev bootstrap)
        if email == ADMIN_EMAIL.lower().strip():
            if ADMIN_PASSWORD_RAW and login_data.password == ADMIN_PASSWORD_RAW:
                password_ok = True
            elif ADMIN_PASSWORD_HASH:
                try:
                    password_ok = verify_password(login_data.password, ADMIN_PASSWORD_HASH)
                except Exception:
                    password_ok = (login_data.password == ADMIN_PASSWORD_HASH)
            
            if password_ok:
                admin_name = "System Admin"
                admin_role = "super-admin"
                
    if not password_ok:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
        
    token = create_access_token({"user_id": admin_id, "role": admin_role, "is_admin": True})
    refresh_token_val = create_access_token({"user_id": admin_id, "role": admin_role, "is_admin": True, "type": "refresh"}, expires_in=timedelta(days=30))
    return {
        "token": token,
        "refresh_token": refresh_token_val,
        "user": {
            "id": admin_id,
            "name": admin_name,
            "email": email,
            "role": admin_role,
            "is_admin": True
        }
    }

# Admin KPI and Order management endpoints are imported from routers/kpis.py and routers/orders.py

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
    
    if not new_password:
        raise HTTPException(status_code=400, detail="New password is required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_password = user.get("password")
    auth_provider = user.get("auth_provider", "email")
    
    if user_password is not None:
        if not current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        if not verify_password(current_password, user_password):
            raise HTTPException(status_code=400, detail="Incorrect current password")
    else:
        if auth_provider not in ["google", "otp"]:
            raise HTTPException(status_code=400, detail="Setting password is not allowed for this account type")
        
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password": hash_password(new_password)}}
    )
    return {"success": True, "message": "Password updated successfully"}

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

# ââ Wishlist ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

@api_router.get("/wishlist/ids")
async def get_wishlist_ids(user_id: str = Depends(get_current_user)):
    doc = await db.wishlists.find_one({"user_id": user_id})
    return {"product_ids": doc.get("product_ids", []) if doc else []}

@api_router.get("/wishlist")
async def get_wishlist(user_id: str = Depends(get_current_user)):
    doc = await db.wishlists.find_one({"user_id": user_id})
    product_ids = doc.get("product_ids", []) if doc else []
    if not product_ids:
        return {"items": []}
    products = await db.products.find({"id": {"$in": product_ids}}).to_list(length=200)
    return {"items": [clean_mongo_doc(p) for p in products]}

@api_router.post("/wishlist/{product_id}")
async def add_to_wishlist(product_id: str, user_id: str = Depends(get_current_user)):
    await db.wishlists.update_one(
        {"user_id": user_id},
        {"$addToSet": {"product_ids": product_id}},
        upsert=True,
    )
    return {"status": "added"}

@api_router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, user_id: str = Depends(get_current_user)):
    await db.wishlists.update_one(
        {"user_id": user_id},
        {"$pull": {"product_ids": product_id}},
    )
    return {"status": "removed"}


# ââ Notifications ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

@api_router.get("/notifications")
async def get_notifications(user_id: str = Depends(get_current_user)):
    notes = await db.notifications.find({"user_id": user_id}).sort("created_at", -1).to_list(length=50)
    return [clean_mongo_doc(n) for n in notes]

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user_id: str = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user_id},
        {"$set": {"read": True}},
    )
    return {"status": "ok"}

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(user_id: str = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}},
    )
    return {"status": "ok"}


async def push_notification(user_id: str, title: str, message: str, notif_type: str, action_route: str = ""):
    """Insert an in-app notification for a user."""
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

@api_router.post("/auth/send-email-otp")
async def send_email_otp(payload: SendEmailOtpRequest, _=Depends(rate_limit)):
    email = payload.email.strip().lower()
    otp = str(random.randint(100000, 999999))
    _otp_store[email] = {"otp": otp, "expires": time.time() + 300}
    
    if DEBUG_MODE:
        print(f"\n========================================\n[DEV MODE] Email OTP for {email}: {otp}\n========================================\n")
    else:
        print(f"\n[EMAIL OTP] OTP requested for {email} (actual OTP hidden in production). SES/Sendgrid integration required.\n")
        
    return {"message": "Email verification OTP sent successfully"}

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
        raise HTTPException(status_code=400, detail=f"Minimum order value for this coupon is â¹{coupon['min_order_value']}")
        
    discount = 0.0
    if coupon.get("discount_percentage", 0) > 0:
        discount = (payload.subtotal * coupon["discount_percentage"]) / 100.0
        if coupon.get("max_discount") and discount > coupon["max_discount"]:
            discount = coupon["max_discount"]
    elif coupon.get("discount_amount", 0) > 0:
        discount = coupon["discount_amount"]
        
    return {"valid": True, "discount": round(discount, 2), "code": coupon["code"]}

# Register modular routers
from routers.cart import router as cart_router
from routers.orders import router as orders_router
from routers.payments import router as payments_router
from routers.kpis import router as kpis_router
from routers.riders import router as riders_router

api_router.include_router(cart_router)
api_router.include_router(orders_router)
api_router.include_router(payments_router)
api_router.include_router(kpis_router)

from routers.orders import get_checkout_summary, admin_get_orders, admin_update_order_status

@api_router.get("/checkout/summary")
async def get_checkout_summary_get(coupon_code: Optional[str] = None, user_id: str = Depends(get_current_user)):
    return await get_checkout_summary(coupon_code=coupon_code, user_id=user_id)

@api_router.post("/orders/summary")
async def get_checkout_summary_post(payload: dict = {}, user_id: str = Depends(get_current_user)):
    coupon_code = payload.get("coupon_code")
    return await get_checkout_summary(coupon_code=coupon_code, user_id=user_id)

@api_router.get("/admin/orders")
async def admin_orders_list_wrapper(
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    admin=Depends(verify_admin),
    limit: int = 100,
    skip: int = 0
):
    return await admin_get_orders(status=status, payment_method=payment_method, admin=admin, limit=limit, skip=skip)

@api_router.put("/admin/orders/{order_id}/status")
@api_router.post("/admin/orders/{order_id}/status")
async def admin_order_status_wrapper(order_id: str, payload: dict, admin=Depends(verify_admin)):
    return await admin_update_order_status(order_id=order_id, payload=payload, admin=admin)



@api_router.patch("/admin/users/update-name")
async def admin_update_user_name(email: str, name: str, admin=Depends(verify_admin)):
    """Admin endpoint: update any user's display name by email (tries multiple field names)."""
    # Try multiple possible email field names used by different auth flows
    for field in ["email", "google_email", "user_email"]:
        result = await db.users.update_one({field: email}, {"$set": {"name": name}})
        if result.matched_count > 0:
            return {"matched": result.matched_count, "modified": result.modified_count, "field": field}
    # Also try case-insensitive regex
    import re as _re
    result = await db.users.update_one(
        {"$or": [{"email": {"$regex": f"^{_re.escape(email)}$", "$options": "i"}},
                 {"google_email": {"$regex": f"^{_re.escape(email)}$", "$options": "i"}}]},
        {"$set": {"name": name}}
    )
    return {"matched": result.matched_count, "modified": result.modified_count, "field": "regex"}

@api_router.get("/admin/users/find")
async def admin_find_user(q: str, admin=Depends(verify_admin)):
    """Admin endpoint: find users matching a string (for debugging)."""
    users = await db.users.find(
        {"$or": [{"email": {"$regex": q, "$options": "i"}}, {"name": {"$regex": q, "$options": "i"}}]},
        {"_id": 0, "email": 1, "name": 1, "google_email": 1, "created_at": 1}
    ).limit(5).to_list(5)
    return users


app.include_router(api_router)
app.include_router(riders_router, prefix="/api")


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
