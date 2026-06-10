// GrocerEase API Configuration
// Replace PRODUCTION_BACKEND_URL with your deployed backend URL
const PRODUCTION_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://order-management-93.preview.emergentagent.com';
const DEV_BACKEND_URL = process.env.EXPO_PUBLIC_DEV_BACKEND_URL || 'http://localhost:8001';

export const API_BASE_URL = __DEV__ ? DEV_BACKEND_URL : PRODUCTION_BACKEND_URL;

// Razorpay: get keys from https://dashboard.razorpay.com
export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || (__DEV__ 
  ? 'rzp_test_REPLACE_WITH_YOUR_TEST_KEY' 
  : 'rzp_live_REPLACE_WITH_YOUR_LIVE_KEY');

// Google OAuth 2.0 Client IDs
// Configure these in your Google Cloud Console: https://console.cloud.google.com/
// Set redirect URIs to include: http://localhost:8081/auth-callback (Web) and grocereasetv://auth-callback (Native)
export const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '517781079379-nkg71u5h723qbeab81005a96l0r2u4tq.apps.googleusercontent.com';
export const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '517781079379-8pll85b985h98b7p5h6j9h5h72j2.apps.googleusercontent.com';
export const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '517781079379-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com';

