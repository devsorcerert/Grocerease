import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  photo?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isSigningIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const STORAGE_TOKEN_KEY = '@grocerease_token';
const STORAGE_USER_KEY  = '@grocerease_user';

const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'https://grocerease-backend.onrender.com';

GoogleSignin.configure({
  webClientId: '1033798066161-00g31ael0mipkviip26btj04q6090ksq.apps.googleusercontent.com',
  offlineAccess: true,
  scopes: ['profile', 'email'],
});

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]               = useState<AuthUser | null>(null);
  const [token, setToken]             = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    const rehydrate = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(STORAGE_TOKEN_KEY),
          AsyncStorage.getItem(STORAGE_USER_KEY),
        ]);
        if (storedToken && storedUser) {
          const valid = await validateToken(storedToken);
          if (valid) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } else {
            await clearStorage();
          }
        }
      } catch (e) {
        console.error('[Auth] Rehydration error:', e);
        await clearStorage();
      } finally {
        setIsLoading(false);
      }
    };
    rehydrate();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const { idToken } = userInfo;
      if (!idToken) throw new Error('Google did not return an ID token.');

      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? `Server error ${response.status}`);
      }

      const data = await response.json();
      const { access_token, user: userData } = data;

      await Promise.all([
        AsyncStorage.setItem(STORAGE_TOKEN_KEY, access_token),
        AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData)),
      ]);
      setToken(access_token);
      setUser(userData);

    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        setError(null);
      } else if (e.code === statusCodes.IN_PROGRESS) {
        setError('Sign-in already in progress.');
      } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services not available.');
      } else {
        console.error('[Auth] Sign-in error:', e);
        setError(e.message ?? 'Sign-in failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch (e) {
      console.warn('[Auth] GoogleSignin.signOut warning:', e);
    }
    await clearStorage();
    setUser(null);
    setToken(null);
    setIsLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isSigningIn, signInWithGoogle, signOut, error }}>
      {children}
    </AuthContext.Provider>
  );
};

async function clearStorage() {
  await AsyncStorage.multiRemove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY]);
}

async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
