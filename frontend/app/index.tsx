import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/welcome');
      }
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoGreen}>Grocer</Text>
        <Text style={styles.logoOrange}>ease</Text>
      </View>
      <ActivityIndicator size="large" color="#2D8B47" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoGreen: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2D8B47',
  },
  logoOrange: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF8C42',
  },
  loader: {
    marginTop: 16,
  },
});
