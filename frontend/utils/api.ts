import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/api';

// API_BASE_URL from constants/api.ts already reads + validates env vars
// Don't re-read EXPO_PUBLIC_BACKEND_URL here — workflow may bake in a dead domain fallback
const API_URL = API_BASE_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 45000, // 45s — covers Render.com free-tier 30s cold start
  headers: {
    'Content-Type': 'application/json',
  },
});

const getToken = async () => {
  try {
    return await SecureStore.getItemAsync('token');
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      return Promise.reject(error);
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
