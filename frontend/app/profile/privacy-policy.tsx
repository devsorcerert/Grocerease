import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.text}>
            We collect information you provide directly to us, including your name, email address, phone number, delivery address, and payment information. We also collect information about your orders and browsing activity.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={styles.text}>
            We use your information to process orders, communicate with you, improve our services, and provide personalized recommendations. We may also use it for marketing purposes with your consent.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Data Security</Text>
          <Text style={styles.text}>
            We implement industry-standard security measures to protect your personal information. All payment data is encrypted and processed through secure payment gateways.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Third-Party Services</Text>
          <Text style={styles.text}>
            We may share your information with trusted third-party service providers who assist us in operating our platform, conducting our business, or serving you.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Your Rights</Text>
          <Text style={styles.text}>
            You have the right to access, correct, or delete your personal information. You can also opt out of marketing communications at any time.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Contact Us</Text>
          <Text style={styles.text}>
            If you have questions about this privacy policy, please contact us at privacy@grocerease.com
          </Text>
        </View>

        <Text style={styles.lastUpdated}>Last updated: June 2025</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 8 },
  text: { fontSize: 14, color: '#374151', lineHeight: 22 },
  lastUpdated: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 32, marginBottom: 40 },
});