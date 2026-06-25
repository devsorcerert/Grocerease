import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import uuid
from datetime import datetime

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Sample placeholder image
PLACEHOLDER_IMAGE = "https://placehold.co/400x400/2D8B47/white?text=Product"

async def seed_products():
    # Clear existing products
    await db.products.delete_many({})
    
    products = [
        # Fruits & Vegetables
        {"name": "Fresh Tomato", "category": "Fruits & Vegetables", "subcategory": "Vegetables", "price_paise": 4000, "mrp_paise": 5000, "unit": "1 kg", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Fresh Onion", "category": "Fruits & Vegetables", "subcategory": "Vegetables", "price_paise": 3000, "unit": "1 kg", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Fresh Potato", "category": "Fruits & Vegetables", "subcategory": "Vegetables", "price_paise": 2500, "unit": "1 kg", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Green Capsicum", "category": "Fruits & Vegetables", "subcategory": "Vegetables", "price_paise": 6000, "unit": "500 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Fresh Banana", "category": "Fruits & Vegetables", "subcategory": "Fruits", "price_paise": 5000, "unit": "1 dozen", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Apple Shimla", "category": "Fruits & Vegetables", "subcategory": "Fruits", "price_paise": 18000, "mrp_paise": 20000, "unit": "1 kg", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Fresh Carrot", "category": "Fruits & Vegetables", "subcategory": "Vegetables", "price_paise": 4500, "unit": "500 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Fresh Spinach", "category": "Fruits & Vegetables", "subcategory": "Leafy Vegetables", "price_paise": 2000, "unit": "1 bunch", "image_url": PLACEHOLDER_IMAGE},
        
        # Dairy & Breakfast
        {"name": "Amul Taaza Toned Milk", "category": "Dairy & Breakfast", "subcategory": "Milk", "price_paise": 5400, "unit": "1 L", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Amul Butter", "category": "Dairy & Breakfast", "subcategory": "Butter & Ghee", "price_paise": 5800, "unit": "100 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Britannia Brown Bread", "category": "Dairy & Breakfast", "subcategory": "Bread", "price_paise": 4500, "unit": "400 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Mother Dairy Paneer", "category": "Dairy & Breakfast", "subcategory": "Paneer", "price_paise": 9000, "unit": "200 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Amul Fresh Curd", "category": "Dairy & Breakfast", "subcategory": "Curd", "price_paise": 3000, "unit": "400 g", "image_url": PLACEHOLDER_IMAGE},
        
        # Munchies
        {"name": "Lays Classic Chips", "category": "Munchies", "subcategory": "Chips", "price_paise": 2000, "unit": "52 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Kurkure Masala Munch", "category": "Munchies", "subcategory": "Namkeen", "price_paise": 2000, "unit": "85 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Haldiram Bhujia", "category": "Munchies", "subcategory": "Namkeen", "price_paise": 11000, "unit": "400 g", "image_url": PLACEHOLDER_IMAGE},
        
        # Cold Drinks & Juices
        {"name": "Coca Cola", "category": "Cold Drinks & Juices", "subcategory": "Soft Drinks", "price_paise": 4000, "unit": "750 ml", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Tropicana Orange Juice", "category": "Cold Drinks & Juices", "subcategory": "Juices", "price_paise": 11000, "unit": "1 L", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Real Mixed Fruit Juice", "category": "Cold Drinks & Juices", "subcategory": "Juices", "price_paise": 10000, "unit": "1 L", "image_url": PLACEHOLDER_IMAGE},
        
        # Atta, Rice & Dal
        {"name": "Aashirvaad Atta", "category": "Atta, Rice & Dal", "subcategory": "Atta", "price_paise": 26000, "unit": "5 kg", "image_url": PLACEHOLDER_IMAGE},
        {"name": "India Gate Basmati Rice", "category": "Atta, Rice & Dal", "subcategory": "Rice", "price_paise": 18000, "unit": "1 kg", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Toor Dal", "category": "Atta, Rice & Dal", "subcategory": "Dal", "price_paise": 14000, "unit": "1 kg", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Moong Dal", "category": "Atta, Rice & Dal", "subcategory": "Dal", "price_paise": 12000, "unit": "1 kg", "image_url": PLACEHOLDER_IMAGE},
        
        # Masala & Spices
        {"name": "MDH Chana Masala", "category": "Masala & Spices", "subcategory": "Masala", "price_paise": 10500, "unit": "100 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Everest Turmeric Powder", "category": "Masala & Spices", "subcategory": "Spices", "price_paise": 4500, "unit": "100 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Red Chilli Powder", "category": "Masala & Spices", "subcategory": "Spices", "price_paise": 9000, "unit": "200 g", "image_url": PLACEHOLDER_IMAGE},
        
        # Tea, Coffee & More
        {"name": "Tata Tea Gold", "category": "Tea, Coffee & More", "subcategory": "Tea", "price_paise": 22000, "unit": "500 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Nescafe Classic Coffee", "category": "Tea, Coffee & More", "subcategory": "Coffee", "price_paise": 18000, "unit": "100 g", "image_url": PLACEHOLDER_IMAGE},
        
        # Bakery & Biscuits
        {"name": "Parle-G Biscuits", "category": "Bakery & Biscuits", "subcategory": "Biscuits", "price_paise": 4500, "unit": "376 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Good Day Butter Cookies", "category": "Bakery & Biscuits", "subcategory": "Cookies", "price_paise": 3500, "unit": "200 g", "image_url": PLACEHOLDER_IMAGE},
        {"name": "Sunfeast Marie Light", "category": "Bakery & Biscuits", "subcategory": "Biscuits", "price_paise": 4000, "unit": "250 g", "image_url": PLACEHOLDER_IMAGE},
    ]
    
    for product in products:
        product["id"] = str(uuid.uuid4())
        product["stock"] = 100
        product["description"] = f"Fresh and quality {product['name']}"
        product["created_at"] = datetime.utcnow()
    
    await db.products.insert_many(products)
    print(f"Inserted {len(products)} products")

async def seed_videos():
    # Clear existing videos
    await db.videos.delete_many({})
    
    # Get some product IDs for mapping ingredients
    products_cursor = db.products.find({})
    products = await products_cursor.to_list(length=None)
    
    # Create a mapping for common ingredients
    ingredient_mapping = {}
    for product in products:
        name = product['name'].lower()
        if 'tomato' in name:
            ingredient_mapping['tomato'] = product['id']
        elif 'paneer' in name:
            ingredient_mapping['paneer'] = product['id']
        elif 'butter' in name:
            ingredient_mapping['butter'] = product['id']
        elif 'rice' in name and 'basmati' in name:
            ingredient_mapping['basmati_rice'] = product['id']
        elif 'bread' in name:
            ingredient_mapping['bread'] = product['id']
        elif 'milk' in name and 'toned' in name:
            ingredient_mapping['milk'] = product['id']
    
    videos = [
        {
            "id": str(uuid.uuid4()),
            "title": "Paneer Butter Masala Recipe",
            "description": "Learn to cook delicious Paneer Butter Masala with one-click shopping",
            "thumbnail": PLACEHOLDER_IMAGE,
            "stream_url": None,
            "duration": "15:30",
            "is_live": False,
            "ingredients": [
                {"product_id": ingredient_mapping.get('paneer', ''), "name": "Mother Dairy Paneer", "quantity": 1},
                {"product_id": ingredient_mapping.get('tomato', ''), "name": "Fresh Tomato", "quantity": 1},
                {"product_id": ingredient_mapping.get('butter', ''), "name": "Amul Butter", "quantity": 1},
                {"product_id": "", "name": "Heavy Cream", "quantity": 1},  # Not mapped - for demo
            ],
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Quick Vegetable Biryani",
            "description": "30-minute vegetable biryani recipe - shop ingredients instantly!",
            "thumbnail": PLACEHOLDER_IMAGE,
            "stream_url": None,
            "duration": "25:00",
            "is_live": False,
            "ingredients": [
                {"product_id": ingredient_mapping.get('basmati_rice', ''), "name": "India Gate Basmati Rice", "quantity": 1},
                {"product_id": ingredient_mapping.get('tomato', ''), "name": "Fresh Tomato", "quantity": 1},
                {"product_id": "", "name": "Biryani Masala", "quantity": 1},  # Not mapped - shows API integration needed
                {"product_id": "", "name": "Mixed Vegetables", "quantity": 1},  # Not mapped
            ],
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Live: Morning Breakfast Ideas",
            "description": "Join us live for quick breakfast recipes with instant shopping",
            "thumbnail": PLACEHOLDER_IMAGE,
            "stream_url": None,
            "duration": "LIVE",
            "is_live": True,
            "ingredients": [
                {"product_id": ingredient_mapping.get('bread', ''), "name": "Britannia Brown Bread", "quantity": 1},
                {"product_id": ingredient_mapping.get('butter', ''), "name": "Amul Butter", "quantity": 1},
                {"product_id": ingredient_mapping.get('milk', ''), "name": "Amul Taaza Toned Milk", "quantity": 1},
            ],
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Infrastructure Demo Recipe",
            "description": "Shows mixed mapped/unmapped ingredients for API integration demo",
            "thumbnail": PLACEHOLDER_IMAGE,
            "stream_url": None,
            "duration": "20:00",
            "is_live": False,
            "ingredients": [
                {"product_id": ingredient_mapping.get('tomato', ''), "name": "Fresh Tomato", "quantity": 2},
                {"product_id": "", "name": "Special Spice Mix", "quantity": 1},  # Requires API integration
                {"product_id": ingredient_mapping.get('butter', ''), "name": "Amul Butter", "quantity": 1},
                {"product_id": "", "name": "Exotic Herb", "quantity": 1},  # Requires API integration
            ],
            "created_at": datetime.utcnow()
        }
    ]
    
    await db.videos.insert_many(videos)
    print(f"Inserted {len(videos)} videos with ingredient mapping")

async def seed_admin():
    # Create an admin user if not exists
    from passlib.context import CryptContext
    import secrets
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # Clean up old default admins to ensure no stale credentials remain
    await db.users.delete_many({"is_admin": True})
    
    # Generate secure random password
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&"
    admin_password = "".join(secrets.choice(alphabet) for _ in range(16))
    admin_email = "grocereasetv@gmail.com"
    
    admin_user = {
        "id": str(uuid.uuid4()),
        "name": "Admin",
        "email": admin_email,
        "password": pwd_context.hash(admin_password),
        "phone": "9999999999",
        "cable_tv_linked": False,
        "cable_tv_details": None,
        "monthly_spend": 0.0,
        "total_spend": 0.0,
        "current_reward": 0.0,
        "is_admin": True,
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(admin_user)
    
    # Save to a local gitignored file
    password_file = ROOT_DIR / ".seeded_admin_password.txt"
    try:
        password_file.write_text(f"Admin Email: {admin_email}\nAdmin Password: {admin_password}\n")
        print(f"Seeded admin credentials saved to {password_file}")
    except Exception as e:
        print(f"Warning: Could not write admin credentials to file: {e}")
        
    print(f"Admin user seeded successfully!")
    print(f"EMAIL: {admin_email}")
    print(f"PASSWORD: {admin_password}")

async def main():
    print("Seeding database...")
    await seed_products()
    await seed_videos()
    await seed_admin()
    print("Database seeded successfully!")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())

