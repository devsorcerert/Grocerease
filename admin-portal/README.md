# GrocerEase Admin Portal

A comprehensive admin dashboard for managing the GrocerEase grocery delivery application.

## Features

### 1. **Dashboard with Comprehensive KPIs**
- **Operational Metrics**: NPS, Delivery Time, Efficiency, Order Accuracy, Fulfilment Speed, Total Deliveries
- **Financial Metrics**: Total Revenue, AOV, Revenue per Delivery, Gross Margin, Cost per Delivery
- **Customer Metrics**: Retention Rate, Satisfaction, CAC, Customer Lifetime Value
- **Inventory Metrics**: Turnover, Total Products, Out of Stock items
- **TV Integration**: Orders via QR Code, TV Users Linked, QR Conversion Rate
- **Brand Analytics**: Top Brand, Avg Brand Consumption per User, Competitive Pricing Index

### 2. **Product Management**
- View all products in a sortable table
- Add new products individually
- Edit existing products
- Delete products
- **Excel Bulk Import** - Upload products in bulk using Excel files

### 3. **Excel Import Feature**
Upload products in bulk using Excel (.xlsx or .xls) files with the following format:

#### Required Columns:
- **Name**: Product name (required)
- **Category**: Product category (required)
- **Price**: Product price in ₹ (required)

#### Optional Columns:
- **Brand**: Brand name
- **OfferPrice**: Discounted price in ₹
- **Stock**: Available stock quantity
- **Description**: Product description
- **Image**: Image URL

See `sample-products.xlsx.md` for example format.

## Access

### Admin Credentials:
- **Email**: admin@grocereasetv.com
- **Password**: admin123

### URLs:
- **Admin Portal**: http://localhost:3001
- **Backend API**: http://localhost:8001/api

## Tech Stack
- **Frontend**: React 18, React Router v6
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Styling**: Custom CSS with brand colors
- **Excel Processing**: pandas, openpyxl

## Admin API Endpoints

### Authentication:
- `POST /api/admin/login` - Admin login

### KPIs:
- `GET /api/admin/kpis` - Get all KPIs

### Products:
- `GET /api/admin/products` - Get all products
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/{id}` - Update product
- `DELETE /api/admin/products/{id}` - Delete product
- `POST /api/admin/products/upload-excel` - Upload Excel file

### Categories:
- `GET /api/admin/categories` - Get all categories

## Development

### Install Dependencies:
```bash
cd /app/admin-portal
yarn install
```

### Run Development Server:
```bash
yarn start
```

The admin portal will be available at http://localhost:3001

## Color Scheme
- **Primary Green**: #2D8B47 (GrocerEase brand green)
- **Primary Orange**: #FF8C42 (GrocerEase brand orange)
- **Success**: Green shades
- **Warning**: Orange shades
- **Error**: Red shades
- **Info**: Blue shades
- **Purple**: For special metrics

## Notes
- All KPIs are calculated in real-time based on actual data from MongoDB
- Excel import supports both adding new products and updating existing ones (matched by product name)
- Admin token expires after 30 days
- CORS is enabled for all origins during development
