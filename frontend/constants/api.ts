// constants/api.ts

// Helper function to get environment variables with warning and fallback logic
const getEnvVar = (value: string | undefined, name: string, fallback: string): string => {
  if (!value || value.trim() === '' || value === 'undefined' || value === 'null' || value.includes('REPLACE_')) {
    console.warn(`🚨 WARNING: Missing or empty environment variable: ${name}. Using fallback value.`);
    return fallback;
  }
  return value.trim();
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

export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';

// Google OAuth 2.0 Client IDs
// IMPORTANT: These must match the Firebase project used in google-services.json
// Firebase Project: grocerease-499205 (Project Number: 418665414188)
// Web client ID (type 3) from google-services.json - used as webClientId in GoogleSignin.configure()
export const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';

// Android client ID (type 1) from google-services.json
export const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '';

export const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';

// Admin credentials (used for admin login detection)
export const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL || 'grocereasetv@gmail.com';
