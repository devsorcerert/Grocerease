import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Platform } from 'react-native';

export default function NotFoundScreen() {
  const router = useRouter();
  const { handleSessionId, user } = useAuth();

  useEffect(() => {
    // Check if this is a Google auth redirect with session_id in hash
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      let sessionId: string | null = null;

      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        sessionId = hashParams.get('session_id');
      }
      if (!sessionId && search) {
        const searchParams = new URLSearchParams(search);
        sessionId = searchParams.get('session_id');
      }

      if (sessionId) {
        // This is a Google auth callback - process it
        window.history.replaceState(null, '', '/');
        handleSessionId(sessionId).then(() => {
          router.replace('/(tabs)/home');
        }).catch(() => {
          router.replace('/(auth)/welcome');
        });
        return;
      }
    }

    // For other unmatched routes, redirect to home or welcome
    const timeout = setTimeout(() => {
      if (user) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/welcome');
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2D8B47" />
      <Text style={styles.text}>Redirecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B7280',
  },
});
