import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // AuthContext handles session_id extraction and processing automatically.
    // This page just waits for the result and navigates accordingly.
    if (!loading) {
      if (user) {
        router.replace('/(tabs)/home');
      } else {
        // Auth failed or no session - go back to welcome
        const timer = setTimeout(() => {
          router.replace('/(auth)/welcome');
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2D8B47" />
      <Text style={styles.text}>Signing you in...</Text>
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
    marginTop: 20,
    fontSize: 16,
    color: '#374151',
  },
});
