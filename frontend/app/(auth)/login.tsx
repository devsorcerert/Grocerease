import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
  ScrollView, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';

type AuthStep = 'phone' | 'otp' | 'register';

export default function LoginScreen() {
  const { login, sendOtp, verifyOtp, socialLogin } = useAuth();

  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [step, setStep] = useState<AuthStep>('phone');
  
  // Phone fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  // Email fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // State
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendTimer = () => {
    setResendTimer(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { 
          if (timerRef.current) clearInterval(timerRef.current); 
          return 0; 
        }
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
      const res = await sendOtp(`+91${cleaned}`);
      setIsNewUser(res.is_new_user);
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
      const formattedPhone = `+91${phone.replace(/\D/g, '')}`;
      await verifyOtp(formattedPhone, otpCode, isNewUser ? displayName : undefined);
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

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password.trim());
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Login Failed', err?.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await socialLogin('google');
      router.replace('/(tabs)/home');
    } catch (err: any) {
      // socialLogin already shows an Alert for known Google error codes.
      // Only show a fallback alert for unexpected errors that didn't already surface to the user.
      const knownCodes = ['SIGN_IN_CANCELLED', 'IN_PROGRESS', 'PLAY_SERVICES_NOT_AVAILABLE', 'SIGN_IN_REQUIRED'];
      const isKnownGoogleError = err?.code && knownCodes.includes(err.code);
      if (!isKnownGoogleError) {
        Alert.alert(
          'Google Sign-In Failed',
          err?.response?.data?.detail || err?.message || 'Could not sign in with Google. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <Logo size="large" />
          <Text style={styles.tagline}>India&apos;s First Media-Subsidised Grocery App</Text>
        </View>

        {step === 'phone' && (
          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to access media rewards and shop</Text>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, loginMethod === 'phone' && styles.activeTabButton]}
                onPress={() => setLoginMethod('phone')}
              >
                <Ionicons name="call-outline" size={16} color={loginMethod === 'phone' ? '#fff' : '#6B7280'} />
                <Text style={[styles.tabButtonText, loginMethod === 'phone' && styles.activeTabButtonText]}>Phone OTP</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.tabButton, loginMethod === 'email' && styles.activeTabButton]}
                onPress={() => setLoginMethod('email')}
              >
                <Ionicons name="mail-outline" size={16} color={loginMethod === 'email' ? '#fff' : '#6B7280'} />
                <Text style={[styles.tabButtonText, loginMethod === 'email' && styles.activeTabButtonText]}>Email</Text>
              </TouchableOpacity>
            </View>

            {/* Method Inputs */}
            {loginMethod === 'phone' ? (
              <View style={styles.formContainer}>
                <View style={styles.inputLabelContainer}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                </View>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryText}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.disabledBtn]}
                  onPress={handleSendOtp}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send OTP</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <View style={styles.inputLabelContainer}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.inputLabelContainer}>
                  <Text style={styles.inputLabel}>Password</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.disabledBtn]}
                  onPress={handleEmailLogin}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Task 48: Google Sign-In is Android/iOS only for the pilot.
                 Web OAuth (Emergent redirect) is disabled — EMERGENT_AUTH_URL is dead. */}
            {Platform.OS !== 'web' && (
              <>
                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign-In Button */}
                <TouchableOpacity
                  style={[styles.googleBtn, loading && styles.disabledBtn]}
                  onPress={handleGoogleLogin}
                  disabled={loading}
                >
                  <Image
                    source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
                    style={styles.googleIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.googleBtnText}>Sign in with Google</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.signupLink} onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.signupText}>Don&apos;t have an account? <Text style={styles.signupTextBold}>Sign Up</Text></Text>
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
              <View style={styles.formContainer}>
                <View style={styles.inputLabelContainer}>
                  <Text style={styles.inputLabel}>Your Name</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter full name"
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
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
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            </View>
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
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: 40, paddingBottom: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logoText: { fontSize: 32, fontWeight: '800', color: BRAND },
  tagline: { fontSize: 13, color: '#4B5563', marginTop: 6, textAlign: 'center', fontWeight: '500' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  
  // Tab Selector
  tabContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  activeTabButton: { backgroundColor: BRAND, shadowColor: BRAND, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  tabButtonText: { fontSize: 14, fontWeight: '600', color: '#4B5563' },
  activeTabButtonText: { color: '#fff' },

  // Forms
  formContainer: { width: '100%' },
  inputLabelContainer: { alignSelf: 'flex-start', marginBottom: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  phoneRow: { flexDirection: 'row', marginBottom: 20, borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12, overflow: 'hidden', height: 52 },
  countryCode: { backgroundColor: '#F0FDF4', paddingHorizontal: 14, justifyContent: 'center', borderRightWidth: 1.5, borderRightColor: '#D1FAE5' },
  countryText: { fontSize: 16, fontWeight: '600', color: BRAND },
  phoneInput: { flex: 1, fontSize: 16, paddingHorizontal: 14, color: '#111827', fontWeight: '500' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12, paddingHorizontal: 12, marginBottom: 20, height: 52, backgroundColor: '#fff' },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 12, fontWeight: '500' },
  eyeButton: { padding: 8 },
  
  primaryBtn: { backgroundColor: BRAND, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12, minHeight: 50, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  
  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { paddingHorizontal: 16, fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  
  // Google Sign-In
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', minHeight: 50, marginBottom: 20 },
  googleIcon: { width: 20, height: 20 },
  googleBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  
  signupLink: { paddingVertical: 8, alignItems: 'center', marginBottom: 16 },
  signupText: { fontSize: 14, color: '#4B5563' },
  signupTextBold: { color: BRAND, fontWeight: '700' },
  
  disclaimer: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', lineHeight: 16 },
  
  // OTP
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpBox: { width: 44, height: 52, borderWidth: 2, borderColor: '#D1FAE5', borderRadius: 10, textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#111827', backgroundColor: '#F9FAFB' },
  otpBoxFilled: { borderColor: BRAND, backgroundColor: '#F0FDF4' },
  resendText: { textAlign: 'center', color: BRAND, fontWeight: '600', marginBottom: 12, fontSize: 14 },
  resendDisabled: { color: '#9CA3AF' },
  changePhone: { textAlign: 'center', color: '#6B7280', fontSize: 13, fontWeight: '500' },
  });
