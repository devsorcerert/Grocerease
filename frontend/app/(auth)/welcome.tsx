import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import Logo from '../../components/Logo';

type AuthStep = 'options' | 'phone' | 'otp';

export default function WelcomeScreen() {
  const router = useRouter();
  const { socialLogin, sendOtp, verifyOtp } = useAuth();
  const { language, changeLanguage, t } = useTranslation();

  const [step, setStep] = useState<AuthStep>('options');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
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
      setResendTimer((prev) => {
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
      Alert.alert('Error', t('phoneValidationErr'));
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = `+91${cleaned}`;
      const res = await sendOtp(formattedPhone);
      setIsNewUser(res.is_new_user);
      setStep('otp');
      startResendTimer();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, index: number) => {
    const updated = [...otp];
    updated[index] = val;
    setOtp(updated);
    if (val && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (!val && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Error', t('otpValidationErr'));
      return;
    }
    if (isNewUser && !name.trim()) {
      Alert.alert('Error', t('nameValidationErr'));
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = `+91${phone.replace(/\D/g, '')}`;
      await verifyOtp(formattedPhone, otpCode, isNewUser ? name : undefined);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Incorrect OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setOtp(['', '', '', '', '', '']);
    await handleSendOtp();
  };

  const handleSocialLogin = async (provider: string) => {
    try {
      setLoading(true);
      await socialLogin(provider);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error(`${provider} login failed:`, error);
      Alert.alert('Login Failed', `Could not sign in with ${provider}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Language Switcher header */}
        <View style={styles.languageHeader}>
          <TouchableOpacity
            style={[styles.langPill, language === 'en' && styles.activeLangPill]}
            onPress={() => changeLanguage('en')}
          >
            <Text style={[styles.langText, language === 'en' && styles.activeLangText]}>EN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langPill, language === 'hi' && styles.activeLangPill]}
            onPress={() => changeLanguage('hi')}
          >
            <Text style={[styles.langText, language === 'hi' && styles.activeLangText]}>à¤¹à¤¿à¤à¤¦à¥</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langPill, language === 'te' && styles.activeLangPill]}
            onPress={() => changeLanguage('te')}
          >
            <Text style={[styles.langText, language === 'te' && styles.activeLangText]}>à°¤à±à°²à±à°à±</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logoContainer}>
          <Logo size="large" showText={true} />
          <Text style={styles.tagline}>{t('welcomeTagline')}</Text>
        </View>

        {/* Promo Reward Banner */}
        <View style={styles.rewardBox}>
          <Text style={styles.rewardText}>{t('getDiscount')}</Text>
          <Text style={styles.rewardSubtext}>{t('onMonthlySpends')}</Text>
        </View>

        {/* Main Content Area / Auth Cards */}
        <View style={styles.authContainer}>
          {step === 'options' && (
            <View style={styles.optionsWrapper}>
              {/* Features List */}
              <View style={styles.features}>
                <View style={styles.feature}>
                  <Text style={styles.featureIcon}>ðº</Text>
                  <Text style={styles.featureText}>{t('featureLinkCable')}</Text>
                </View>
                <View style={styles.feature}>
                  <Text style={styles.featureIcon}>ð¬</Text>
                  <Text style={styles.featureText}>{t('featureWatchShows')}</Text>
                </View>
                <View style={styles.feature}>
                  <Text style={styles.featureIcon}>ð</Text>
                  <Text style={styles.featureText}>{t('featureShopRewards')}</Text>
                </View>
              </View>

              {/* Main Phone Login Toggle */}
              <TouchableOpacity
                style={styles.phoneButton}
                onPress={() => setStep('phone')}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.phoneButtonText}>{t('loginWithPhone')}</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('or')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Alternative Social Logins */}
              <View style={styles.socialRow}>
                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={() => handleSocialLogin('google')}
                >
                  <Image
                    source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
                    style={styles.socialIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.socialBtnText}>Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={() => handleSocialLogin('apple')}
                >
                  <Ionicons name="logo-apple" size={20} color="#000" />
                  <Text style={styles.socialBtnText}>Apple</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.emailOutlineButton}
                onPress={() => router.push('/(auth)/register')}
              >
                <Ionicons name="mail" size={18} color="#2D8B47" />
                <Text style={styles.emailOutlineText}>{t('continueEmail')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signInLink}
                onPress={() => router.push('/(auth)/login')}
              >
                <Text style={styles.signInText}>{t('alreadyAccount')}</Text>
                <Text style={styles.signInTextBold}>{t('signIn')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'phone' && (
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <TouchableOpacity onPress={() => setStep('options')} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={22} color="#4B5563" />
                </TouchableOpacity>
                <Text style={styles.formTitle}>{t('loginWithPhone')}</Text>
              </View>

              <Text style={styles.formSubtitle}>{t('enterPhoneNumber')}</Text>

              <View style={styles.phoneInputContainer}>
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="10-digit number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.actionButton, loading && styles.disabledButton]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>{t('sendOtp')}</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                By continuing, you agree to our Terms & Privacy Policy
              </Text>
            </View>
          )}

          {step === 'otp' && (
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <TouchableOpacity onPress={() => setStep('phone')} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={22} color="#4B5563" />
                </TouchableOpacity>
                <Text style={styles.formTitle}>{isNewUser ? t('registerName') : t('verifyLogin')}</Text>
              </View>

              <Text style={styles.formSubtitle}>
                {t('enterOtpCode')} sent to +91 {phone}
              </Text>

              {/* Name Input if New User */}
              {isNewUser && (
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.nameInput}
                    placeholder={t('enterName')}
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              {/* OTP Grid */}
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    style={[styles.otpBox, digit && styles.otpBoxFilled]}
                    maxLength={1}
                    keyboardType="number-pad"
                    value={digit}
                    onChangeText={(val) => handleOtpChange(val, i)}
                    placeholder="-"
                    placeholderTextColor="#D1D5DB"
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.actionButton, loading && styles.disabledButton]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {isNewUser ? t('registerName') : t('verifyLogin')}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Resend Timer */}
              <View style={styles.resendContainer}>
                {resendTimer > 0 ? (
                  <Text style={styles.resendTimerText}>
                    {t('resendOtp')} in {resendTimer}s
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendLinkText}>{t('resendOtp')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFDFB',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  languageHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 16,
  },
  langPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeLangPill: {
    backgroundColor: '#2D8B47',
    borderColor: '#2D8B47',
  },
  langText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  activeLangText: {
    color: '#fff',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 120,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  rewardBox: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#FEF3C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  rewardText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#92400E',
  },
  rewardSubtext: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  optionsWrapper: {
    width: '100%',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
    textAlign: 'center',
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2D8B47',
    paddingVertical: 15,
    borderRadius: 12,
    shadowColor: '#2D8B47',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 52,
  },
  phoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#9CA3AF',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 48,
  },
  socialIcon: {
    width: 18,
    height: 18,
  },
  socialBtnText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  emailOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D8B47',
    minHeight: 48,
    marginBottom: 20,
  },
  emailOutlineText: {
    color: '#2D8B47',
    fontSize: 14,
    fontWeight: '600',
  },
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

  // Form Cards for inputs
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    marginBottom: 20,
    height: 52,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
    paddingRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  otpBox: {
    width: 44,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  otpBoxFilled: {
    borderColor: '#2D8B47',
    backgroundColor: '#EFF6FF',
  },
  actionButton: {
    backgroundColor: '#2D8B47',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D8B47',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 48,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendTimerText: {
    fontSize: 13,
    color: '#6B7280',
  },
  resendLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8C42',
  },
});
