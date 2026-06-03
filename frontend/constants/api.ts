// GrocerEase API Configuration
// Replace PRODUCTION_BACKEND_URL with your deployed backend URL
const PRODUCTION_BACKEND_URL = 'https://your-backend.onrender.com'; // UPDATE THIS
const DEV_BACKEND_URL = 'http://localhost:8001';

export const API_BASE_URL = __DEV__ ? DEV_BACKEND_URL : PRODUCTION_BACKEND_URL;

// Razorpay: get keys from https://dashboard.razorpay.com
export const RAZORPAY_KEY_ID = __DEV__ 
  ? 'rzp_test_REPLACE_WITH_YOUR_TEST_KEY' 
  : 'rzp_live_REPLACE_WITH_YOUR_LIVE_KEY';
