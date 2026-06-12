from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import jwt
from datetime import datetime, timedelta
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()

GOOGLE_CLIENT_ID = "1033798066161-00g31ael0mipkviip26btj04q6090ksq.apps.googleusercontent.com"
JWT_SECRET       = os.environ.get("JWT_SECRET")
JWT_ALGORITHM    = "HS256"
JWT_EXPIRES_DAYS = 30

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET env var is not set.")

class GoogleTokenRequest(BaseModel):
    id_token: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRES_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/google", response_model=AuthResponse)
async def google_sign_in(body: GoogleTokenRequest):
    try:
        google_user = id_token.verify_oauth2_token(
            body.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    from ..database import get_db
    db = await get_db().__anext__()

    google_id = google_user["sub"]
    email = google_user.get("email", "")
    name  = google_user.get("name", "")
    photo = google_user.get("picture", "")

    users = db["users"]
    existing = await users.find_one({"google_id": google_id})

    if existing:
        user_id = str(existing["_id"])
        await users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"last_login": datetime.utcnow(), "name": name, "photo": photo}},
        )
    else:
        result = await users.insert_one({
            "google_id": google_id, "email": email, "name": name,
            "photo": photo, "role": "customer",
            "created_at": datetime.utcnow(), "last_login": datetime.utcnow(),
        })
        user_id = str(result.inserted_id)

    return AuthResponse(
        access_token=create_access_token(user_id, email),
        user={"id": user_id, "email": email, "name": name, "photo": photo},
    )

@router.get("/verify")
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    decode_access_token(credentials.credentials)
    return {"valid": True}
