import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import api from '../../utils/api';

const BRAND = '#2D8B47';

export default function ExcelImport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ count: number; inserted: number; updated: number; message: string } | null>(null);
  const [preview, setPreview] = useState<any[]>([]);

  const handlePickAndUpload = async () => {
    try {
      // 1. Pick file
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (picked.canceled || !picked.assets?.[0]) return;

      const file = picked.assets[0];
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        Alert.alert('Wrong file type', 'Please pick an .xlsx or .xls file.');
        return;
      }

      setLoading(true);
      setResult(null);
      setPreview([]);

      // 2. Read as base64
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 3. Parse with xlsx
      const workbook = XLSX.read(base64, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        Alert.alert('Empty file', 'The Excel sheet has no data rows.');
        setLoading(false);
        return;
      }

      // 4. Preview first 3 rows
      setPreview(rows.slice(0, 3));

      // 5. Upload to backend in batches of 200
      const BATCH = 200;
      let totalInserted = 0;
      let totalUpdated = 0;

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const res = await api.post('/products/bulk', { products: batch });
        totalInserted += res.data.inserted ?? 0;
        totalUpdated  += res.data.updated  ?? 0;
      }

      setResult({
        count: totalInserted + totalUpdated,
        inserted: totalInserted,
        updated: totalUpdated,
        message: `${totalInserted} products added, ${totalUpdated} updated`,
      });
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.response?.data?.detail || err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Excel Import</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadBtn, loading && { opacity: 0.6 }]}
          onPress={handlePickAndUpload}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={28} color="#fff" />
              <Text style={styles.uploadBtnText}>Pick Excel File & Upload</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Result Card */}
        {result && (
          <View style={styles.resultCard}>
            <Ionicons name="checkmark-circle" size={40} color={BRAND} />
            <Text style={styles.resultTitle}>Upload Complete!</Text>
            <Text style={styles.resultStat}>{result.inserted} new products added</Text>
            <Text style={styles.resultStat}>{result.updated} existing products updated</Text>
            <Text style={styles.resultTotal}>Total: {result.count} products processed</Text>
          </View>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preview (first 3 rows)</Text>
            {preview.map((row, i) => (
              <View key={i} style={styles.previewRow}>
                <Text style={styles.previewName}>{row.Name || row.name || '—'}</Text>
                <Text style={styles.previewMeta}>
                  {row.Category || row.category || ''}{' '}
                  {row.Price || row.price ? `• ₹${row.Price || row.price}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Format Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Columns</Text>
          <View style={styles.formatCard}>
            {['Name', 'Category', 'Price'].map(col => (
              <View key={col} style={styles.colRow}>
                <Ionicons name="checkmark-circle" size={16} color={BRAND} />
                <Text style={styles.colText}>{col}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Optional Columns</Text>
          <View style={styles.formatCard}>
            {['Brand', 'OfferPrice', 'Stock', 'Description', 'Image', 'Unit'].map(col => (
              <View key={col} style={styles.colRow}>
                <Ionicons name="remove-circle-outline" size={16} color="#9CA3AF" />
                <Text style={[styles.colText, { color: '#6B7280' }]}>{col}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips</Text>
          <View style={styles.tipCard}>
            {[
              'Upload 3000+ products at once',
              'Re-uploading same name updates the product (no duplicates)',
              'Saves directly to the live database',
              'First row must be column headers',
            ].map((tip, i) => (
              <Text key={i} style={styles.tipText}>✓  {tip}</Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  content: { flex: 1, padding: 16 },
  uploadBtn: {
    backgroundColor: BRAND, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    gap: 12, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  uploadBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  resultCard: {
    backgroundColor: '#ECFDF5', borderRadius: 14, padding: 24,
    alignItems: 'center', marginBottom: 20, gap: 6,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  resultTitle: { fontSize: 20, fontWeight: 'bold', color: '#065F46', marginTop: 8 },
  resultStat: { fontSize: 15, color: '#047857' },
  resultTotal: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 10 },
  formatCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, gap: 8,
  },
  colRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colText: { fontSize: 14, color: '#111' },
  tipCard: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16, gap: 8 },
  tipText: { fontSize: 14, color: '#1D4ED8', lineHeight: 20 },
  previewRow: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  previewName: { fontSize: 14, fontWeight: '600', color: '#111' },
  previewMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
