// constants/api.ts

const DEFAULT_BACKEND_URL = 'https://grocerease-backend.onrender.com';

const rawBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL;

const isValidUrl = (url: string | undefined): boolean =>
  !!url && url.trim() !== '' && !url.includes('REPLACE_') && url !== 'undefined' && url !== 'null'
  && url.trim() !== 'https://api.grocereasetv.com'; // dead domain — real backend is on Render

const DEV_BACKEND_URL = process.env.EXPO_PUBLIC_DEV_BACKEND_URL || 'http://localhost:8001';

export const API_BASE_URL = isValidUrl(rawBackendUrl)
  ? rawBackendUrl!.trim()
  : (__DEV__ ? DEV_BACKEND_URL : DEFAULT_BACKEND_URL);

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
