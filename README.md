# GrocerEase

GrocerEase is a quick-commerce grocery delivery application, similar to Blinkit/Zepto, featuring a React Native (Expo) customer app and a FastAPI + MongoDB backend.

## Architecture

- **Backend:** FastAPI, Motor (Async MongoDB), Razorpay integration
- **Mobile App:** React Native with Expo
- **Admin Portal:** React Web
- **Database:** MongoDB

## Getting Started

### Backend Setup

1. **Prerequisites:** Python 3.10+, MongoDB.
2. **Environment Variables:**
   Copy `backend/.env.example` to `backend/.env` and update the required values:
   ```env
   ENV=development
   MONGODB_URL=mongodb://localhost:27017
   DB_NAME=grocerease
   JWT_SECRET_KEY=your-secret-key
   RAZORPAY_KEY_ID=your-razorpay-key
   RAZORPAY_KEY_SECRET=your-razorpay-secret
   # To restrict CORS in production, set ALLOWED_ORIGINS (e.g., https://yourdomain.com)
   ```
3. **Install Dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
4. **Run the Server:**
   ```bash
   uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

### Running Tests

To run the backend integration tests locally, simply execute the scripts at the repository root:
```bash
python backend_test.py
python auth_flow_test.py
python logout_test.py
```
Tests will automatically run via GitHub Actions on every push.

### Mobile App (React Native)

1. Navigate to the `frontend` or mobile app directory.
2. Install dependencies via `npm install` or `yarn install`.
3. Start the Expo development server:
   ```bash
   npx expo start
   ```

## Security Notes

- In a non-development environment (`ENV!=development`), the server will crash if `ALLOWED_ORIGINS` is not set.
- Mock payments (`rzp_mock_`) are completely disabled in non-development environments.
- Auth endpoints are rate-limited.