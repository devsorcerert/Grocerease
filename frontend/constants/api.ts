// constants/api.ts

// Helper function to get environment variables with warning and fallback logic
const getEnvVar = (value: string | undefined, name: string, fallback: string): string => {
  if (!value) {
    console.warn(`🚨 WARNING: Missing environment variable: ${name}. Using fallback value.`);
    return fallback;
  }
  return value;
};

// GrocerEase API Configuration
const PRODUCTION_BACKEND_URL = getEnvVar(
  process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL,
  'EXPO_PUBLIC_BACKEND_URL',
  'https://order-management-93.preview.emergentagent.com'
);
const DEV_BACKEND_URL = process.env.EXPO_PUBLIC_DEV_BACKEND_URL || 'http://localhost:8001';

export const API_BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL)
  ? PRODUCTION_BACKEND_URL
  : (__DEV__ ? DEV_BACKEND_URL : PRODUCTION_BACKEND_URL);

// Razorpay
export const RAZORPAY_KEY_ID = getEnvVar(
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
  'EXPO_PUBLIC_RAZORPAY_KEY_ID',
  'rzp_test_T0sGXqleYVJXe7'
);

// Google OAuth 2.0 Client IDs
// IMPORTANT: These must match the Firebase project used in google-services.json
// Firebase Project: grocerease-499205 (Project Number: 418665414188)
// Web client ID (type 3) from google-services.json - used as webClientId in GoogleSignin.configure()
export const GOOGLE_CLIENT_ID_WEB = getEnvVar(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB',
  '418665414188-rl2jg740eersokldgp9ojnr6ue7uvc0r.apps.googleusercontent.com'
);

// Android client ID (type 1) from google-services.json
export const GOOGLE_CLIENT_ID_ANDROID = getEnvVar(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID',
  '418665414188-mdmkg84jnujtmr3nvhkop74ifp78nr9k.apps.googleusercontent.com'
);

export const GOOGLE_CLIENT_ID_IOS = getEnvVar(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS',
  '418665414188-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com'
);

// Admin credentials (used for admin login detection)
export const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL || 'admin@grocereasetv.com';
