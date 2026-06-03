"""
GrocerEase — OTP Phone Authentication Routes
Replaces email/password login with phone + OTP.
Requires: pip install fast2sms  (OR use MSG91 / Twilio)
Add these routes to server.py and include the router.
"""
import os, random, time
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
from jose import jwt
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory OTP store (use Redis in production)
# Format: { "+91XXXXXXXXXX": { "otp": "123456", "expires": timestamp } }
_otp_store: dict = {}

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7   # 7 days
FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")


def generate_otp() -> str:
    return str(random.randint(100000, 999999))


async def send_sms_fast2sms(phone: str, otp: str):
    """Send OTP via Fast2SMS (cheapest for India, ~₹0.15/SMS)."""
    if not FAST2SMS_API_KEY:
        # Development mode — print OTP to console
        print(f"[DEV MODE] OTP for {phone}: {otp}")
        return
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
            raise HTTPException(status_code=503, detail="SMS service unavailable. Please try again.")


class SendOtpRequest(BaseModel):
    phone: str  # e.g. "+919876543210"

class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str
    name: str | None = None  # required for new users


def create_tokens(user_id: str) -> dict:
    access_payload = {"sub": user_id, "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}
    refresh_payload = {"sub": user_id, "exp": datetime.utcnow() + timedelta(days=30), "type": "refresh"}
    return {
        "access_token": jwt.encode(access_payload, SECRET_KEY, algorithm=ALGORITHM),
        "refresh_token": jwt.encode(refresh_payload, SECRET_KEY, algorithm=ALGORITHM),
    }


@router.post("/send-otp")
async def send_otp(payload: SendOtpRequest, db=Depends(get_database)):
    """
    Step 1: User enters phone number.
    Returns whether this is a new or existing user.
    """
    phone = payload.phone.strip()
    if not phone.startswith("+91") or len(phone) != 13:
        raise HTTPException(status_code=422, detail="Invalid Indian phone number. Format: +91XXXXXXXXXX")

    otp = generate_otp()
    _otp_store[phone] = {"otp": otp, "expires": time.time() + 300}  # 5 min expiry

    await send_sms_fast2sms(phone, otp)

    existing_user = await db.users.find_one({"phone": phone})
    return {"is_new_user": existing_user is None, "message": "OTP sent successfully"}


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpRequest, db=Depends(get_database)):
    """
    Step 2: Verify OTP. Creates account for new users.
    Returns JWT tokens + user profile.
    """
    phone = payload.phone.strip()
    stored = _otp_store.get(phone)

    if not stored:
        raise HTTPException(status_code=400, detail="OTP expired or not requested. Please request a new OTP.")
    if time.time() > stored["expires"]:
        del _otp_store[phone]
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if stored["otp"] != payload.otp:
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please check and try again.")

    # Valid OTP — remove from store
    del _otp_store[phone]

    user = await db.users.find_one({"phone": phone})

    if not user:
        # New user registration
        if not payload.name or not payload.name.strip():
            raise HTTPException(status_code=422, detail="Name is required for new users.")
        new_user = {
            "phone": phone,
            "name": payload.name.strip(),
            "rewards_balance": 0.0,
            "total_spent": 0.0,
            "tier": "Base",
            "created_at": datetime.utcnow(),
            "cable_tv_linked": False,
        }
        result = await db.users.insert_one(new_user)
        user = await db.users.find_one({"_id": result.inserted_id})

    user_id = str(user["_id"])
    tokens = create_tokens(user_id)

    return {
        **tokens,
        "user": {
            "id": user_id,
            "name": user.get("name", ""),
            "phone": user.get("phone", ""),
            "tier": user.get("tier", "Base"),
            "rewards_balance": user.get("rewards_balance", 0),
            "cable_tv_linked": user.get("cable_tv_linked", False),
        }
    }


@router.post("/refresh")
async def refresh_token(request: dict, db=Depends(get_database)):
    """Refresh access token using refresh token."""
    try:
        payload = jwt.decode(request.get("refresh_token", ""), SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        user_id = payload["sub"]
        tokens = create_tokens(user_id)
        return tokens
    except Exception:
        raise HTTPException(status_code=401, detail="Refresh token expired. Please log in again.")
