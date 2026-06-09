import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { GOOGLE_CLIENT_ID_WEB, GOOGLE_CLIENT_ID_ANDROID, GOOGLE_CLIENT_ID_IOS } from '../constants/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  cable_tv_linked?: boolean;
  monthly_spend?: number;
  total_spend?: number;
  current_reward?: number;
  auth_provider?: string;
  address?: string;
  city?: string;
  pincode?: string;
  cable_tv_details?: {
    user_id_nuid: string;
    phone: string;
    service_provider: string;
  };
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  googleLogin: (idToken: string, name: string, email: string, photo?: string) => Promise<void>;
  socialLogin: (provider: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  sendOtp: (phone: string) => Promise<{ is_new_user: boolean; message: string }>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<void>;
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

// Helper to extract parameters from redirect URLs
const extractParam = (url: string, paramName: string) => {
  const regex = new RegExp(`[#?&]${paramName}=([^&]+)`);
  const match = url.match(regex);
  return match ? decodeURIComponent(match[1]) : null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ============ AUTH INIT CHECK ============
  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      // On web, check for access_token in URL first (Google OAuth callback)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const accessToken = getAccessTokenFromUrl();
        if (accessToken) {
          // Clear hash/query params from URL bar
          window.history.replaceState({}, document.title, window.location.pathname);
          await processGoogleAccessToken(accessToken);
          return;
        }
      }

      // Normal auth check - look for stored token
      await checkAuth();
    } catch (error) {
      console.log('Auth init error:', error);
      setLoading(false);
    }
  };

  const getAccessTokenFromUrl = () => {
    if (typeof window === 'undefined') return null;
    return extractParam(window.location.href, 'access_token');
  };

  const processGoogleAccessToken = async (accessToken: string) => {
    try {
      setLoading(true);
      
      // Fetch user profile from Google info endpoint
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (!userInfoResponse.ok) {
        throw new Error('Failed to validate Google access token');
      }
      
      const userInfo = await userInfoResponse.json();
      
      // Send to our backend to create/find user
      const backendResponse = await api.post('/auth/social', {
        provider: 'google',
        email: userInfo.email,
        name: userInfo.name,
        photo: userInfo.picture,
      });
      
      const { token, refresh_token, user: userData } = backendResponse.data;
      
      await storage.setItem('token', token);
      await storage.setItem('refresh_token', refresh_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      startTokenRefreshTimer();
      
      console.log('Google direct auth completed successfully for:', userData.email);
    } catch (error) {
      console.error('Google token processing failed:', error);
    } finally {
      setLoading(false);
    }
  };

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
      } catch (error) {
        console.log('Token refresh failed:', error);
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

  // ============ SOCIAL LOGIN (Direct Google OAuth) ============
  const socialLogin = async (provider: string) => {
    if (provider !== 'google') {
      console.log(`Unsupported social provider: ${provider}`);
      return;
    }

    try {
      let redirectUrl: string;
      
      if (Platform.OS === 'web') {
        redirectUrl = typeof window !== 'undefined' 
          ? window.location.origin
          : 'http://localhost:8081';
      } else {
        redirectUrl = Linking.createURL('auth-callback');
      }

      // Determine client ID based on platform
      let clientId = GOOGLE_CLIENT_ID_WEB;
      if (Platform.OS === 'android') {
        clientId = GOOGLE_CLIENT_ID_ANDROID;
      } else if (Platform.OS === 'ios') {
        clientId = GOOGLE_CLIENT_ID_IOS;
      }

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent('openid profile email')}`;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.location.href = googleAuthUrl;
        }
      } else {
        const result = await WebBrowser.openAuthSessionAsync(googleAuthUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          const accessToken = extractParam(result.url, 'access_token');
          if (accessToken) {
            await processGoogleAccessToken(accessToken);
          } else {
            throw new Error('Access token not found in Google redirect URL');
          }
        }
      }
    } catch (error) {
      console.error('Direct Google OAuth login failed:', error);
      throw error;
    }
  };

  // ============ LOGOUT ============
  const logout = async () => {
    try {
      try {
        await api.post('/auth/logout');
      } catch (err: any) {
        console.log('Server logout skipped:', err.message);
      }
      await clearAuth();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const clearAuth = async () => {
    await storage.removeItem('token');
    await storage.removeItem('refresh_token');
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

  // ============ OTP AUTHENTICATION ============
  const sendOtp = async (phone: string) => {
    const response = await api.post('/auth/send-otp', { phone });
    return response.data;
  };

  const verifyOtp = async (phone: string, otp: string, name?: string) => {
    const response = await api.post('/auth/verify-otp', { phone, otp, name });
    const { token, refresh_token, user: userData } = response.data;

    await storage.setItem('token', token);
    await storage.setItem('refresh_token', refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    startTokenRefreshTimer();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        googleLogin,
        socialLogin,
        logout,
        refreshUser,
        sendOtp,
        verifyOtp
      }}
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
