#!/usr/bin/env python3
"""
GrocerEase Logout Functionality Test
Testing the complete authentication flow including logout functionality
"""

import requests
import json
import sys
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://grocer-dash.preview.emergentagent.com/api"

class LogoutFunctionalityTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_user_token = None
        self.test_user_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None, token=None):
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        
        if headers is None:
            headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {str(e)}")
            return None
    
    def register_test_user(self):
        """Register a new test user for logout testing"""
        print("\n👤 Registering new test user for logout testing...")
        
        # Generate unique email to avoid conflicts
        unique_id = str(uuid.uuid4())[:8]
        test_user_data = {
            "name": f"Logout Test User {unique_id}",
            "email": f"logout_test_{unique_id}@grocereasetv.com",
            "password": "testpass123",
            "phone": "9876543210",
            "address": "123 Test Street",
            "city": "Test City",
            "pincode": "123456"
        }
        
        response = self.make_request("POST", "/auth/register", test_user_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.test_user_token = data.get("token")
            self.test_user_id = data.get("user", {}).get("id")
            self.test_user_email = test_user_data["email"]
            self.test_user_password = test_user_data["password"]
            self.log_result("User Registration", True, "Test user registered successfully")
            return True
        else:
            error_msg = response.text if response else "Connection failed"
            self.log_result("User Registration", False, "Test user registration failed", error_msg)
            return False
    
    def test_authenticated_endpoint_access(self, token, expected_success=True):
        """Test access to authenticated endpoint"""
        response = self.make_request("GET", "/auth/me", token=token)
        
        if expected_success:
            if response and response.status_code == 200:
                return True, "Authenticated endpoint accessible"
            else:
                return False, f"Expected success but got: {response.status_code if response else 'No response'}"
        else:
            if response and response.status_code in [401, 403]:
                return True, "Authenticated endpoint correctly rejected invalid token"
            else:
                return False, f"Expected 401/403 but got: {response.status_code if response else 'No response'}"
    
    def test_logout_endpoint_exists(self):
        """Test if logout endpoint exists"""
        print("\n🚪 Testing logout endpoint existence...")
        
        response = self.make_request("POST", "/auth/logout", token=self.test_user_token)
        
        if response is None:
            self.log_result("Logout Endpoint - Existence", False, "Connection failed to logout endpoint")
            return False
        elif response.status_code == 404:
            self.log_result("Logout Endpoint - Existence", False, "Logout endpoint does not exist (404)")
            return False
        elif response.status_code == 405:
            self.log_result("Logout Endpoint - Existence", False, "Logout endpoint exists but method not allowed")
            return False
        elif response.status_code in [200, 401, 403]:
            self.log_result("Logout Endpoint - Existence", True, "Logout endpoint exists")
            return True
        else:
            self.log_result("Logout Endpoint - Existence", False, f"Unexpected response: {response.status_code}")
            return False
    
    def test_logout_functionality(self):
        """Test complete logout functionality"""
        print("\n🔐 Testing logout functionality...")
        
        # Step 1: Verify we can access authenticated endpoints with current token
        success, message = self.test_authenticated_endpoint_access(self.test_user_token, expected_success=True)
        if not success:
            self.log_result("Pre-Logout Authentication", False, "Cannot access authenticated endpoints before logout", message)
            return False
        else:
            self.log_result("Pre-Logout Authentication", True, "Can access authenticated endpoints before logout")
        
        # Step 2: Attempt logout
        logout_response = self.make_request("POST", "/auth/logout", token=self.test_user_token)
        
        if logout_response is None:
            self.log_result("Logout Request", False, "Logout request failed - connection error")
            return False
        elif logout_response.status_code == 404:
            self.log_result("Logout Request", False, "Logout endpoint not implemented (404)")
            return False
        elif logout_response.status_code == 200:
            self.log_result("Logout Request", True, "Logout request successful")
            
            # Step 3: Verify token is invalidated
            success, message = self.test_authenticated_endpoint_access(self.test_user_token, expected_success=False)
            if success:
                self.log_result("Token Invalidation", True, "Token correctly invalidated after logout")
                return True
            else:
                self.log_result("Token Invalidation", False, "Token still valid after logout", message)
                return False
        else:
            error_msg = logout_response.text if logout_response else "Unknown error"
            self.log_result("Logout Request", False, f"Logout failed with status {logout_response.status_code}", error_msg)
            return False
    
    def test_login_after_logout(self):
        """Test that user can login again after logout"""
        print("\n🔄 Testing login after logout...")
        
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            new_token = data.get("token")
            
            if new_token and new_token != self.test_user_token:
                self.log_result("Login After Logout", True, "Successfully logged in with new token after logout")
                
                # Verify new token works
                success, message = self.test_authenticated_endpoint_access(new_token, expected_success=True)
                if success:
                    self.log_result("New Token Validation", True, "New token works correctly")
                    return True
                else:
                    self.log_result("New Token Validation", False, "New token doesn't work", message)
                    return False
            else:
                self.log_result("Login After Logout", False, "Login successful but token issue")
                return False
        else:
            error_msg = response.text if response else "Connection failed"
            self.log_result("Login After Logout", False, "Cannot login after logout", error_msg)
            return False
    
    def test_complete_auth_flow(self):
        """Test the complete authentication flow including logout"""
        print("\n🔄 Testing complete authentication flow...")
        
        # Step 1: Login
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        login_response = self.make_request("POST", "/auth/login", login_data)
        
        if not login_response or login_response.status_code != 200:
            self.log_result("Auth Flow - Login", False, "Login failed in auth flow test")
            return False
        
        login_token = login_response.json().get("token")
        self.log_result("Auth Flow - Login", True, "Login successful")
        
        # Step 2: Access protected resource
        success, message = self.test_authenticated_endpoint_access(login_token, expected_success=True)
        if not success:
            self.log_result("Auth Flow - Protected Access", False, "Cannot access protected resource", message)
            return False
        else:
            self.log_result("Auth Flow - Protected Access", True, "Protected resource accessible")
        
        # Step 3: Logout
        logout_response = self.make_request("POST", "/auth/logout", token=login_token)
        
        if not logout_response or logout_response.status_code == 404:
            self.log_result("Auth Flow - Logout", False, "Logout endpoint not available")
            return False
        elif logout_response.status_code != 200:
            self.log_result("Auth Flow - Logout", False, f"Logout failed with status {logout_response.status_code}")
            return False
        else:
            self.log_result("Auth Flow - Logout", True, "Logout successful")
        
        # Step 4: Verify token invalidation
        success, message = self.test_authenticated_endpoint_access(login_token, expected_success=False)
        if success:
            self.log_result("Auth Flow - Token Invalidation", True, "Token correctly invalidated")
            return True
        else:
            self.log_result("Auth Flow - Token Invalidation", False, "Token not invalidated", message)
            return False
    
    def run_logout_tests(self):
        """Run all logout-related tests"""
        print("🚀 Starting GrocerEase Logout Functionality Tests")
        print("=" * 60)
        
        # Step 1: Register test user
        if not self.register_test_user():
            print("❌ Cannot proceed without test user registration")
            return False
        
        # Step 2: Test logout endpoint existence
        logout_exists = self.test_logout_endpoint_exists()
        
        # Step 3: Test logout functionality (if endpoint exists)
        if logout_exists:
            logout_works = self.test_logout_functionality()
            
            # Step 4: Test login after logout (if logout works)
            if logout_works:
                self.test_login_after_logout()
            
            # Step 5: Test complete auth flow
            self.test_complete_auth_flow()
        else:
            print("⚠️  Logout endpoint not implemented - skipping logout functionality tests")
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 Logout Test Summary")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Show failed tests
        if failed_tests > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        # Critical findings
        print("\n🔍 Critical Findings:")
        logout_endpoint_exists = any(r["test"] == "Logout Endpoint - Existence" and r["success"] for r in self.test_results)
        
        if not logout_endpoint_exists:
            print("  ❌ CRITICAL: Logout endpoint (/api/auth/logout) is not implemented")
            print("  ❌ CRITICAL: Token invalidation cannot be tested without logout endpoint")
            print("  ❌ CRITICAL: Complete authentication flow is incomplete")
        else:
            token_invalidation_works = any(r["test"] == "Token Invalidation" and r["success"] for r in self.test_results)
            if not token_invalidation_works:
                print("  ❌ CRITICAL: Token invalidation not working properly")
            else:
                print("  ✅ Logout functionality working correctly")
        
        return failed_tests == 0

def main():
    """Main test execution"""
    tester = LogoutFunctionalityTester()
    success = tester.run_logout_tests()
    
    if success:
        print("\n🎉 All logout tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some logout tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()