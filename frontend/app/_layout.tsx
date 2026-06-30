import 'react-native-gesture-handler';
import { Stack, ErrorBoundary } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';

export { ErrorBoundary };

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: false,
    tracesSampleRate: 0.1,
    environment: process.env.EXPO_PUBLIC_ENV || 'production',
  });
}

function RootLayout() {
  if (__DEV__) {
    console.log('[BOOT] RootLayout mounting');
  }
  return (
    <AuthProvider>
      <LanguageProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        </Stack>
        <Toast />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
