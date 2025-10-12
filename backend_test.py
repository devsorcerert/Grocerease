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
    
    def create_test_user(self):
        """Create a test user for testing"""
        print("\n👤 Creating test user...")
        
        test_user_data = {
            "name": "Test User",
            "email": "testuser@grocereasetv.com",
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
            self.log_result("Test User Creation", True, "Test user created successfully")
            return True
        else:
            error_msg = response.text if response else "Connection failed"
            self.log_result("Test User Creation", False, "Test user creation failed", error_msg)
            return False
    
    def seed_test_products(self):
        """Seed some test products for ingredient mapping"""
        print("\n🛒 Seeding test products...")
        
        test_products = [
            {
                "name": "Fresh Tomatoes",
                "category": "Fruits & Vegetables",
                "subcategory": "Vegetables",
                "price": 40.0,
                "original_price": 50.0,
                "image": "https://example.com/tomato.jpg",
                "stock": 100,
                "unit": "1 kg",
                "description": "Fresh red tomatoes"
            },
            {
                "name": "Basmati Rice",
                "category": "Atta, Rice & Dal",
                "subcategory": "Rice",
                "price": 120.0,
                "original_price": 150.0,
                "image": "https://example.com/rice.jpg",
                "stock": 50,
                "unit": "1 kg",
                "description": "Premium basmati rice"
            },
            {
                "name": "Cooking Oil",
                "category": "Sauces & Spreads",
                "subcategory": "Oil",
                "price": 180.0,
                "original_price": 200.0,
                "image": "https://example.com/oil.jpg",
                "stock": 30,
                "unit": "1 liter",
                "description": "Refined cooking oil"
            }
        ]
        
        product_ids = []
        for product_data in test_products:
            response = self.make_request("POST", "/products", product_data, token=self.admin_token)
            
            if response and response.status_code == 200:
                data = response.json()
                product_ids.append(data.get("id"))
            else:
                error_msg = response.text if response else "Connection failed"
                self.log_result("Product Seeding", False, f"Failed to create product: {product_data['name']}", error_msg)
                return []
        
        self.log_result("Product Seeding", True, f"Successfully created {len(product_ids)} test products")
        return product_ids
    
    def seed_test_video(self, product_ids):
        """Seed a test video with mixed mapped/unmapped ingredients"""
        print("\n🎥 Seeding test video...")
        
        # Create ingredients list with mixed mapped/unmapped items
        ingredients = [
            {"name": "Tomatoes", "quantity": 2, "product_id": product_ids[0] if len(product_ids) > 0 else None},
            {"name": "Rice", "quantity": 1, "product_id": product_ids[1] if len(product_ids) > 1 else None},
            {"name": "Onions", "quantity": 3, "product_id": None},  # Unmapped ingredient
            {"name": "Cooking Oil", "quantity": 1, "product_id": product_ids[2] if len(product_ids) > 2 else None},
            {"name": "Garlic", "quantity": 1, "product_id": None}  # Unmapped ingredient
        ]
        
        video_data = {
            "title": "Delicious Tomato Rice Recipe",
            "description": "Learn to make tasty tomato rice with simple ingredients",
            "thumbnail": "https://example.com/video-thumb.jpg",
            "stream_url": "https://example.com/video-stream.mp4",
            "duration": "15:30",
            "ingredients": ingredients,
            "is_live": False
        }
        
        response = self.make_request("POST", "/videos", video_data, token=self.admin_token)
        
        if response and response.status_code == 200:
            data = response.json()
            video_id = data.get("id")
            self.log_result("Video Seeding", True, "Test video created successfully")
            return video_id, ingredients
        else:
            error_msg = response.text if response else "Connection failed"
            self.log_result("Video Seeding", False, "Failed to create test video", error_msg)
            return None, []
    
    def test_bulk_cart_addition(self, ingredients):
        """Test 1: One-Click Add Ingredients (Bulk Cart Addition)"""
        print("\n🛒 Testing Bulk Cart Addition...")
        
        # Test bulk add ingredients endpoint
        bulk_data = {"ingredient_list": ingredients}
        
        response = self.make_request("POST", "/cart/add-bulk", bulk_data, token=self.test_user_token)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_fields = ["success", "cart", "added_count", "failed_ingredients", "message"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Bulk Cart Addition - Response Structure", False, 
                              f"Missing fields: {missing_fields}", data)
                return False
            
            # Check if some ingredients were added and some failed (as expected)
            added_count = data.get("added_count", 0)
            failed_ingredients = data.get("failed_ingredients", [])
            
            if added_count > 0:
                self.log_result("Bulk Cart Addition - Success Count", True, 
                              f"Successfully added {added_count} ingredients")
            else:
                self.log_result("Bulk Cart Addition - Success Count", False, 
                              "No ingredients were added to cart")
            
            if len(failed_ingredients) > 0:
                self.log_result("Bulk Cart Addition - Failed Ingredients", True, 
                              f"Correctly handled {len(failed_ingredients)} unmapped ingredients")
            
            # Verify cart contents
            cart_response = self.make_request("GET", "/cart", token=self.test_user_token)
            if cart_response and cart_response.status_code == 200:
                cart_data = cart_response.json()
                cart_items = cart_data.get("items", [])
                
                if len(cart_items) == added_count:
                    self.log_result("Bulk Cart Addition - Cart Verification", True, 
                                  f"Cart contains {len(cart_items)} items as expected")
                else:
                    self.log_result("Bulk Cart Addition - Cart Verification", False, 
                                  f"Cart has {len(cart_items)} items, expected {added_count}")
            
            return True
        else:
            error_msg = response.text if response else "Connection failed"
            self.log_result("Bulk Cart Addition", False, "Bulk cart addition failed", error_msg)
            return False
    
    def test_cable_tv_infrastructure(self):
        """Test 2: Cable TV API Infrastructure"""
        print("\n📺 Testing Cable TV Infrastructure...")
        
        # Test cable TV linking
        cable_data = {
            "user_id_nuid": "TEST123456789",
            "phone": "9876543210",
            "service_provider": "Tata Sky"
        }
        
        response = self.make_request("POST", "/cable-tv/link", cable_data, token=self.test_user_token)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify infrastructure readiness indicators
            required_fields = ["success", "message", "verification_status", "infrastructure_ready"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Cable TV Link - Response Structure", False, 
                              f"Missing fields: {missing_fields}", data)
                return False
            
            if data.get("infrastructure_ready") == True:
                self.log_result("Cable TV Link - Infrastructure Ready", True, 
                              "Infrastructure readiness confirmed")
            else:
                self.log_result("Cable TV Link - Infrastructure Ready", False, 
                              "Infrastructure not ready")
            
            # Test sync status endpoint
            sync_response = self.make_request("GET", "/cable-tv/sync-status", token=self.test_user_token)
            
            if sync_response and sync_response.status_code == 200:
                sync_data = sync_response.json()
                
                required_sync_fields = ["linked", "service_provider", "verification_status", 
                                      "infrastructure_ready", "api_integration_status"]
                missing_sync_fields = [field for field in required_sync_fields if field not in sync_data]
                
                if not missing_sync_fields:
                    self.log_result("Cable TV Sync Status", True, 
                                  "Sync status endpoint working correctly")
                else:
                    self.log_result("Cable TV Sync Status", False, 
                                  f"Missing sync fields: {missing_sync_fields}")
            
            # Test force sync endpoint
            force_sync_response = self.make_request("POST", "/cable-tv/force-sync", token=self.test_user_token)
            
            if force_sync_response and force_sync_response.status_code == 200:
                force_sync_data = force_sync_response.json()
                
                if "status" in force_sync_data and "last_sync" in force_sync_data:
                    self.log_result("Cable TV Force Sync", True, 
                                  "Force sync endpoint working correctly")
                else:
                    self.log_result("Cable TV Force Sync", False, 
                                  "Force sync response missing required fields")
            
            return True
        else:
            error_msg = response.text if response else "Connection failed"
            self.log_result("Cable TV Link", False, "Cable TV linking failed", error_msg)
            return False
    
    def test_auto_rewards_system(self):
        """Test 3: Auto-Rewards System"""
        print("\n🎁 Testing Auto-Rewards System...")
        
        # Test calculate rewards endpoint
        checkout_data = {"subtotal": 500.0}
        
        response = self.make_request("POST", "/checkout/calculate-rewards", checkout_data, token=self.test_user_token)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_fields = ["subtotal", "current_reward_balance", "rewards_auto_applied", 
                             "final_total", "new_tier_info", "order_cashback_earned", 
                             "infrastructure_ready", "breakdown"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Auto-Rewards Calculate - Response Structure", False, 
                              f"Missing fields: {missing_fields}", data)
                return False
            
            if data.get("infrastructure_ready") == True:
                self.log_result("Auto-Rewards Calculate - Infrastructure Ready", True, 
                              "Rewards infrastructure confirmed ready")
            else:
                self.log_result("Auto-Rewards Calculate - Infrastructure Ready", False, 
                              "Rewards infrastructure not ready")
            
            # Verify tier calculation
            tier_info = data.get("new_tier_info", {})
            if "tier_name" in tier_info and "reward" in tier_info:
                self.log_result("Auto-Rewards Calculate - Tier Calculation", True, 
                              f"Tier calculated: {tier_info.get('tier_name')}")
            else:
                self.log_result("Auto-Rewards Calculate - Tier Calculation", False, 
                              "Tier information incomplete")
            
            # Test order creation with auto-rewards
            order_data = {
                "items": [{"product_id": "test", "quantity": 1, "price": 500.0}],
                "subtotal": 500.0,
                "reward_applied": data.get("rewards_auto_applied", 0),
                "total": data.get("final_total", 500.0),
                "payment_method": "mock"
            }
            
            order_response = self.make_request("POST", "/orders", order_data, token=self.test_user_token)
            
            if order_response and order_response.status_code == 200:
                order_data = order_response.json()
                
                # Verify auto-rewards application
                if "rewards_auto_applied" in order_data and order_data.get("rewards_auto_applied") == True:
                    self.log_result("Auto-Rewards Order - Application", True, 
                                  "Auto-rewards applied successfully in order")
                else:
                    self.log_result("Auto-Rewards Order - Application", False, 
                                  "Auto-rewards not applied in order")
                
                # Verify rewards breakdown
                if "rewards_breakdown" in order_data:
                    breakdown = order_data["rewards_breakdown"]
                    required_breakdown_fields = ["rewards_used", "cashback_earned", 
                                               "new_reward_balance", "new_tier"]
                    missing_breakdown = [field for field in required_breakdown_fields if field not in breakdown]
                    
                    if not missing_breakdown:
                        self.log_result("Auto-Rewards Order - Breakdown", True, 
                                      "Complete rewards breakdown provided")
                    else:
                        self.log_result("Auto-Rewards Order - Breakdown", False, 
                                      f"Missing breakdown fields: {missing_breakdown}")
            
            return True
        else:
            error_msg = response.text if response else "Connection failed"
            self.log_result("Auto-Rewards Calculate", False, "Rewards calculation failed", error_msg)
            return False
    
    def test_logout_functionality(self):
        """Test 4: Logout Endpoint Functionality"""
        print("\n🚪 Testing Logout Functionality...")
        
        if not self.test_user_token:
            self.log_result("Logout Test - Token Check", False, "No valid token available for logout test")
            return False
        
        # Test 1: Logout with valid token
        response = self.make_request("POST", "/auth/logout", token=self.test_user_token)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_fields = ["message", "success"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Logout - Response Structure", False, 
                              f"Missing fields: {missing_fields}", data)
                return False
            
            if data.get("success") == True and "Logout successful" in data.get("message", ""):
                self.log_result("Logout - Valid Token", True, 
                              "Logout endpoint working correctly with valid token")
            else:
                self.log_result("Logout - Valid Token", False, 
                              f"Unexpected logout response: {data}")
                return False
        else:
            error_msg = response.text if response else "Connection failed"
            self.log_result("Logout - Valid Token", False, "Logout failed with valid token", error_msg)
            return False
        
        # Test 2: Logout with invalid token
        invalid_response = self.make_request("POST", "/auth/logout", token="invalid_token_12345")
        
        if invalid_response and invalid_response.status_code == 401:
            self.log_result("Logout - Invalid Token", True, 
                          "Correctly rejects invalid token with 401")
        else:
            status_code = invalid_response.status_code if invalid_response else "No response"
            self.log_result("Logout - Invalid Token", False, 
                          f"Expected 401 for invalid token, got {status_code}")
        
        # Test 3: Logout without token
        no_token_response = self.make_request("POST", "/auth/logout")
        
        if no_token_response and no_token_response.status_code == 403:
            self.log_result("Logout - No Token", True, 
                          "Correctly rejects request without token (403)")
        else:
            status_code = no_token_response.status_code if no_token_response else "No response"
            self.log_result("Logout - No Token", False, 
                          f"Expected 403 for no token, got {status_code}")
        
        # Test 4: Verify JWT behavior after logout (tokens remain valid until expiry)
        me_response = self.make_request("GET", "/auth/me", token=self.test_user_token)
        
        if me_response and me_response.status_code == 200:
            self.log_result("Logout - JWT Behavior", True, 
                          "Token still valid after logout (expected JWT behavior)")
        else:
            self.log_result("Logout - JWT Behavior", False, 
                          "Token invalidated after logout (unexpected for JWT)")
        
        return True
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting GrocerEase Backend API Tests")
        print("=" * 50)
        
        # Step 1: Authentication
        if not self.authenticate_admin():
            print("❌ Cannot proceed without admin authentication")
            return False
        
        if not self.create_test_user():
            print("❌ Cannot proceed without test user")
            return False
        
        # Step 2: Seed test data
        product_ids = self.seed_test_products()
        if not product_ids:
            print("⚠️  No products seeded, some tests may fail")
        
        video_id, ingredients = self.seed_test_video(product_ids)
        if not video_id:
            print("⚠️  No video seeded, bulk cart test may fail")
            ingredients = []  # Use empty list if video creation failed
        
        # Step 3: Run feature tests
        print("\n" + "=" * 50)
        print("🧪 Running Feature Tests")
        print("=" * 50)
        
        test1_success = self.test_bulk_cart_addition(ingredients)
        test2_success = self.test_cable_tv_infrastructure()
        test3_success = self.test_auto_rewards_system()
        test4_success = self.test_logout_functionality()
        
        # Step 4: Summary
        print("\n" + "=" * 50)
        print("📊 Test Summary")
        print("=" * 50)
        
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
        
        return failed_tests == 0

def main():
    """Main test execution"""
    tester = GrocerEaseAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()