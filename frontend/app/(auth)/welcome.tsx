import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function WelcomeScreen() {
  const router = useRouter();
  const { socialLogin } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSocialLogin = async (provider: string) => {
    try {
      setLoadingProvider(provider);
      await socialLogin(provider);
      // Navigation handled by AuthContext after successful login
    } catch (error: any) {
      console.error(`${provider} login failed:`, error);
      Alert.alert('Login Failed', `Could not sign in with ${provider}. Please try again.`);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.content}>
        <Image 
          source={{ uri: 'https://customer-assets.emergentagent.com/job_bd1cc3b3-4082-4676-b0be-fae7b3b45faf/artifacts/vp9rk51k_WhatsApp%20Image%202025-09-12%20at%2013.06.44%20%281%29.jpeg' }}
          style={styles.logo}
          resizeMode="contain"
        />
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
        {/* Google Login */}
        <TouchableOpacity 
          style={styles.googleButton}
          onPress={() => handleSocialLogin('google')}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator size="small" color="#111" />
          ) : (
            <>
              <Image 
                source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
                style={styles.providerIcon}
                resizeMode="contain"
              />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Apple Login */}
        <TouchableOpacity 
          style={styles.appleButton}
          onPress={() => handleSocialLogin('apple')}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === 'apple' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={22} color="#fff" />
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Other Email Login */}
        <TouchableOpacity 
          style={styles.emailButton}
          onPress={() => router.push('/(auth)/register')}
          disabled={loadingProvider !== null}
        >
          <Ionicons name="mail-outline" size={22} color="#2D8B47" />
          <Text style={styles.emailButtonText}>Continue with Email</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Sign In link */}
        <TouchableOpacity 
          style={styles.signInLink}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.signInText}>Already have an account? </Text>
          <Text style={styles.signInTextBold}>Sign In</Text>
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
    width: 280,
    height: 180,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  rewardBox: {
    backgroundColor: '#FEF3C7',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    width: '100%',
  },
  rewardText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#92400E',
    textAlign: 'center',
  },
  rewardSubtext: {
    fontSize: 13,
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
    fontSize: 28,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Actions
  actions: {
    paddingBottom: 32,
  },

  // Google Button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    minHeight: 52,
  },
  providerIcon: {
    width: 22,
    height: 22,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },

  // Apple Button
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    minHeight: 52,
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Email Button
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2D8B47',
    marginBottom: 16,
    minHeight: 52,
  },
  emailButtonText: {
    color: '#2D8B47',
    fontSize: 15,
    fontWeight: '600',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
    color: '#9CA3AF',
  },

  // Sign In
  signInLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  signInText: {
    color: '#6B7280',
    fontSize: 14,
  },
  signInTextBold: {
    color: '#FF8C42',
    fontSize: 14,
    fontWeight: '600',
  },
});
