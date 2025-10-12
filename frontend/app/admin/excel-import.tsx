import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ExcelImport() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Excel Import</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={48} color="#FF8C42" />
          <Text style={styles.infoTitle}>Excel Import Instructions</Text>
          <Text style={styles.infoText}>
            For mobile app, Excel import is best done via the web admin portal.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Required Format</Text>
          <View style={styles.formatCard}>
            <Text style={styles.formatLabel}>Required Columns:</Text>
            <Text style={styles.formatItem}>• Name (Product name)</Text>
            <Text style={styles.formatItem}>• Category (Product category)</Text>
            <Text style={styles.formatItem}>• Price (Price in ₹)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Optional Columns</Text>
          <View style={styles.formatCard}>
            <Text style={styles.formatItem}>• Brand</Text>
            <Text style={styles.formatItem}>• OfferPrice</Text>
            <Text style={styles.formatItem}>• Stock</Text>
            <Text style={styles.formatItem}>• Description</Text>
            <Text style={styles.formatItem}>• Image (URL)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 Web Admin Access</Text>
          <Text style={styles.description}>
            To upload Excel files with bulk products, please access the web admin portal:
          </Text>
          <View style={styles.urlCard}>
            <Text style={styles.urlText}>http://localhost:3001/admin</Text>
          </View>
          <Text style={styles.credentials}>
            Login: admin@grocereasetv.com{'\n'}
            Password: admin123
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Example Data</Text>
          <View style={styles.exampleCard}>
            <View style={styles.exampleRow}>
              <Text style={styles.exampleHeader}>Name</Text>
              <Text style={styles.exampleHeader}>Category</Text>
              <Text style={styles.exampleHeader}>Price</Text>
            </View>
            <View style={styles.exampleRow}>
              <Text style={styles.exampleCell}>Rice 1kg</Text>
              <Text style={styles.exampleCell}>Grains</Text>
              <Text style={styles.exampleCell}>120</Text>
            </View>
            <View style={styles.exampleRow}>
              <Text style={styles.exampleCell}>Dal 1kg</Text>
              <Text style={styles.exampleCell}>Pulses</Text>
              <Text style={styles.exampleCell}>150</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Tips</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>✓ Can upload 3000+ products at once</Text>
            <Text style={styles.tipText}>✓ Updates existing products if name matches</Text>
            <Text style={styles.tipText}>✓ Validates data before import</Text>
            <Text style={styles.tipText}>✓ Shows detailed success/error report</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  
  content: { flex: 1, padding: 16 },
  
  infoCard: {
    backgroundColor: '#FFF7ED',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  infoTitle: { fontSize: 20, fontWeight: 'bold', color: '#111', marginTop: 16, marginBottom: 8 },
  infoText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 12 },
  description: { fontSize: 14, color: '#6B7280', marginBottom: 12, lineHeight: 20 },
  
  formatCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  formatLabel: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8 },
  formatItem: { fontSize: 14, color: '#6B7280', marginBottom: 6, paddingLeft: 8 },
  
  urlCard: {
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  urlText: { fontSize: 14, fontWeight: '600', color: '#2D8B47', textAlign: 'center' },
  credentials: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  
  exampleCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  exampleRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  exampleHeader: { flex: 1, fontSize: 12, fontWeight: '600', color: '#111' },
  exampleCell: { flex: 1, fontSize: 12, color: '#6B7280' },
  
  tipCard: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
  },
  tipText: { fontSize: 14, color: '#1F2937', marginBottom: 8, lineHeight: 20 },
});
