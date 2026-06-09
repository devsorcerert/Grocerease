import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/api';

type AuthStep = 'phone' | 'otp' | 'register';

export default function LoginScreen() {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<Array<TextInput | null>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startResendTimer = () => {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/send-otp`, { phone: `+91${cleaned}` });
      setIsNewUser(res.data.is_new_user);
      setStep('otp');
      startResendTimer();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, index: number) => {
    const updated = [...otp];
    updated[index] = val;
    setOtp(updated);
    if (val && index < 5) otpRefs.current[index + 1]?.focus();
    if (!val && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP sent to your phone.');
      return;
    }
    if (isNewUser && !name.trim()) {
      setStep('register');
      return;
    }
    await submitVerification(otpCode, name);
  };

  const submitVerification = async (otpCode: string, displayName: string) => {
    setLoading(true);
    try {
      const payload: any = { phone: `+91${phone.replace(/\D/g, '')}`, otp: otpCode };
      if (isNewUser) payload.name = displayName;
      const res = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, payload);
      await SecureStore.setItemAsync('access_token', res.data.access_token);
      await SecureStore.setItemAsync('refresh_token', res.data.refresh_token);
      await SecureStore.setItemAsync('user', JSON.stringify(res.data.user));
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.response?.data?.detail || 'The OTP you entered is incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setOtp(['', '', '', '', '', '']);
    await handleSendOtp();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>🛒 GrocerEase</Text>
          <Text style={styles.tagline}>India's First Media-Subsidised Grocery App</Text>
        </View>

        {step === 'phone' && (
          <View style={styles.card}>
            <Text style={styles.title}>Login or Sign Up</Text>
            <Text style={styles.subtitle}>Enter your mobile number to continue</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}><Text style={styles.countryText}>+91</Text></View>
              <TextInput
                style={styles.phoneInput}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send OTP</Text>}
            </TouchableOpacity>
            <Text style={styles.disclaimer}>
              By continuing, you agree to our Terms & Privacy Policy
            </Text>
          </View>
        )}

        {step === 'otp' && (
          <View style={styles.card}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>Sent to +91 {phone}</Text>
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  style={[styles.otpBox, digit && styles.otpBoxFilled]}
                  maxLength={1}
                  keyboardType="number-pad"
                  value={digit}
                  onChangeText={val => handleOtpChange(val, i)}
                  selectTextOnFocus
                />
              ))}
            </View>
            {isNewUser && (
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                value={name}
                onChangeText={setName}
                placeholderTextColor="#9CA3AF"
              />
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify & Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
              <Text style={[styles.resendText, resendTimer > 0 && styles.resendDisabled]}>
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); }}>
              <Text style={styles.changePhone}>← Change number</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'register' && (
          <View style={styles.card}>
            <Text style={styles.title}>Almost there!</Text>
            <Text style={styles.subtitle}>Tell us your name to complete signup</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={() => submitVerification(otp.join(''), name)}
              disabled={loading || !name.trim()}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const BRAND = '#2D8B47';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoText: { fontSize: 28, fontWeight: '800', color: BRAND },
  tagline: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  phoneRow: { flexDirection: 'row', marginBottom: 20, borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12, overflow: 'hidden' },
  countryCode: { backgroundColor: '#F0FDF4', paddingHorizontal: 14, justifyContent: 'center', borderRightWidth: 1.5, borderRightColor: '#D1FAE5' },
  countryText: { fontSize: 16, fontWeight: '600', color: BRAND },
  phoneInput: { flex: 1, fontSize: 16, paddingHorizontal: 14, paddingVertical: 14, color: '#111827' },
  input: { borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 20, color: '#111827' },
  primaryBtn: { backgroundColor: BRAND, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disclaimer: { textAlign: 'center', fontSize: 12, color: '#9CA3AF' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpBox: { width: 46, height: 56, borderWidth: 2, borderColor: '#D1FAE5', borderRadius: 10, textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#111827' },
  otpBoxFilled: { borderColor: BRAND, backgroundColor: '#F0FDF4' },
  resendText: { textAlign: 'center', color: BRAND, fontWeight: '600', marginBottom: 12, fontSize: 14 },
  resendDisabled: { color: '#9CA3AF' },
  changePhone: { textAlign: 'center', color: '#6B7280', fontSize: 13 },
});
