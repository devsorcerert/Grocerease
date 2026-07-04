import os
import sys
import pytest
from fastapi.testclient import TestClient

# Set test environment variables before importing any app modules
os.environ.setdefault("DB_NAME", "grocerease_test")
os.environ.setdefault("JWT_SECRET_KEY", "super-secret-test-key-minimum-32-chars-long-12345")
os.environ.setdefault("ADMIN_EMAIL", "grocereasetv@gmail.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")
os.environ.setdefault("RAZORPAY_KEY_ID", "rzp_test_dummykey")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "dummypaymentsecret")
# Fix 9 removed the hardcoded fallback for MSO_SHARED_SECRET from loop_ledger.py
# (it was a public secret leak). conftest.py's `from server import app` below
# runs before any test module's own os.environ sets, so this MUST be set here
# — setting it only in test_backend.py is too late, since loop_ledger.py reads
# it once at import time and conftest.py is always collected first.
os.environ.setdefault("MSO_SHARED_SECRET", "grocerease-mso-pilot-2024")

# Add backend directory to sys.path so imports work from any test file
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from server import app


@pytest.fixture
def client_fixture():
    """Shared TestClient fixture available to all test files via conftest."""
    return TestClient(app)
