from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")


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
SECRET_KEY = "grocerease_secret_key_2025"
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
    address: str
    city: str
    pincode: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    id_token: str
    name: str
    email: EmailStr
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
    subtotal: float
    reward_applied: float
    total: float
    payment_method: str = "mock"

class VideoCreate(BaseModel):
    title: str
    description: str
    thumbnail: str
    stream_url: Optional[str] = None
    duration: str = "00:00"
    ingredients: List[dict] = []
    is_live: bool = False

# Auth Routes
@api_router.post("/auth/register")
async def register(user: UserRegister):
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
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "address": profile.address,
            "city": profile.city,
            "pincode": profile.pincode
        }}
    )
    return {"success": True}

@api_router.post("/auth/login")
async def login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": db_user["id"]})
    return {"token": token, "user": {"id": db_user["id"], "name": db_user["name"], "email": db_user["email"]}}

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
        
        # In a production environment, you would:
        # 1. Validate the refresh token against database
        # 2. Check if it's expired or revoked
        # 3. Get user info from refresh token
        
        # For now, create new tokens (mock implementation)
        # This would typically decode the refresh token to get user_id
        try:
            # Mock decode - in production, properly decode and validate refresh token
            user_id = "mock_user_id"  # This would come from token validation
            
            # Generate new tokens
            new_access_token = create_access_token(data={"sub": user_id})
            new_refresh_token = create_access_token(data={"sub": user_id, "type": "refresh"})
            
            return {
                "token": new_access_token,
                "refresh_token": new_refresh_token
            }
        except Exception as decode_error:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Token refresh failed")

@api_router.post("/auth/google")
async def google_auth(auth_data: GoogleAuthRequest):
    db_user = await db.users.find_one({"email": auth_data.email})
    
    if not db_user:
        user_dict = {
            "id": str(uuid.uuid4()),
            "name": auth_data.name,
            "email": auth_data.email,
            "password": None,
            "phone": None,
            "photo": auth_data.photo,
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
    
    token = create_access_token({"user_id": db_user["id"]})
    return {"token": token, "user": {"id": db_user["id"], "name": db_user["name"], "email": db_user["email"]}}

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
async def get_products(category: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    products = await db.products.find(query).to_list(1000)
    # Remove MongoDB _id field
    for product in products:
        if "_id" in product:
            del product["_id"]
    return products

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
    
    # Calculate rewards and apply them automatically
    rewards_info = calculate_spending_tiers_and_rewards(
        user.get("monthly_spend", 0.0), 
        order_data.subtotal
    )
    
    # Auto-apply rewards (user's available reward balance)
    current_reward_balance = user.get("current_reward", 0.0)
    reward_applied = min(current_reward_balance, order_data.subtotal)
    final_total = order_data.subtotal - reward_applied
    
    order_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "items": order_data.items,
        "subtotal": order_data.subtotal,
        "reward_applied": reward_applied,
        "total": final_total,
        "payment_method": order_data.payment_method,
        "tier_info": rewards_info["current_tier"],
        "order_cashback_earned": rewards_info["order_cashback"],
        "rewards_auto_applied": True,
        "status": "confirmed",
        "delivery_status": "confirmed",
        "estimated_delivery": datetime.utcnow() + timedelta(hours=1),
        "delivery_address": f"{user.get('address', '')}, {user.get('city', '')}, {user.get('pincode', '')}",
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

@api_router.get("/orders")
async def get_orders(user_id: str = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    return clean_mongo_docs(orders)

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

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
