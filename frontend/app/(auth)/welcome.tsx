import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.content}>
        <Text style={styles.logo}>GrocerEase</Text>
        <Text style={styles.tagline}>India's First Cable TV Powered Grocery Delivery</Text>
        
        <View style={styles.rewardBox}>
          <Text style={styles.rewardText}>Get up to ₹1000 OFF</Text>
          <Text style={styles.rewardSubtext}>on your monthly grocery spends</Text>
        </View>
        
        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📺</Text>
            <Text style={styles.featureText}>Link your Cable TV</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🎬</Text>
            <Text style={styles.featureText}>Watch Cooking Shows</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🛒</Text>
            <Text style={styles.featureText}>Shop with Rewards</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.secondaryButtonText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  rewardBox: {
    backgroundColor: '#FEF3C7',
    padding: 24,
    borderRadius: 16,
    marginBottom: 32,
    width: '100%',
  },
  rewardText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#92400E',
    textAlign: 'center',
  },
  rewardSubtext: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    marginTop: 4,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  feature: {
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  actions: {
    paddingBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#10B981',
    fontSize: 14,
    textAlign: 'center',
  },
});
