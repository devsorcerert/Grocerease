import 'react-native-gesture-handler';
import { Stack, ErrorBoundary } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import Toast from 'react-native-toast-message';

export { ErrorBoundary };

export default function RootLayout() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <Toast />
      </LanguageProvider>
    </AuthProvider>
  );
}
