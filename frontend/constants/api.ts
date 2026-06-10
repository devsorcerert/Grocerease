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
  'rzp_test_REPLACE_WITH_YOUR_TEST_KEY'
);

// Google OAuth 2.0 Client IDs
// These MUST come from your .env file and match your Google Cloud Console exactly.
export const GOOGLE_CLIENT_ID_WEB = getEnvVar(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB',
  '517781079379-nkg71u5h723qbeab81005a96l0r2u4tq.apps.googleusercontent.com'
);
export const GOOGLE_CLIENT_ID_ANDROID = getEnvVar(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID',
  '517781079379-8pll85b985h98b7p5h6j9h5h72j2.apps.googleusercontent.com'
);
export const GOOGLE_CLIENT_ID_IOS = getEnvVar(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS',
  '517781079379-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com'
);
