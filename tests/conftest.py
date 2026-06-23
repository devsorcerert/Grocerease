"""
Pytest conftest: patch AsyncIOMotorClient with a singleton mongomock_motor
client so all test requests share the same in-memory database.
"""
import os
import sys

os.environ.setdefault("DB_NAME", "grocerease_test")
os.environ.setdefault("JWT_SECRET_KEY", "super-secret-test-key-minimum-32-chars-long-12345")
os.environ.setdefault("ADMIN_EMAIL", "grocereasetv@gmail.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")
os.environ.setdefault("RAZORPAY_KEY_ID", "rzp_test_dummykey")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "dummypaymentsecret")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import mongomock_motor
import motor.motor_asyncio as _motor

# One shared mock client for the whole test session.
_MOCK_CLIENT = mongomock_motor.AsyncMongoMockClient()


class _SingletonMockClient:
    """Always returns the shared mock client — survives loop changes."""
    def __new__(cls, *args, **kwargs):
        return _MOCK_CLIENT


# Replace AsyncIOMotorClient before any app module loads.
_motor.AsyncIOMotorClient = _SingletonMockClient
