import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';

// Use environment variable or fallback to API_BASE_URL constant
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || API_BASE_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Storage helper - uses SecureStore on native, AsyncStorage on web
const getToken = async () => {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem('token');
    } else {
      return await SecureStore.getItemAsync('token');
    }
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
