from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime

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
    email_otp: Optional[str] = None
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
    store_id: Optional[str] = None  # Task 20: which dark store stocks this product

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
    # Task 15: LOOP credits to redeem at checkout (₹). 0 = none. Capped server-side.
    loop_credits_to_redeem: Optional[float] = 0.0

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None

class SocialAuthRequest(BaseModel):
    provider: str  # "google", "apple", "email"
    email: str
    name: Optional[str] = None
    photo: Optional[str] = None
    session_token: Optional[str] = None

class RefundRequest(BaseModel):
    order_id: str
    amount: Optional[float] = None
    reason: Optional[str] = "Customer request"

class NearestAddressRequest(BaseModel):
    lat: float
    lng: float

class SupportMessage(BaseModel):
    message: str

class SendEmailOtpRequest(BaseModel):
    email: EmailStr
