import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { useNavigation } from '@react-navigation/native';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cable_tv_linked?: boolean;
  monthly_spend?: number;
  current_reward?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  googleLogin: (idToken: string, name: string, email: string, photo?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper for cross-platform secure storage
const storage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();

  // ============ AUTH INIT CHECK ============
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await storage.getItem('token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await api.get('/auth/me');
        setUser(response.data);
        startTokenRefreshTimer();
      }
    } catch (error) {
      console.log('Auth check failed', error);
      await clearAuth();
    } finally {
      setLoading(false);
    }
  };

  // ============ TOKEN REFRESH LOGIC ============
  const startTokenRefreshTimer = useCallback(() => {
    // Refresh every 14 minutes (assuming 15-min expiry)
    const interval = setInterval(async () => {
      try {
        const refreshToken = await storage.getItem('refresh_token');
        if (!refreshToken) return;

        const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
        const newAccessToken = response.data.token;
        const newRefreshToken = response.data.refresh_token;

        await storage.setItem('token', newAccessToken);
        await storage.setItem('refresh_token', newRefreshToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        console.log('Token refreshed successfully');
      } catch (error) {
        console.log('Token refresh failed:', error);
        await logout(); // force logout on failure
      }
    }, 14 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // ============ LOGIN / REGISTER ============
  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, refresh_token, user } = response.data;

    await storage.setItem('token', token);
    await storage.setItem('refresh_token', refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    startTokenRefreshTimer();
  };

  const register = async (name: string, email: string, password: string, phone?: string) => {
    const response = await api.post('/auth/register', { name, email, password, phone });
    const { token, refresh_token, user } = response.data;

    await storage.setItem('token', token);
    await storage.setItem('refresh_token', refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    startTokenRefreshTimer();
  };

  const googleLogin = async (idToken: string, name: string, email: string, photo?: string) => {
    const response = await api.post('/auth/google', { id_token: idToken, name, email, photo });
    const { token, refresh_token, user } = response.data;

    await storage.setItem('token', token);
    await storage.setItem('refresh_token', refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    startTokenRefreshTimer();
  };

  // ============ LOGOUT ============
  const logout = async () => {
    try {
      console.log('Logout: starting...');

      try {
        await api.post('/auth/logout');
      } catch (err) {
        console.log('Server logout skipped:', err.message);
      }

      await clearAuth();
      console.log('Logout complete');

      if (Platform.OS === 'web') {
        window.location.href = '/';
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }

    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const clearAuth = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refresh_token');
    await SecureStore.deleteItemAsync('token').catch(() => {});
    await SecureStore.deleteItemAsync('refresh_token').catch(() => {});
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // ============ REFRESH USER INFO ============
  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.log('Failed to refresh user', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, googleLogin, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};