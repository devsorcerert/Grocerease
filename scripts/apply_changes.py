import os

server_path = 'backend/server.py'
with open(server_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (
        "from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request\nfrom fastapi.security import HTTPBearer, HTTPAuthorizationCredentials\nfrom dotenv import load_dotenv\n",
        "from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request\nfrom fastapi.security import HTTPBearer, HTTPAuthorizationCredentials\nfrom dotenv import load_dotenv\nfrom slowapi import Limiter, _rate_limit_exceeded_handler\nfrom slowapi.util import get_remote_address\nfrom slowapi.errors import RateLimitExceeded\n"
    ),
    (
        "# Create the main app\napp = FastAPI()\napi_router = APIRouter(prefix=\"/api\")\n\n@app.on_event(\"startup\")",
        "# Create the main app\napp = FastAPI()\napi_router = APIRouter(prefix=\"/api\")\n\nlimiter = Limiter(key_func=get_remote_address)\napp.state.limiter = limiter\napp.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)\nAUTH_RATE_LIMIT = os.environ.get(\"AUTH_RATE_LIMIT\", \"5/minute\")\n\n@app.on_event(\"startup\")"
    ),
    (
        "        await client.admin.command('ping')\n        logging.info(\"Successfully connected to MongoDB!\")\n    except Exception as e:",
        "        await client.admin.command('ping')\n        logging.info(\"Successfully connected to MongoDB!\")\n        \n        # Create MongoDB indexes\n        await db.users.create_index(\"email\", unique=True)\n        await db.users.create_index(\"phone\", unique=True)\n        await db.orders.create_index(\"user_id\")\n        await db.orders.create_index(\"id\", unique=True)\n        await db.products.create_index(\"category\")\n        await db.products.create_index(\"id\", unique=True)\n        await db.products.create_index([(\"name\", \"text\"), (\"description\", \"text\")])\n    except Exception as e:"
    ),
    (
        "@api_router.post(\"/auth/login\")\nasync def login(user: UserLogin):",
        "@api_router.post(\"/auth/login\")\n@limiter.limit(AUTH_RATE_LIMIT)\nasync def login(request: Request, user: UserLogin):"
    ),
    (
        "@api_router.post(\"/auth/send-otp\")\nasync def send_otp(payload: SendOtpRequest):",
        "@api_router.post(\"/auth/send-otp\")\n@limiter.limit(AUTH_RATE_LIMIT)\nasync def send_otp(request: Request, payload: SendOtpRequest):"
    ),
    (
        "@api_router.post(\"/auth/verify-otp\")\nasync def verify_otp(payload: VerifyOtpRequest):",
        "@api_router.post(\"/auth/verify-otp\")\n@limiter.limit(AUTH_RATE_LIMIT)\nasync def verify_otp(request: Request, payload: VerifyOtpRequest):"
    ),
    (
        "        except Exception:\n            rz_order_id = f\"rzp_mock_{uuid.uuid4().hex[:14]}\"\n    else:\n        rz_order_id = f\"rzp_mock_{uuid.uuid4().hex[:14]}\"",
        "        except Exception:\n            if os.environ.get(\"ENV\", \"development\") != \"development\":\n                raise HTTPException(status_code=400, detail=\"Mock payments not allowed in production\")\n            rz_order_id = f\"rzp_mock_{uuid.uuid4().hex[:14]}\"\n    else:\n        if os.environ.get(\"ENV\", \"development\") != \"development\":\n            raise HTTPException(status_code=400, detail=\"Razorpay not configured and mock not allowed in prod\")\n        rz_order_id = f\"rzp_mock_{uuid.uuid4().hex[:14]}\""
    ),
    (
        "@api_router.post(\"/payments/razorpay/verify\")\nasync def verify_razorpay_payment(payload: VerifyPaymentRequest, user_id: str = Depends(get_current_user)):\n    if payload.razorpay_order_id.startswith(\"rzp_mock_\"):\n        success = True",
        "@api_router.post(\"/payments/razorpay/verify\")\nasync def verify_razorpay_payment(payload: VerifyPaymentRequest, user_id: str = Depends(get_current_user)):\n    if payload.razorpay_order_id.startswith(\"rzp_mock_\"):\n        if os.environ.get(\"ENV\", \"development\") != \"development\":\n            raise HTTPException(status_code=400, detail=\"Mock payments not allowed in production\")\n        success = True"
    ),
    (
        "app.add_middleware(\n    CORSMiddleware,\n    allow_credentials=True,\n    allow_origins=os.environ.get(\"ALLOWED_ORIGINS\", \"*\").split(\",\"),\n    allow_methods=[\"*\"],\n    allow_headers=[\"*\"],\n)",
        "env_origins = os.environ.get(\"ALLOWED_ORIGINS\", \"\").strip()\nif os.environ.get(\"ENV\", \"development\") != \"development\" and not env_origins:\n    raise RuntimeError(\"ALLOWED_ORIGINS must be set in non-development environments\")\n\napp.add_middleware(\n    CORSMiddleware,\n    allow_credentials=True,\n    allow_origins=env_origins.split(\",\") if env_origins else [\"*\"],\n    allow_methods=[\"*\"],\n    allow_headers=[\"*\"],\n)"
    )
]

for t, r in replacements:
    content = content.replace(t, r)

with open(server_path, 'w', encoding='utf-8') as f:
    f.write(content)