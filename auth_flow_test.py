#!/usr/bin/env python3
"""
Quick Authentication Flow Test
Testing existing auth endpoints to understand current state
"""

import requests
import json
import uuid

BASE_URL = "https://fresh-delivery-13.preview.emergentagent.com/api"

def test_auth_endpoints():
    print("🔐 Testing Authentication Endpoints")
    print("=" * 50)
    
    # Generate unique user
    unique_id = str(uuid.uuid4())[:8]
    test_user = {
        "name": f"Auth Test {unique_id}",
        "email": f"auth_test_{unique_id}@test.com",
        "password": "testpass123",
        "phone": "9876543210",
        "address": "Test Address",
        "city": "Test City",
        "pincode": "123456"
    }
    
    # Test registration
    print("\n1. Testing Registration...")
    reg_response = requests.post(f"{BASE_URL}/auth/register", json=test_user, timeout=30)
    if reg_response.status_code == 200:
        print("✅ Registration: SUCCESS")
        reg_data = reg_response.json()
        token = reg_data.get("token")
        print(f"   Token received: {token[:20]}..." if token else "   No token received")
    else:
        print(f"❌ Registration: FAILED ({reg_response.status_code})")
        print(f"   Error: {reg_response.text}")
        return
    
    # Test login
    print("\n2. Testing Login...")
    login_data = {"email": test_user["email"], "password": test_user["password"]}
    login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=30)
    if login_response.status_code == 200:
        print("✅ Login: SUCCESS")
        login_token = login_response.json().get("token")
        print(f"   New token: {login_token[:20]}..." if login_token else "   No token received")
    else:
        print(f"❌ Login: FAILED ({login_response.status_code})")
        return
    
    # Test protected endpoint
    print("\n3. Testing Protected Endpoint (/auth/me)...")
    headers = {"Authorization": f"Bearer {token}"}
    me_response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
    if me_response.status_code == 200:
        print("✅ Protected Endpoint: SUCCESS")
        user_data = me_response.json()
        print(f"   User ID: {user_data.get('id')}")
        print(f"   Email: {user_data.get('email')}")
    else:
        print(f"❌ Protected Endpoint: FAILED ({me_response.status_code})")
    
    # Test logout endpoint
    print("\n4. Testing Logout Endpoint...")
    logout_response = requests.post(f"{BASE_URL}/auth/logout", headers=headers, timeout=30)
    print(f"   Status Code: {logout_response.status_code}")
    if logout_response.status_code == 404:
        print("❌ Logout Endpoint: NOT IMPLEMENTED")
    elif logout_response.status_code == 200:
        print("✅ Logout Endpoint: EXISTS")
        
        # Test if token is invalidated
        print("\n5. Testing Token Invalidation...")
        me_response_after = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
        if me_response_after.status_code in [401, 403]:
            print("✅ Token Invalidation: SUCCESS")
        else:
            print(f"❌ Token Invalidation: FAILED (still works: {me_response_after.status_code})")
    else:
        print(f"❌ Logout Endpoint: ERROR ({logout_response.status_code})")
        print(f"   Response: {logout_response.text}")
    
    # Test with invalid token
    print("\n6. Testing Invalid Token Handling...")
    invalid_headers = {"Authorization": "Bearer invalid_token_12345"}
    invalid_response = requests.get(f"{BASE_URL}/auth/me", headers=invalid_headers, timeout=30)
    if invalid_response.status_code in [401, 403]:
        print("✅ Invalid Token Handling: SUCCESS")
    else:
        print(f"❌ Invalid Token Handling: FAILED ({invalid_response.status_code})")

if __name__ == "__main__":
    test_auth_endpoints()