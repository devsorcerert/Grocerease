import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const LoginScreen = () => {
  const { signInWithGoogle, isSigningIn, error } = useAuth();

  useEffect(() => {
    if (error) Alert.alert('Sign-in failed', error, [{ text: 'OK' }]);
  }, [error]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.logo}>LOOP</Text>
          <Text style={styles.tagline}>Groceries. Delivered fast.</Text>
        </View>
        <View style={styles.auth}>
          <TouchableOpacity
            style={[styles.btn, isSigningIn && styles.btnDisabled]}
            onPress={signInWithGoogle}
            disabled={isSigningIn}
            activeOpacity={0.85}
          >
            {isSigningIn
              ? <ActivityIndicator size="small" color="#444" />
              : (
                <>
                  <Text style={styles.gIcon}>G</Text>
                  <Text style={styles.btnText}>Continue with Google</Text>
                </>
              )
            }
          </TouchableOpacity>
          <Text style={styles.terms}>
            By continuing you agree to our{' '}
            <Text style={styles.link}>Terms</Text> &{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#fff' },
  container:   { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between', paddingBottom: 48, paddingTop: 80 },
  brand:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo:        { fontSize: 56, fontWeight: '700', color: '#1D9E75', letterSpacing: 6 },
  tagline:     { fontSize: 16, color: '#666', marginTop: 8 },
  auth:        { gap: 20 },
  btn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#DADCE0', borderRadius: 12, paddingVertical: 14, gap: 12, elevation: 2 },
  btnDisabled: { opacity: 0.6 },
  gIcon:       { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  btnText:     { fontSize: 16, fontWeight: '600', color: '#3C4043' },
  terms:       { fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 18 },
  link:        { color: '#1D9E75', fontWeight: '600' },
});
