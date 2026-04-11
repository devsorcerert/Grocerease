#!/usr/bin/env python3
"""
Backend API Testing Script for GrocerEase Admin Portal
Tests admin authentication, KPI dashboard, and product management endpoints
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://order-management-93.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@grocereasetv.com"
ADMIN_PASSWORD = "admin123"

class AdminAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        print()

    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        try:
            response = requests.post(
                f"{self.base_url}/admin/login",
                json={
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data:
                    self.admin_token = data["token"]
                    self.log_test("Admin Login Success", True, f"Token received: {data['token'][:20]}...")
                    return True
                else:
                    self.log_test("Admin Login Success", False, "No token in response")
                    return False
            else:
                self.log_test("Admin Login Success", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login Success", False, f"Exception: {str(e)}")
            return False

    def test_admin_login_failure(self):
        """Test admin login with wrong credentials"""
        try:
            response = requests.post(
                f"{self.base_url}/admin/login",
                json={
                    "email": ADMIN_EMAIL,
                    "password": "wrongpassword"
                },
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_test("Admin Login Failure (Wrong Password)", True, "Correctly returned 401 for wrong password")
                return True
            else:
                self.log_test("Admin Login Failure (Wrong Password)", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login Failure (Wrong Password)", False, f"Exception: {str(e)}")
            return False

    def test_kpis_with_token(self):
        """Test KPI dashboard with valid admin token"""
        if not self.admin_token:
            self.log_test("KPI Dashboard with Token", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{self.base_url}/admin/kpis",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for required KPI fields
                required_kpis = [
                    "nps", "avgDeliveryTime", "deliveryEfficiency", "orderAccuracyRate", 
                    "fulfilmentSpeed", "totalDeliveries", "totalRevenue", "aov", 
                    "revenuePerDelivery", "grossMargin", "costPerDelivery",
                    "customerRetentionRate", "customerSatisfaction", "cac", "clv",
                    "inventoryTurnover", "totalProducts", "outOfStock",
                    "ordersViaQR", "tvUsersLinked", "qrConversionRate",
                    "topBrand", "avgBrandConsumption", "competitivePricingIndex"
                ]
                
                missing_kpis = [kpi for kpi in required_kpis if kpi not in data]
                
                if not missing_kpis:
                    self.log_test("KPI Dashboard with Token", True, f"All {len(required_kpis)} KPIs present")
                    return True
                else:
                    self.log_test("KPI Dashboard with Token", False, f"Missing KPIs: {missing_kpis}")
                    return False
            else:
                self.log_test("KPI Dashboard with Token", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("KPI Dashboard with Token", False, f"Exception: {str(e)}")
            return False

    def test_kpis_without_token(self):
        """Test KPI dashboard without token"""
        try:
            response = requests.get(
                f"{self.base_url}/admin/kpis",
                timeout=10
            )
            
            if response.status_code in [401, 403]:
                self.log_test("KPI Dashboard without Token", True, f"Correctly returned {response.status_code} for missing token")
                return True
            else:
                self.log_test("KPI Dashboard without Token", False, f"Expected 401/403, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("KPI Dashboard without Token", False, f"Exception: {str(e)}")
            return False

    def test_products_get_with_token(self):
        """Test GET products with valid admin token"""
        if not self.admin_token:
            self.log_test("GET Products with Token", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{self.base_url}/admin/products",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "products" in data and "total" in data:
                    self.log_test("GET Products with Token", True, f"Retrieved {data['total']} products")
                    return True
                else:
                    self.log_test("GET Products with Token", False, "Missing 'products' or 'total' in response")
                    return False
            else:
                self.log_test("GET Products with Token", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET Products with Token", False, f"Exception: {str(e)}")
            return False

    def test_products_create_with_token(self):
        """Test POST products with valid admin token"""
        if not self.admin_token:
            self.log_test("POST Products with Token", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            test_product = {
                "name": "Test Admin Product",
                "category": "Test Category",
                "brand": "Test Brand",
                "price": 99.99,
                "stock": 50,
                "description": "Test product for admin API testing"
            }
            
            response = requests.post(
                f"{self.base_url}/admin/products",
                headers=headers,
                json=test_product,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["name"] == test_product["name"]:
                    self.log_test("POST Products with Token", True, f"Created product with ID: {data['id']}")
                    return True
                else:
                    self.log_test("POST Products with Token", False, "Product creation response missing ID or name mismatch")
                    return False
            else:
                self.log_test("POST Products with Token", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST Products with Token", False, f"Exception: {str(e)}")
            return False

    def test_categories_with_token(self):
        """Test GET categories with valid admin token"""
        if not self.admin_token:
            self.log_test("GET Categories with Token", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{self.base_url}/admin/categories",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "categories" in data:
                    self.log_test("GET Categories with Token", True, f"Retrieved {len(data['categories'])} categories")
                    return True
                else:
                    self.log_test("GET Categories with Token", False, "Missing 'categories' in response")
                    return False
            else:
                self.log_test("GET Categories with Token", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET Categories with Token", False, f"Exception: {str(e)}")
            return False

    def test_products_without_token(self):
        """Test product endpoints without token"""
        try:
            response = requests.get(
                f"{self.base_url}/admin/products",
                timeout=10
            )
            
            if response.status_code in [401, 403]:
                self.log_test("GET Products without Token", True, f"Correctly returned {response.status_code} for missing token")
                return True
            else:
                self.log_test("GET Products without Token", False, f"Expected 401/403, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("GET Products without Token", False, f"Exception: {str(e)}")
            return False

    def test_invalid_token(self):
        """Test endpoints with invalid token"""
        try:
            headers = {"Authorization": "Bearer invalid_token_12345"}
            response = requests.get(
                f"{self.base_url}/admin/kpis",
                headers=headers,
                timeout=10
            )
            
            if response.status_code in [401, 403]:
                self.log_test("Invalid Token Test", True, f"Correctly returned {response.status_code} for invalid token")
                return True
            else:
                self.log_test("Invalid Token Test", False, f"Expected 401/403, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Invalid Token Test", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all admin API tests"""
        print("=" * 60)
        print("GROCEREASE ADMIN PORTAL API TESTING")
        print("=" * 60)
        print(f"Testing against: {self.base_url}")
        print(f"Admin credentials: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        print()
        
        # Test sequence
        tests = [
            self.test_admin_login_success,
            self.test_admin_login_failure,
            self.test_kpis_with_token,
            self.test_kpis_without_token,
            self.test_products_get_with_token,
            self.test_products_create_with_token,
            self.test_categories_with_token,
            self.test_products_without_token,
            self.test_invalid_token
        ]
        
        for test in tests:
            test()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED! Admin Portal Backend APIs are working correctly.")
        else:
            print(f"\n⚠️  {total - passed} tests failed. Check the details above.")
            
        return passed == total

if __name__ == "__main__":
    tester = AdminAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)