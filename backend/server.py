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
    
    return {"token": token, "user": {"id": user_dict["id"], "name": user_dict["name"], "email": user_dict["email"]}}

@api_router.post("/auth/login")
async def login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": db_user["id"]})
    return {"token": token, "user": {"id": db_user["id"], "name": db_user["name"], "email": db_user["email"]}}

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
        "cable_tv_linked": user.get("cable_tv_linked", False),
        "cable_tv_details": user.get("cable_tv_details"),
        "monthly_spend": user.get("monthly_spend", 0.0),
        "current_reward": user.get("current_reward", 0.0),
        "is_admin": user.get("is_admin", False)
    }

# Cable TV Routes
@api_router.post("/cable-tv/link")
async def link_cable_tv(data: CableTVLink, user_id: str = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"cable_tv_linked": True, "cable_tv_details": data.dict()}}
    )
    return {"success": True, "message": "Cable TV linked successfully"}

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
    return product_dict

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
    return cart

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
    return cart

@api_router.delete("/cart/clear")
async def clear_cart(user_id: str = Depends(get_current_user)):
    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": []}})
    return {"success": True}

# Order Routes
@api_router.post("/orders")
async def create_order(order_data: OrderCreate, user_id: str = Depends(get_current_user)):
    order_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        **order_data.dict(),
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    await db.orders.insert_one(order_dict)
    
    user = await db.users.find_one({"id": user_id})
    new_spend = user.get("monthly_spend", 0.0) + order_data.total
    
    reward = 0.0
    if new_spend >= 25000:
        reward = 1000.0
    elif new_spend >= 13000:
        reward = 500.0
    elif new_spend >= 7000:
        reward = 250.0
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "monthly_spend": new_spend,
            "total_spend": user.get("total_spend", 0.0) + order_data.total,
            "current_reward": reward
        }}
    )
    
    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": []}})
    return order_dict

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
    return video_dict

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
