from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from typing import Optional
from database import db, verify_admin

router = APIRouter(prefix="/admin/kpis", tags=["KPIs"])

# Sub-function for Operational KPIs
async def get_operational_metrics():
    delivered_orders = await db.orders.find({"status": "delivered"}).to_list(1000)
    
    delivery_times = []
    on_time_count = 0
    fulfilment_times = []
    
    for order in delivered_orders:
        created_at = order.get("created_at")
        delivered_at = None
        packed_at = None
        
        # Check updates timeline
        for update in order.get("tracking_updates", []):
            if update.get("status") == "delivered":
                delivered_at = update.get("timestamp")
            elif update.get("status") in ["packed", "preparing"]:
                packed_at = update.get("timestamp")
                
        if delivered_at and created_at:
            dt = (delivered_at - created_at).total_seconds() / 60.0
            delivery_times.append(dt)
            
            # Check if delivered on or before estimated_delivery
            est = order.get("estimated_delivery")
            if est and delivered_at <= est:
                on_time_count += 1
                
        if packed_at and created_at:
            pt = (packed_at - created_at).total_seconds() / 60.0
            fulfilment_times.append(pt)
            
    total_deliveries = len(delivered_orders)
    avg_delivery_time = sum(delivery_times) / len(delivery_times) if delivery_times else 0.0
    delivery_efficiency = (on_time_count / total_deliveries * 100) if total_deliveries > 0 else 0.0
    fulfilment_speed = sum(fulfilment_times) / len(fulfilment_times) if fulfilment_times else 0.0
    
    # Return operational KPIs
    return {
        "nps": "insufficient data",
        "avgDeliveryTime": round(avg_delivery_time, 2) if avg_delivery_time else "insufficient data",
        "deliveryEfficiency": round(delivery_efficiency, 2) if delivery_efficiency else "insufficient data",
        "orderAccuracyRate": "insufficient data",
        "fulfilmentSpeed": round(fulfilment_speed, 2) if fulfilment_speed else "insufficient data",
        "totalDeliveries": total_deliveries
    }

# Sub-function for Financial KPIs
async def get_financial_metrics():
    # Only calculate revenue for confirmed, paid, or delivered orders
    orders_cursor = db.orders.find({"status": {"$in": ["confirmed", "delivered", "paid", "packed", "out_for_delivery"]}})
    orders = await orders_cursor.to_list(1000)
    
    total_revenue = sum(order.get("total", 0.0) for order in orders)
    total_orders = len(orders)
    aov = total_revenue / total_orders if total_orders > 0 else 0.0
    
    delivered_orders = [o for o in orders if o.get("status") == "delivered"]
    total_deliveries = len(delivered_orders)
    revenue_per_delivery = total_revenue / total_deliveries if total_deliveries > 0 else 0.0
    
    return {
        "totalRevenue": round(total_revenue, 2),
        "aov": round(aov, 2),
        "revenuePerDelivery": round(revenue_per_delivery, 2) if total_deliveries > 0 else "insufficient data",
        "grossMargin": "insufficient data",
        "costPerDelivery": "insufficient data"
    }

# Sub-function for Customer KPIs
async def get_customer_metrics():
    total_users = await db.users.count_documents({})
    
    # Customer retention rate (fraction of users with >1 orders)
    pipeline = [
        {"$group": {"_id": "$user_id", "order_count": {"$sum": 1}}}
    ]
    cursor = db.orders.aggregate(pipeline)
    order_counts = await cursor.to_list(1000)
    
    users_with_multiple_orders = len([u for u in order_counts if u["order_count"] > 1])
    retention_rate = (users_with_multiple_orders / total_users * 100) if total_users > 0 else 0.0
    
    # Calculate Customer Lifetime Value (CLV) = Total revenue / Total users
    orders_cursor = db.orders.find({"status": {"$in": ["confirmed", "delivered", "paid", "packed", "out_for_delivery"]}})
    orders = await orders_cursor.to_list(1000)
    total_revenue = sum(order.get("total", 0.0) for order in orders)
    clv = total_revenue / total_users if total_users > 0 else 0.0
    
    return {
        "customerRetentionRate": round(retention_rate, 2),
        "customerSatisfaction": "insufficient data",
        "cac": "insufficient data",
        "clv": round(clv, 2) if total_users > 0 else "insufficient data"
    }

# Sub-function for Inventory KPIs
async def get_inventory_metrics():
    total_products = await db.products.count_documents({})
    out_of_stock = await db.products.count_documents({"stock": 0})
    
    return {
        "inventoryTurnover": "insufficient data",
        "totalProducts": total_products,
        "outOfStock": out_of_stock
    }

# Sub-function for TV Integration KPIs
async def get_tv_metrics():
    total_orders = await db.orders.count_documents({})
    orders_via_qr = await db.orders.count_documents({"source": "qr_code"})
    tv_users_linked = await db.users.count_documents({"cable_tv_linked": True})
    
    qr_conversion_rate = (orders_via_qr / total_orders * 100) if total_orders > 0 else 0.0
    
    return {
        "ordersViaQR": orders_via_qr,
        "tvUsersLinked": tv_users_linked,
        "qrConversionRate": round(qr_conversion_rate, 2)
    }

# Sub-function for Brand Analytics
async def get_brand_metrics():
    total_users = await db.users.count_documents({})
    
    # Aggregate to find most popular brand
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.brand", "total_quantity": {"$sum": "$items.quantity"}}},
        {"$sort": {"total_quantity": -1}},
        {"$limit": 1}
    ]
    cursor = db.orders.aggregate(pipeline)
    brand_res = await cursor.to_list(1)
    
    top_brand = brand_res[0]["_id"] if brand_res else "N/A"
    total_top_brand_qty = brand_res[0]["total_quantity"] if brand_res else 0
    avg_brand_consumption = total_top_brand_qty / total_users if total_users > 0 else 0.0
    
    return {
        "topBrand": top_brand,
        "avgBrandConsumption": round(avg_brand_consumption, 2),
        "competitivePricingIndex": "insufficient data"
    }

# Subdivided routes called by services/kpi.js
@router.get("/operational")
async def get_kpi_operational(admin=Depends(verify_admin)):
    return await get_operational_metrics()

@router.get("/financial")
async def get_kpi_financial(admin=Depends(verify_admin)):
    return await get_financial_metrics()

@router.get("/customer")
async def get_kpi_customer(admin=Depends(verify_admin)):
    return await get_customer_metrics()

@router.get("/inventory")
async def get_kpi_inventory(admin=Depends(verify_admin)):
    return await get_inventory_metrics()

@router.get("/tv-integration")
async def get_kpi_tv(admin=Depends(verify_admin)):
    return await get_tv_metrics()

@router.get("/brand-analytics")
async def get_kpi_brand(admin=Depends(verify_admin)):
    return await get_brand_metrics()

# Unified endpoint used by Dashboard.js
@router.get("")
async def get_all_kpis(admin=Depends(verify_admin)):
    op = await get_operational_metrics()
    fin = await get_financial_metrics()
    cust = await get_customer_metrics()
    inv = await get_inventory_metrics()
    tv = await get_tv_metrics()
    brand = await get_brand_metrics()
    
    # Merge all dictionaries together
    return {**op, **fin, **cust, **inv, **tv, **brand}
