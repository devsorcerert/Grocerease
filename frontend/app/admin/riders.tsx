import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

type Rider = {
  id: string; name: string; phone: string; vehicle: string;
  status: string; availability: boolean;
};

export default function AdminRiders() {
  const router = useRouter();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', password: '', vehicle: 'Bike' });

  useEffect(() => { loadRiders(); }, []);

  const loadRiders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/riders');
      setRiders(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to load riders');
    } finally {
      setLoading(false);
    }
  };

  const createRider = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.password.trim()) {
      Alert.alert('Validation', 'Name, phone, and password are required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/admin/riders', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password.trim(),
        vehicle: form.vehicle.trim() || 'Bike',
      });
      setForm({ name: '', phone: '', password: '', vehicle: 'Bike' });
      await loadRiders();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to create rider');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Riders</Text>
        <TouchableOpacity onPress={loadRiders}>
          <Ionicons name="refresh" size={24} color="#2D8B47" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Create rider form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Rider</Text>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            value={form.name}
            onChangeText={v => setForm(f => ({ ...f, name: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={v => setForm(f => ({ ...f, phone: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={form.password}
            onChangeText={v => setForm(f => ({ ...f, password: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Vehicle (default: Bike)"
            value={form.vehicle}
            onChangeText={v => setForm(f => ({ ...f, vehicle: v }))}
          />
          <TouchableOpacity
            style={[styles.createBtn, creating && styles.createBtnDisabled]}
            onPress={createRider}
            disabled={creating}
          >
            {creating
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.createBtnText}>Create Rider</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Rider list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Riders ({riders.length})</Text>
          {loading && <ActivityIndicator size="small" color="#2D8B47" />}
          {!loading && riders.length === 0 && (
            <Text style={styles.empty}>No riders yet.</Text>
          )}
          {riders.map(rider => (
            <View key={rider.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.riderName}>{rider.name}</Text>
                <View style={[
                  styles.badge,
                  rider.availability ? styles.badgeGreen : styles.badgeGray,
                ]}>
                  <Text style={styles.badgeText}>
                    {rider.availability ? 'Available' : 'On order'}
                  </Text>
                </View>
              </View>
              <Text style={styles.riderMeta}>{rider.phone} · {rider.vehicle}</Text>
              <Text style={[
                styles.riderStatus,
                rider.status === 'online' ? { color: '#2D8B47' } : { color: '#9CA3AF' },
              ]}>
                {rider.status}
              </Text>
            </View>
          ))}
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
  content: { flex: 1 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111', marginBottom: 12,
  },
  createBtn: {
    backgroundColor: '#2D8B47', borderRadius: 8, paddingVertical: 13,
    alignItems: 'center', marginTop: 4,
  },
  createBtnDisabled: { backgroundColor: '#86EFAC' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 3, elevation: 2,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  riderName: { fontWeight: '700', color: '#111', fontSize: 15 },
  riderMeta: { color: '#6B7280', fontSize: 13, marginBottom: 4 },
  riderStatus: { fontSize: 12, textTransform: 'capitalize' },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  badgeGreen: { backgroundColor: '#DCFCE7' },
  badgeGray: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },
});
