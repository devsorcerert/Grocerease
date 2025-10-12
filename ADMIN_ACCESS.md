# 🔐 GrocerEase Admin Portal Access

## 🌐 Admin Portal URL

### **Primary Access Method:**

```
http://localhost:3001/admin
```

**Status**: ✅ Running and Ready

---

## 🔑 Admin Credentials

```
Email: admin@grocereasetv.com
Password: admin123
```

---

## 📍 Alternative Access Methods

### Method 1: Direct Port Access (If you have server access)
```
http://localhost:3001/admin
```
- Works if you're SSH'd into the server
- Direct access to admin portal

### Method 2: SSH Port Forwarding (Recommended for Remote Access)
```bash
# On your local machine, run:
ssh -L 3001:localhost:3001 user@grocer-dash.preview.emergentagent.com

# Then open in your browser:
http://localhost:3001/admin
```

### Method 3: Try Public Port (May require configuration)
```
https://grocer-dash.preview.emergentagent.com:3001/admin
```
⚠️ Note: This requires port 3001 to be exposed in Kubernetes ingress

---

## 🎯 What You Can Do in Admin Portal

### 📊 Dashboard
- View 25+ KPIs including:
  - Operational: NPS, Delivery Time, Order Accuracy
  - Financial: Revenue, AOV, Gross Margin
  - Customer: Retention, CAC, Lifetime Value
  - Inventory: Turnover, Stock Levels
  - TV Integration: QR Orders, Linked Users
  - Brand Analytics: Top Brands, Consumption

### 📦 Product Management
- View all products in sortable table
- Add new products individually
- Edit existing products
- Delete products
- Manage categories

### 📊 Excel Bulk Import
- Upload Excel files (.xlsx, .xls)
- Required columns: Name, Category, Price
- Optional: Brand, OfferPrice, Stock, Description, Image
- Bulk add/update thousands of products

---

## 🚀 Quick Start

1. **Access the portal**: http://localhost:3001/admin
2. **Login** with credentials above
3. **Explore Dashboard** - See all KPIs
4. **Manage Products** - Click "Products" in sidebar
5. **Upload Excel** - Click "Upload Excel" button

---

## 📝 Excel Import Format

Create an Excel file with these columns:

| Name | Category | Brand | Price | OfferPrice | Stock | Description | Image |
|------|----------|-------|-------|------------|-------|-------------|-------|
| Basmati Rice 1kg | Grains | India Gate | 120 | 110 | 500 | Premium rice | url |
| Toor Dal 1kg | Pulses | Tata | 150 | 140 | 300 | Quality dal | url |

**Required**: Name, Category, Price
**Optional**: All other columns

---

## 🔧 Admin Portal Status

**Service Status**: ✅ Running
**Port**: 3001
**Access**: Local (Port forwarding needed for remote)

**Backend API**: https://grocer-dash.preview.emergentagent.com/api
**Mobile App**: https://grocer-dash.preview.emergentagent.com

---

## ⚠️ Important Notes

1. **Port 3001 Access**: The admin portal runs on a separate port (3001) from the main app (3000)

2. **Security**: Admin credentials are hardcoded for demo. In production, use proper authentication.

3. **Excel Import**: Can handle 3000+ products in one upload

4. **Real-time KPIs**: All metrics calculate from actual MongoDB data

---

## 🆘 Troubleshooting

### Can't access admin portal?

**Try these steps:**

1. **Check if running**:
   ```bash
   curl http://localhost:3001
   ```
   Should return HTML

2. **Restart admin portal**:
   ```bash
   cd /app/admin-portal
   PORT=3001 yarn start
   ```

3. **Use SSH Port Forwarding** (Most Reliable):
   ```bash
   ssh -L 3001:localhost:3001 user@server-address
   ```
   Then access: http://localhost:3001/admin

4. **Check logs**:
   ```bash
   tail -f /tmp/admin-portal.log
   ```

---

## 📞 Summary

**Admin Portal is READY and RUNNING on port 3001!**

✅ KPI Dashboard with 25+ metrics
✅ Product CRUD operations  
✅ Excel bulk import/update
✅ Category management
✅ Real-time analytics

**Access it now at: http://localhost:3001/admin**
**Login: admin@grocereasetv.com / admin123**
