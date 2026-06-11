import asyncio
import os
import httpx
import time

BASE_URL = "http://127.0.0.1:8000"
# Get a user token. Usually requires login. 
# For testing, we can just hit the endpoints if we have a token, or we might need to modify the script to login first.

async def run_test():
    async with httpx.AsyncClient() as client:
        # 1. Login user to get token
        print("Logging in user...")
        # Assuming there is a user with these credentials
        login_resp = await client.post(f"{BASE_URL}/auth/login", json={
            "email": "testuser@example.com",
            "password": "password123"
        })
        if login_resp.status_code != 200:
            print("Failed to login user. Make sure user exists.")
            return
            
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("User logged in.")
        
        # 2. Add an address (if none)
        print("Fetching addresses...")
        addr_resp = await client.get(f"{BASE_URL}/user/addresses", headers=headers)
        addresses = addr_resp.json()["addresses"]
        if not addresses:
            print("Adding a test address near central store...")
            add_resp = await client.post(f"{BASE_URL}/user/addresses", json={
                "full_address": "Test location",
                "city": "Hyderabad",
                "pincode": "500001",
                "state": "TS",
                "label": "Home",
                "lat": 17.385,
                "lng": 78.486
            }, headers=headers)
            address_id = add_resp.json()["id"]
        else:
            address_id = addresses[0]["id"]
            
        print(f"Using address ID: {address_id}")
            
        # 3. Add item to cart
        print("Adding item to cart...")
        products_resp = await client.get(f"{BASE_URL}/products?limit=1")
        products = products_resp.json()["products"]
        if not products:
            print("No products found in DB.")
            return
            
        product_id = products[0]["id"]
        await client.post(f"{BASE_URL}/cart/add", json={
            "product_id": product_id,
            "quantity": 1
        }, headers=headers)
        
        # 4. Login Rider and set Online
        print("Logging in Rider...")
        rider_resp = await client.post(f"{BASE_URL}/rider/login", json={
            "phone": "9999999999",
            "password": "password123"
        })
        if rider_resp.status_code != 200:
            print("Failed to login rider:", rider_resp.text)
            return
            
        rider_id = rider_resp.json()["rider_id"]
        print(f"Rider logged in. Rider ID: {rider_id}")
        
        # Set Rider Location
        await client.post(f"{BASE_URL}/rider/location", json={
            "rider_id": rider_id,
            "lat": 17.380,
            "lng": 78.480
        })
        print("Rider location updated.")
        
        # 5. Create Order (Checkout)
        print("Checking out order...")
        checkout_resp = await client.post(f"{BASE_URL}/orders/create", json={
            "address_id": address_id,
            "payment_method": "cod"
        }, headers=headers)
        
        if checkout_resp.status_code != 200:
            print("Checkout failed:", checkout_resp.text)
            return
            
        order_id = checkout_resp.json()["order_id"]
        print(f"Order created successfully: {order_id}")
        
        # Give dispatch a moment
        await asyncio.sleep(1)
        
        # 6. Check Rider's Assigned Order
        rider_resp = await client.post(f"{BASE_URL}/rider/login", json={
            "phone": "9999999999",
            "password": "password123"
        })
        current_order = rider_resp.json().get("current_order")
        if current_order and current_order["id"] == order_id:
            print(f"SUCCESS: Order {order_id} assigned to Rider!")
        else:
            print(f"FAIL: Order {order_id} not assigned to Rider.")

if __name__ == "__main__":
    asyncio.run(run_test())
