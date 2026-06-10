// constants/api.ts

// Helper function to ensure environment variables are present
const requireEnvVar = (value: string | undefined, name: string): string => {
  if (!value) {
    console.error(`🚨 CRITICAL ERROR: Missing environment variable: ${name}`);
    // We don't throw an error in production to prevent complete app crashes, 
    // but in development, we want it to be very obvious.
    if (__DEV__) {
       throw new Error(`Missing environment variable: ${name}`);
    }
    return ''; 
  }
  return value;
};

// GrocerEase API Configuration
const PRODUCTION_BACKEND_URL = requireEnvVar(process.env.EXPO_PUBLIC_BACKEND_URL, 'EXPO_PUBLIC_BACKEND_URL');
const DEV_BACKEND_URL = process.env.EXPO_PUBLIC_DEV_BACKEND_URL || 'http://localhost:8001';

export const API_BASE_URL = __DEV__ ? DEV_BACKEND_URL : PRODUCTION_BACKEND_URL;

// Razorpay
export const RAZORPAY_KEY_ID = requireEnvVar(process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID, 'EXPO_PUBLIC_RAZORPAY_KEY_ID');

// Google OAuth 2.0 Client IDs
// These MUST come from your .env file and match your Google Cloud Console exactly.
export const GOOGLE_CLIENT_ID_WEB = requireEnvVar(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB, 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB');
export const GOOGLE_CLIENT_ID_ANDROID = requireEnvVar(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID, 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID');
export const GOOGLE_CLIENT_ID_IOS = requireEnvVar(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS, 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS');
