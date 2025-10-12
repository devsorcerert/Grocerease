import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { useNavigation } from '@react-navigation/native'; // 👈 For native navigation

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

// Unified storage handler
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
      }
    } catch (error) {
      console.log('Auth check failed', error);
      await storage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const token = response.data.token;
    await storage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(response.data.user);
  };

  const register = async (name: string, email: string, password: string, phone?: string) => {
    const response = await api.post('/auth/register', { name, email, password, phone });
    const token = response.data.token;
    await storage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(response.data.user);
  };

  const googleLogin = async (idToken: string, name: string, email: string, photo?: string) => {
    const response = await api.post('/auth/google', { id_token: idToken, name, email, photo });
    const token = response.data.token;
    await storage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(response.data.user);
  };

  const logout = async () => {
    try {
      console.log('Logout: starting...');

      // Attempt server-side logout if supported
      try {
        await api.post('/auth/logout');
      } catch (err) {
        console.log('Server logout skipped or failed:', err.message);
      }

      // Remove token from all storages
      await AsyncStorage.removeItem('token');
      await SecureStore.deleteItemAsync('token').catch(() => {});

      // Remove auth header
      delete api.defaults.headers.common['Authorization'];

      // Clear user state
      setUser(null);

      console.log('Logout: user cleared & token removed');

      // Redirect depending on platform
      if (Platform.OS === 'web') {
        window.location.href = '/';
      } else {
        // Reset navigation to login screen on native
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }

    } catch (error) {
      console.error('Logout error:', error);
    }
  };

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