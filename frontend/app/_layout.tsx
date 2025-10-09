import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import Toast from 'react-native-toast-message';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
      </Stack>
      <Toast />
    </AuthProvider>
  );
}
