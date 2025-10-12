#!/usr/bin/env python3
"""
Backend Authentication Flow Testing
Tests the complete authentication system with refresh token functionality
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://fresh-delivery-13.preview.emergentagent.com/api"

class AuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_user_email = "testauth2025@grocerease.com"
        self.test_user_password = "SecurePass123!"
        self.test_user_name = "Auth Test User"
        self.access_token = None
        self.refresh_token = None
        self.user_id = None
        
    def log(self, message, status="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {status}: {message}")
        
    def test_register(self):
        """Test user registration with refresh token"""
        self.log("Testing user registration...")
        
        payload = {
            "name": self.test_user_name,
            "email": self.test_user_email,
            "password": self.test_user_password,
            "phone": "+91 9876543210",
            "address": "123 Test Street",
            "city": "Mumbai",
            "pincode": "400001"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if both tokens are returned
                if "token" in data and "refresh_token" in data:
                    self.access_token = data["token"]
                    self.refresh_token = data["refresh_token"]
                    self.user_id = data.get("user", {}).get("id")
                    
                    self.log("✅ Registration successful - both tokens received")
                    self.log(f"   Access Token: {self.access_token[:20]}...")
                    self.log(f"   Refresh Token: {self.refresh_token[:20]}...")
                    return True
                else:
                    self.log("❌ Registration missing tokens", "ERROR")
                    self.log(f"   Response: {data}")
                    return False
                    
            elif response.status_code == 400 and "already registered" in response.text:
                self.log("⚠️  User already exists - proceeding to login test")
                return True
            else:
                self.log(f"❌ Registration failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Registration error: {str(e)}", "ERROR")
            return False
    
    def test_login(self):
        """Test user login with refresh token"""
        self.log("Testing user login...")
        
        payload = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if both tokens are returned
                if "token" in data and "refresh_token" in data:
                    self.access_token = data["token"]
                    self.refresh_token = data["refresh_token"]
                    self.user_id = data.get("user", {}).get("id")
                    
                    self.log("✅ Login successful - both tokens received")
                    self.log(f"   Access Token: {self.access_token[:20]}...")
                    self.log(f"   Refresh Token: {self.refresh_token[:20]}...")
                    return True
                else:
                    self.log("❌ Login missing tokens", "ERROR")
                    self.log(f"   Response: {data}")
                    return False
            else:
                self.log(f"❌ Login failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Login error: {str(e)}", "ERROR")
            return False
    
    def test_protected_endpoint(self):
        """Test accessing protected endpoint with token"""
        self.log("Testing protected endpoint access...")
        
        if not self.access_token:
            self.log("❌ No access token available", "ERROR")
            return False
            
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        try:
            response = self.session.get(f"{BACKEND_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Protected endpoint access successful")
                self.log(f"   User ID: {data.get('id')}")
                self.log(f"   Email: {data.get('email')}")
                return True
            else:
                self.log(f"❌ Protected endpoint failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Protected endpoint error: {str(e)}", "ERROR")
            return False
    
    def test_refresh_token(self):
        """Test refresh token endpoint"""
        self.log("Testing refresh token endpoint...")
        
        if not self.refresh_token:
            self.log("❌ No refresh token available", "ERROR")
            return False
            
        payload = {"refresh_token": self.refresh_token}
        
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/refresh", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if new tokens are returned
                if "token" in data and "refresh_token" in data:
                    old_access_token = self.access_token
                    old_refresh_token = self.refresh_token
                    
                    self.access_token = data["token"]
                    self.refresh_token = data["refresh_token"]
                    
                    self.log("✅ Token refresh successful - new tokens received")
                    self.log(f"   New Access Token: {self.access_token[:20]}...")
                    self.log(f"   New Refresh Token: {self.refresh_token[:20]}...")
                    
                    # Verify tokens are different
                    if old_access_token != self.access_token and old_refresh_token != self.refresh_token:
                        self.log("✅ New tokens are different from old ones")
                        return True
                    else:
                        self.log("⚠️  New tokens are same as old ones")
                        return True
                else:
                    self.log("❌ Refresh response missing tokens", "ERROR")
                    self.log(f"   Response: {data}")
                    return False
            else:
                self.log(f"❌ Token refresh failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Token refresh error: {str(e)}", "ERROR")
            return False
    
    def test_logout(self):
        """Test logout endpoint"""
        self.log("Testing logout endpoint...")
        
        if not self.access_token:
            self.log("❌ No access token available", "ERROR")
            return False
            
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/logout", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "Logout successful" in data.get("message", ""):
                    self.log("✅ Logout successful")
                    self.log(f"   Response: {data}")
                    return True
                else:
                    self.log("❌ Logout response format incorrect", "ERROR")
                    self.log(f"   Response: {data}")
                    return False
            else:
                self.log(f"❌ Logout failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Logout error: {str(e)}", "ERROR")
            return False
    
    def test_invalid_token_handling(self):
        """Test handling of invalid tokens"""
        self.log("Testing invalid token handling...")
        
        invalid_headers = {"Authorization": "Bearer invalid_token_12345"}
        
        try:
            # Test protected endpoint with invalid token
            response = self.session.get(f"{BACKEND_URL}/auth/me", headers=invalid_headers)
            
            if response.status_code == 401:
                self.log("✅ Invalid token properly rejected (401)")
                return True
            else:
                self.log(f"❌ Invalid token not properly handled: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Invalid token test error: {str(e)}", "ERROR")
            return False
    
    def test_missing_token_handling(self):
        """Test handling of missing tokens"""
        self.log("Testing missing token handling...")
        
        try:
            # Test protected endpoint without token
            response = self.session.get(f"{BACKEND_URL}/auth/me")
            
            if response.status_code in [401, 403]:
                self.log(f"✅ Missing token properly rejected ({response.status_code})")
                return True
            else:
                self.log(f"❌ Missing token not properly handled: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Missing token test error: {str(e)}", "ERROR")
            return False
    
    def run_complete_auth_flow_test(self):
        """Run the complete authentication flow test"""
        self.log("=" * 60)
        self.log("STARTING COMPLETE AUTHENTICATION FLOW TEST")
        self.log("=" * 60)
        
        test_results = []
        
        # Test 1: Register user
        test_results.append(("User Registration", self.test_register()))
        
        # Test 2: Login user  
        test_results.append(("User Login", self.test_login()))
        
        # Test 3: Access protected endpoint
        test_results.append(("Protected Endpoint Access", self.test_protected_endpoint()))
        
        # Test 4: Refresh token
        test_results.append(("Token Refresh", self.test_refresh_token()))
        
        # Test 5: Test with new token after refresh
        test_results.append(("Protected Access After Refresh", self.test_protected_endpoint()))
        
        # Test 6: Logout
        test_results.append(("User Logout", self.test_logout()))
        
        # Test 7: Invalid token handling
        test_results.append(("Invalid Token Handling", self.test_invalid_token_handling()))
        
        # Test 8: Missing token handling
        test_results.append(("Missing Token Handling", self.test_missing_token_handling()))
        
        # Summary
        self.log("=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        failed = 0
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name}: {status}")
            if result:
                passed += 1
            else:
                failed += 1
        
        self.log("=" * 60)
        self.log(f"TOTAL: {passed} PASSED, {failed} FAILED")
        
        if failed == 0:
            self.log("🎉 ALL AUTHENTICATION TESTS PASSED!")
            return True
        else:
            self.log(f"⚠️  {failed} TESTS FAILED - AUTHENTICATION SYSTEM NEEDS ATTENTION")
            return False

def main():
    """Main test execution"""
    print("Backend Authentication Flow Tester")
    print(f"Testing against: {BACKEND_URL}")
    print()
    
    tester = AuthTester()
    success = tester.run_complete_auth_flow_test()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()