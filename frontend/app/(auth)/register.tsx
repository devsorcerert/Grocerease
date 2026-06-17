import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import Logo from '../../components/Logo';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const { register, socialLogin } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password || !phone || !address || !city || !pincode) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password, phone);
      
      await api.post('/auth/update-profile', {
        address,
        city,
        pincode
      });
      
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    try {
      setLoadingProvider(provider);
      await socialLogin(provider);
    } catch (error: any) {
      Alert.alert('Sign Up Failed', `Could not sign up with ${provider}. Please try again.`);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Logo size="medium" />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join GrocerEase today</Text>
        </View>

        {/* Social Login Buttons */}
        <View style={styles.socialSection}>
          <TouchableOpacity 
            style={styles.googleButton}
            onPress={() => handleSocialLogin('google')}
            disabled={loadingProvider !== null || loading}
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

          <TouchableOpacity 
            style={styles.appleButton}
            onPress={() => handleSocialLogin('apple')}
            disabled={loadingProvider !== null || loading}
          >
            {loadingProvider === 'apple' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign up with email</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Enter your name" value={name} onChangeText={setName} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Enter your email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="10-digit mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="location-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} 
                placeholder="Enter delivery address" 
                value={address} 
                onChangeText={setAddress}
                multiline
                numberOfLines={2}
              />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
              <Text style={styles.label}>City *</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
              <Text style={styles.label}>Pincode *</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} placeholder="000000" value={pincode} onChangeText={setPincode} keyboardType="number-pad" maxLength={6} />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleRegister} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, padding: 24 },
  backButton: { marginTop: 8, marginBottom: 8, width: 44, height: 44, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 12, marginTop: 4 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#6B7280' },

  // Social
  socialSection: { marginBottom: 16, gap: 10 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minHeight: 50,
  },
  providerIcon: { width: 20, height: 20 },
  googleButtonText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 50,
  },
  appleButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { paddingHorizontal: 12, fontSize: 12, color: '#9CA3AF' },

  // Form
  form: { flex: 1 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#111' },
  eyeButton: { padding: 8 },
  rowInputs: { flexDirection: 'row' },
  button: { backgroundColor: '#2D8B47', paddingVertical: 16, borderRadius: 12, marginTop: 8, minHeight: 52, justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    linkText: { textAlign: 'center', fontSize: 14, color: '#6B7280', marginTop: 12 },
  linkBold: { color: '#2D8B47', fontWeight: '700' },
});
