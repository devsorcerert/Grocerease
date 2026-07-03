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

class CableTVSTBLink(BaseModel):
    stb_number: str
    service_provider: str = "GTPL"
    # Fix 8: OTP verifying the user owns the phone attached to their account.
    # /cable-tv/link-init sends the OTP; /cable-tv/link requires it.
    otp: Optional[str] = None


class CableTVLinkInit(BaseModel):
    stb_number: str

class ProductCreate(BaseModel):
    name: str
    category: str
    subcategory: str
    price_paise: int
    mrp_paise: Optional[int] = None
    image_url: str
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


# ── Admin product write models (Task 18 — canonical schema enforcement) ─────────

class AdminProductCreate(BaseModel):
    """
    Canonical shape for admin-created products.
    All write paths must produce documents that match this shape.
    Field names and units are authoritative per CONTRACTS.md §7.
    """
    name: str
    category: str
    subcategory: Optional[str] = ""
    brand: Optional[str] = ""
    price_paise: int                    # selling price in paise (e.g. 4900 = ₹49)
    mrp_paise: Optional[int] = None     # MRP in paise; None = no strikethrough price
    stock: int = 100
    unit: str = "1 kg"
    description: Optional[str] = ""
    image_url: str = ""                 # full URL or empty string — NEVER "image"
    is_active: bool = True
    store_id: Optional[str] = None      # Task 20: dark-store assignment; None = all stores


class AdminProductUpdate(BaseModel):
    """
    All fields optional — only provided keys are written to $set.
    Same canonical names/units as AdminProductCreate.
    Unknown fields rejected by Pydantic (extra = 'forbid').
    """
    model_config = {"extra": "forbid"}

    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    price_paise: Optional[int] = None
    mrp_paise: Optional[int] = None
    stock: Optional[int] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    store_id: Optional[str] = None


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
    # Task 15: LOOP credits to redeem at checkout (â¹). 0 = none. Capped server-side.
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


# ── Fix 7: address + payment-method models (block mass assignment) ─────────────
# The old raw-dict endpoints spread request bodies into $set, so a client-sent
# {"user_id": "<victim-id>"} would rewrite the trusted user_id. These models
# forbid unknown fields and drop user_id/id from the schema entirely.

class AddressCreate(BaseModel):
    model_config = {"extra": "forbid"}
    label: str = "Home"
    full_address: str
    landmark: Optional[str] = None
    pincode: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: Optional[bool] = False


class AddressUpdate(BaseModel):
    model_config = {"extra": "forbid"}
    label: Optional[str] = None
    full_address: Optional[str] = None
    landmark: Optional[str] = None
    pincode: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: Optional[bool] = None


class PaymentMethodCreate(BaseModel):
    """We never store PAN/CVV — only the last-4 or a tokenised identifier.
    Any 'save card' feature must go through Razorpay's vault, not our DB."""
    model_config = {"extra": "forbid"}
    type: str  # "upi" | "card_last4" | "netbanking" | "cod"
    label: str
    upi_id: Optional[str] = None
    card_last4: Optional[str] = None
    is_default: Optional[bool] = False


class NotificationPreferences(BaseModel):
    model_config = {"extra": "forbid"}
    order_updates: Optional[bool] = True
    promotions: Optional[bool] = True
    new_arrivals: Optional[bool] = False
    price_drops: Optional[bool] = True
