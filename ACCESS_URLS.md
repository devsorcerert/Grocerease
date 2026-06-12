# 🔗 GrocerEase - Complete Access URLs

## ✅ VERIFIED WORKING URLS

### 📱 1. Mobile App (Expo)
**Main App URL:**
```
https://order-management-93.preview.emergentagent.com
```
- **Status**: ✅ Working
- **Port**: 3000
- **Access**: Open in browser or scan QR code with Expo Go app

---

### ⚙️ 2. Backend API
**API Base URL:**
```
https://order-management-93.preview.emergentagent.com/api
```
- **Status**: ✅ Working  
- **Port**: 8001 (proxied through main domain)
- **Example Endpoints**:
  - `GET /api/categories` - Get all categories
  - `GET /api/products` - Get all products
  - `POST /api/auth/login` - User login
  - `POST /api/auth/update-profile` - Update profile (**NOW FIXED - saves all fields**)

**Test Backend API:**
```bash
curl https://order-management-93.preview.emergentagent.com/api/categories
```

---

### 🔧 3. Admin Portal

**⚠️ IMPORTANT: Admin Portal Access Methods**

The admin portal runs on a separate port (3001) and can be accessed in two ways:

#### Option A: Direct Port Access (Recommended for Local/SSH Access)
```
http://localhost:3001/admin
```
- **When to use**: If you have SSH/terminal access to the server
- **Status**: ✅ Working on server
- **Login**: admin@grocereasetv.com / admin123

#### Option B: Public URL with Port (May require firewall rules)
```
https://order-management-93.preview.emergentagent.com:3001/admin
```
- **When to use**: For remote access
- **Note**: Requires port 3001 to be exposed in Kubernetes ingress
- **Status**: ⚠️ May need ingress configuration

#### Option C: SSH Port Forwarding (Most Reliable)
If you can't access port 3001 directly, use SSH port forwarding:

```bash
# On your local machine:
ssh -L 3001:localhost:3001 user@grocer-dash.preview.emergentagent.com

# Then open in browser:
http://localhost:3001/admin
```

---

## 🔐 Admin Portal Credentials

```
Email: admin@grocereasetv.com
Password: admin123
```

---

## 🐛 Profile Update Issue - **FIXED** ✅

**Issue**: Profile changes were not saving
**Root Cause**: Backend only accepted address, city, pincode but frontend sent all fields
**Fix Applied**: Backend now accepts and saves all profile fields:
- ✅ Name
- ✅ Email  
- ✅ Phone
- ✅ Address
- ✅ City
- ✅ Pincode

**Status**: Profile updates now work correctly!

---

## 📊 Quick Test Commands

### Test Backend API:
```bash
curl https://order-management-93.preview.emergentagent.com/api/categories
```

### Test Admin Login:
```bash
curl -X POST http://localhost:8001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grocereasetv.com","password":"admin123"}'
```

### Test Profile Update (with token):
```bash
# Replace YOUR_TOKEN with actual JWT token
curl -X POST https://order-management-93.preview.emergentagent.com/api/auth/update-profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"John Doe","email":"john@example.com","phone":"1234567890","address":"123 Main St","city":"Mumbai","pincode":"400001"}'
```

---

## 🎯 Service Status Summary

| Service | URL | Port | Status |
|---------|-----|------|--------|
| **Mobile App** | https://order-management-93.preview.emergentagent.com | 3000 | ✅ Working |
| **Backend API** | https://order-management-93.preview.emergentagent.com/api | 8001 | ✅ Working |
| **Admin Portal** | http://localhost:3001/admin | 3001 | ✅ Working (local) |

---

## 📝 Notes

1. **Admin Portal**: Currently accessible via localhost:3001. For public access, Kubernetes ingress needs to route port 3001 or use SSH tunneling.

2. **Profile Updates**: Now fully functional - all fields (name, email, phone, address, city, pincode) are saved correctly.

3. **Backend API**: Fully accessible via the main domain with `/api` prefix.

4. **Excel Import**: Available in admin portal at http://localhost:3001/admin (click Products → Upload Excel)

---

## 🚀 Next Steps for Full Public Admin Access

To make admin portal publicly accessible without port numbers:

1. **Option 1**: Configure Kubernetes ingress to route `/admin-portal` → `localhost:3001`
2. **Option 2**: Use SSH port forwarding (shown above)
3. **Option 3**: Deploy admin portal build to a subdomain

Currently, **Option 2 (SSH tunneling)** is the most reliable for immediate access.
