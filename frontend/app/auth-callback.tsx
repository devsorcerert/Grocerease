import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Platform } from 'react-native';

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { handleSessionId, user } = useAuth();
  const [status, setStatus] = useState('Completing sign in...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    processCallback();
  }, []);

  useEffect(() => {
    // If user is set after session processing, navigate to home
    if (user) {
      router.replace('/(tabs)/home');
    }
  }, [user]);

  const processCallback = async () => {
    try {
      let sessionId: string | null = null;

      // Try to get session_id from query params
      if (params.session_id) {
        sessionId = params.session_id as string;
      }

      // Try from URL hash (web only)
      if (!sessionId && Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash) {
          const hashParams = new URLSearchParams(hash.substring(1));
          sessionId = hashParams.get('session_id');
        }
        
        if (!sessionId) {
          const search = window.location.search;
          if (search) {
            const searchParams = new URLSearchParams(search);
            sessionId = searchParams.get('session_id');
          }
        }
      }

      if (sessionId) {
        setStatus('Verifying your account...');
        await handleSessionId(sessionId);
        
        // Clean URL on web
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/');
        }
        
        setStatus('Success! Redirecting...');
        // Small delay then redirect
        setTimeout(() => {
          router.replace('/(tabs)/home');
        }, 500);
      } else {
        setError('No session found. Please try signing in again.');
        setTimeout(() => {
          router.replace('/(auth)/welcome');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Auth callback error:', err);
      setError('Sign in failed. Please try again.');
      setTimeout(() => {
        router.replace('/(auth)/welcome');
      }, 2000);
    }
  };

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.redirectText}>Redirecting...</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#2D8B47" />
          <Text style={styles.statusText}>{status}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusText: {
    marginTop: 20,
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 48,
    color: '#EF4444',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
  },
  redirectText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
