import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
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

const EMERGENT_AUTH_URL = 'https://auth.emergentagent.com/';
const EMERGENT_SESSION_URL = 'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data';


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
  const sessionProcessingRef = useRef(false);
  const processedSessionsRef = useRef<Set<string>>(new Set());

  // ============ AUTH INIT CHECK ============
  useEffect(() => {
    initAuth();
  }, []);

  // Mobile deep link listener
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Linking.getInitialURL().then((url) => {
        if (url) {
          const sessionId = extractSessionId(url);
          if (sessionId) processSession(sessionId);
        }
      });

      const subscription = Linking.addEventListener('url', (event) => {
        const sessionId = extractSessionId(event.url);
        if (sessionId) processSession(sessionId);
      });

      return () => subscription.remove();
    }
  }, []);

  const initAuth = async () => {
    try {
      // On web, check for session_id in URL first (Google OAuth callback)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const sessionId = getSessionIdFromUrl();
        if (sessionId) {
          await processSession(sessionId);
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

  const getSessionIdFromUrl = () => {
    if (typeof window === 'undefined') return null;
    
    // Check hash fragment
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const sid = params.get('session_id');
      if (sid) return sid;
    }
    
    // Check query params
    const search = window.location.search;
    if (search) {
      const params = new URLSearchParams(search);
      const sid = params.get('session_id');
      if (sid) return sid;
    }
    
    return null;
  };

  const extractSessionId = (url: string) => {
    try {
      const match = url.match(/session_id=([^&]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // Process session with lock to prevent double calls
  const processSession = async (sessionId: string) => {
    if (processedSessionsRef.current.has(sessionId)) {
      console.log('Session already processed or in progress, skipping:', sessionId);
      return;
    }
    if (sessionProcessingRef.current) {
      console.log('Session already being processed, skipping');
      return;
    }
    
    processedSessionsRef.current.add(sessionId);
    sessionProcessingRef.current = true;
    
    try {
      setLoading(true);
      
      // Exchange session_id for user data via Emergent
      const response = await fetch(EMERGENT_SESSION_URL, {
        method: 'GET',
        headers: { 'X-Session-ID': sessionId },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to validate session (Status ${response.status})`);
      }
      
      const sessionData = await response.json();
      
      if (!sessionData.email) {
        throw new Error('No email found in session data');
      }
      
      // Send to our backend to create/find user
      const backendResponse = await api.post('/auth/social', {
        provider: 'google',
        email: sessionData.email,
        name: sessionData.name,
        photo: sessionData.picture,
        session_token: sessionData.session_token || sessionId,
      });
      
      if (!backendResponse.data || !backendResponse.data.token) {
        throw new Error('Backend failed to return authentication tokens');
      }
      
      const { token, refresh_token, user: userData } = backendResponse.data;
      
      await storage.setItem('token', token);
      await storage.setItem('refresh_token', refresh_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      startTokenRefreshTimer();
      
      console.log('Google auth completed successfully for:', userData.email);
    } catch (error: any) {
      console.error('Session processing failed:', error);
      const errMsg = error?.response?.data?.detail || error?.message || String(error);
      Alert.alert(
        'Login Failed',
        `Google sign-in session processing failed. Details: ${errMsg}`
      );
      // Remove from processed sessions set if it failed, so user can try again
      processedSessionsRef.current.delete(sessionId);
    } finally {
      setLoading(false);
      sessionProcessingRef.current = false;
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

  // ============ SOCIAL LOGIN (Emergent Auth) ============
  const socialLogin = async (provider: string) => {
    try {
      let redirectUrl: string;
      
      if (Platform.OS === 'web') {
        redirectUrl = typeof window !== 'undefined' 
          ? window.location.origin + '/auth-callback' 
          : 'https://localhost:3000/auth-callback';
      } else {
        redirectUrl = Linking.createURL('auth-callback');
      }
      
      const authUrl = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
      
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.location.href = authUrl;
        }
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          const sessionId = extractSessionId(result.url);
          if (sessionId) {
            await processSession(sessionId);
          }
        }
      }
    } catch (error) {
      console.error('Social login failed:', error);
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
