import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.text}>
            By accessing and using GrocerEase, you accept and agree to be bound by the terms and provisions of this agreement.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Use of Service</Text>
          <Text style={styles.text}>
            You agree to use our service only for lawful purposes and in accordance with these Terms. You are responsible for maintaining the security of your account.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Orders and Payments</Text>
          <Text style={styles.text}>
            All orders are subject to availability and confirmation. We reserve the right to refuse or cancel any order. Prices are subject to change without notice.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Delivery</Text>
          <Text style={styles.text}>
            We strive to deliver within the estimated time frame. However, delays may occur due to unforeseen circumstances. We are not liable for delivery delays beyond our control.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Returns and Refunds</Text>
          <Text style={styles.text}>
            Products can be returned within 24 hours of delivery if they are damaged or not as described. Refunds will be processed within 5-7 business days.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
          <Text style={styles.text}>
            GrocerEase shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our service.
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