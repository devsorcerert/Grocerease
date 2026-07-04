from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Dict
from database import db, get_current_user, clean_mongo_doc
from models import CartItem

router = APIRouter(prefix="/cart", tags=["Cart"])

@router.get("")
async def get_cart(user_id: str = Depends(get_current_user)):
    # Retrieve all flat items from db.cart_items for the user
    items_cursor = db.cart_items.find({"user_id": user_id})
    items = await items_cursor.to_list(1000)
    
    # Map the stored fields to match the expected schema.
    # Fix 16: canonical products only have price_paise / image_url — the raw
    # .get("price") / .get("image") reads used to return None on those, so the
    # cart rendered as "₹0" with no image. clean_mongo_doc synthesises the
    # legacy `price` (rupees) and `image_url` keys the client expects.
    formatted_items = []
    for item in items:
        product = await db.products.find_one({"id": item["product_id"]})
        product_info = {}
        if product:
            product = clean_mongo_doc(product)
            product_info = {
                "name": product.get("name"),
                # Prefer canonical image_url; fall back to legacy 'image' if a
                # very old doc still has it.
                "image": product.get("image_url") or product.get("image"),
                "image_url": product.get("image_url") or product.get("image"),
                "price": product.get("price"),         # rupees (float), synthesised
                "price_paise": product.get("price_paise"),
                "mrp_paise": product.get("mrp_paise"),
                "offer_price": product.get("offer_price"),
                "brand": product.get("brand"),
                "weight": product.get("weight"),
                "unit": product.get("unit"),
            }

        formatted_items.append({
            "product_id": item["product_id"],
            "quantity": item["quantity"],
            **product_info,
        })
        
    return {
        "user_id": user_id,
        "items": formatted_items
    }

@router.post("/add")
async def add_to_cart(item: CartItem, user_id: str = Depends(get_current_user)):
    # Validate product exists
    product = await db.products.find_one({"id": item.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Atomically increment quantity in db.cart_items
    await db.cart_items.update_one(
        {"user_id": user_id, "product_id": item.product_id},
        {
            "$inc": {"quantity": item.quantity},
            "$set": {"updated_at": datetime.utcnow()}
        },
        upsert=True
    )
    
    return await get_cart(user_id)

@router.post("/add-bulk")
async def add_bulk_ingredients_to_cart(ingredients: dict, user_id: str = Depends(get_current_user)):
    """
    Bulk add ingredients from GrocerEase TV videos to cart
    """
    try:
        added_count = 0
        failed_ingredients = []
        
        for ingredient in ingredients.get("ingredient_list", []):
            product_id = ingredient.get("product_id")
            quantity = ingredient.get("quantity", 1)
            
            if not product_id:
                failed_ingredients.append({
                    "name": ingredient.get("name", "Unknown"),
                    "reason": "Product mapping not available - API integration required"
                })
                continue
                
            # Verify product exists
            product = await db.products.find_one({"id": product_id})
            if not product:
                failed_ingredients.append({
                    "name": ingredient.get("name", product_id),
                    "reason": "Product not found in database"
                })
                continue
            
            # Atomically increment quantity
            await db.cart_items.update_one(
                {"user_id": user_id, "product_id": product_id},
                {
                    "$inc": {"quantity": quantity},
                    "$set": {"updated_at": datetime.utcnow()}
                },
                upsert=True
            )
            added_count += 1
            
        cart_data = await get_cart(user_id)
        return {
            "success": True,
            "cart": cart_data,
            "added_count": added_count,
            "failed_ingredients": failed_ingredients,
            "message": f"Successfully added {added_count} ingredients to cart"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add ingredients: {str(e)}")

@router.post("/update")
async def update_cart_item(item: CartItem, user_id: str = Depends(get_current_user)):
    # Validate product exists
    product = await db.products.find_one({"id": item.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if item.quantity <= 0:
        # Atomically delete the item
        await db.cart_items.delete_one({"user_id": user_id, "product_id": item.product_id})
    else:
        # Atomically set the quantity
        await db.cart_items.update_one(
            {"user_id": user_id, "product_id": item.product_id},
            {
                "$set": {
                    "quantity": item.quantity,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
    return await get_cart(user_id)

@router.delete("/clear")
async def clear_cart(user_id: str = Depends(get_current_user)):
    # Atomically delete all user cart items
    await db.cart_items.delete_many({"user_id": user_id})
    return {"success": True}
