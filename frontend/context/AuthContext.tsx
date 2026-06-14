import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Alert, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GOOGLE_CLIENT_ID_WEB } from '../constants/api';
// Configure Google Sign-In on Native
let googleSigninConfigured = false;

const ensureGoogleSigninConfigured = () => {
  if (Platform.OS === 'web') return;
  if (googleSigninConfigured) return;

  if (!GOOGLE_CLIENT_ID_WEB || !GOOGLE_CLIENT_ID_WEB.trim()) {
    throw new Error('Google Sign-In is not configured: missing EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB.');
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_CLIENT_ID_WEB.trim(),
    offlineAccess: true,
    scopes: ['profile', 'email'],
  });

  googleSigninConfigured = true;
};

// Helper to gate console.log behind __DEV__
const log = (...args: any[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};
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

const EMERGENT_AUTH_URL = process.env.EXPO_PUBLIC_EMERGENT_AUTH_URL || '';
const EMERGENT_SESSION_URL = process.env.EXPO_PUBLIC_EMERGENT_SESSION_URL || '';


// Helper for cross-platform secure storage
const storage = {
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.warn('storage.setItem error:', error);
    }
  },
  getItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(key);
      } else {
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.warn('storage.getItem error:', error);
      return null;
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.warn('storage.removeItem error:', error);
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
  const refreshTimerRef = useRef<any>(null);

  // Cleanup refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  // ============ AUTH INIT CHECK ============
  useEffect(() => {
    log('[BOOT] AuthProvider mounting, calling initAuth');
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
    log('[BOOT] initAuth started');
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
      log('Auth init error:', error);
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
      log('Session already processed or in progress, skipping:', sessionId);
      return;
    }
    if (sessionProcessingRef.current) {
      log('Session already being processed, skipping');
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
      
      log('Google auth completed successfully for:', userData.email);
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
      log('Auth check failed', error);
      await clearAuth();
    } finally {
      setLoading(false);
    }
  };

  // ============ TOKEN REFRESH LOGIC ============
  const startTokenRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
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
        log('Token refresh failed, forcing logout:', error);
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
        await logout();
      }
    }, 14 * 60 * 1000);

    refreshTimerRef.current = interval;
  }, []);

  // ============ LOGIN / REGISTER ============
  const login = async (email: string, password: string) => {
      // Detect admin login by checking the ADMIN_EMAIL env variable
    const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL || 'admin@grocereasetv.com';
    const isAdmin = email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
    const endpoint = isAdmin ? '/admin/login' : '/auth/login';
    const response = await api.post(endpoint, { email, password });
        const { token, refresh_token, user: userData } = response.data;
    // For admin login, backend only returns token; construct a minimal admin user object
    const user = userData || { id: 'admin', name: 'Admin', email: email, is_admin: true };

    await storage.setItem('token', token);
    await storage.setItem('refresh_token', refresh_token || '');
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

  // ============ SOCIAL LOGIN (Google Sign-In & Emergent Auth) ============
  const socialLogin = async (provider: string) => {
    if (provider !== 'google') {
      throw new Error(`Social login provider ${provider} not supported`);
    }

    try {
      setLoading(true);
      
      if (Platform.OS === 'web') {
        // Fallback to Web Browser / redirect-based social login on Web
        let redirectUrl = typeof window !== 'undefined' 
          ? window.location.origin + '/auth-callback' 
          : 'https://localhost:3000/auth-callback';
          
        const authUrl = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
        
        if (typeof window !== 'undefined') {
          window.location.href = authUrl;
        }
        return;
      }

      // Native Direct Google Sign-In Flow
      ensureGoogleSigninConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult: any = await GoogleSignin.signIn();
      
      let idToken: string | null = null;
      let userProfile: any = null;
      
      if (signInResult && signInResult.type === 'success') {
        idToken = signInResult.data?.idToken;
        userProfile = signInResult.data?.user;
      } else {
        idToken = signInResult?.idToken;
        userProfile = signInResult?.user;
      }

      if (!idToken) {
        throw new Error('Google Sign-In did not return an ID token.');
      }

      log('Obtained Google ID Token, exchanging with backend...');

      // Call our backend /auth/google endpoint to exchange ID token
      const response = await api.post('/auth/google', {
        id_token: idToken,
        name: userProfile?.name || 'Google User',
        email: userProfile?.email || '',
        photo: userProfile?.photo || null,
      });

      if (!response.data || !response.data.token) {
        throw new Error('Backend failed to return authentication tokens');
      }

      const { token, refresh_token, user: userData } = response.data;

      await storage.setItem('token', token);
      await storage.setItem('refresh_token', refresh_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      startTokenRefreshTimer();

      log('Google Sign-In completed successfully for native client:', userData.email);

    } catch (error: any) {
      console.error('Google Sign-In failed:', error);
      
      let errorMessage = 'Google Sign-In failed. Please try again.';
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign-in cancelled.';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign-in already in progress.';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play Services not available or outdated.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Google Sign-In Error', errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ============ LOGOUT ============
  const logout = async () => {
    try {
      try {
        const refreshToken = await storage.getItem('refresh_token');
        await api.post('/auth/logout', { refresh_token: refreshToken });
      } catch (err: any) {
        log('Server logout skipped:', err.message);
      }
      
      // Sign out from Google if on Native
      if (Platform.OS !== 'web') {
        try {
          await GoogleSignin.signOut();
        } catch (googleErr) {
          log('Google Sign-Out error:', googleErr);
        }
      }
      
      await clearAuth();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const clearAuth = async () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
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
      log('Failed to refresh user', error);
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
