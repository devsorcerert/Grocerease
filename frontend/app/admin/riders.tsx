import React, { useState, useEffect, useCallback } from 'react';
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
  status: string; availability: boolean; current_order_id?: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  offline: '#6B7280',
  online: '#2D8B47',
  pending_approval: '#D97706',
  suspended: '#EF4444',
  on_delivery: '#3B82F6',
};

const STATUS_LABEL: Record<string, string> = {
  offline: 'Offline',
  online: 'Online',
  pending_approval: 'Pending Approval',
  suspended: 'Suspended',
  on_delivery: 'On Delivery',
};

export default function AdminRiders() {
  const router = useRouter();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', password: '', vehicle: 'Bike' });

  const loadRiders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/riders');
      setRiders(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to load riders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRiders(); }, [loadRiders]);

  const createRider = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.password.trim()) {
      Alert.alert('Validation', 'Name, phone and password are required');
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

  const handleAction = async (
    riderId: string,
    riderName: string,
    action: 'approve' | 'suspend' | 'reactivate'
  ) => {
    const messages = {
      approve: { title: 'Approve Rider', msg: `Approve ${riderName}? They will be able to log in and accept orders.` },
      suspend: { title: 'Suspend Rider', msg: `Suspend ${riderName}? They will be blocked from logging in.` },
      reactivate: { title: 'Reactivate Rider', msg: `Reactivate ${riderName}? They will be able to log in again.` },
    };
    Alert.alert(messages[action].title, messages[action].msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'suspend' ? 'Suspend' : 'Confirm',
        style: action === 'suspend' ? 'destructive' : 'default',
        onPress: async () => {
          setActionId(riderId);
          try {
            await api.post(`/admin/riders/${riderId}/${action}`);
            await loadRiders();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.detail || `Failed to ${action} rider`);
          } finally {
            setActionId(null);
          }
        },
      },
    ]);
  };

  // Group riders by status for clarity
  const pending = riders.filter(r => r.status === 'pending_approval');
  const active = riders.filter(r => r.status !== 'pending_approval' && r.status !== 'suspended');
  const suspended = riders.filter(r => r.status === 'suspended');

  const RiderCard = ({ rider }: { rider: Rider }) => {
    const isLoading = actionId === rider.id;
    const statusColor = STATUS_COLOR[rider.status] ?? '#6B7280';

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{rider.name}</Text>
            <Text style={styles.riderMeta}>{rider.phone} · {rider.vehicle}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {STATUS_LABEL[rider.status] ?? rider.status}
            </Text>
          </View>
        </View>

        {rider.current_order_id && (
          <Text style={styles.orderNote}>📦 Active order: {rider.current_order_id.slice(0, 8).toUpperCase()}</Text>
        )}

        <View style={styles.actionRow}>
          {rider.status === 'pending_approval' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleAction(rider.id, rider.name, 'approve')}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="checkmark-circle" size={15} color="#fff" /><Text style={styles.actionBtnText}> Approve</Text></>
              }
            </TouchableOpacity>
          )}

          {(rider.status === 'offline' || rider.status === 'online') && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.suspendBtn]}
              onPress={() => handleAction(rider.id, rider.name, 'suspend')}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="ban" size={15} color="#fff" /><Text style={styles.actionBtnText}> Suspend</Text></>
              }
            </TouchableOpacity>
          )}

          {rider.status === 'suspended' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.reactivateBtn]}
              onPress={() => handleAction(rider.id, rider.name, 'reactivate')}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="refresh-circle" size={15} color="#fff" /><Text style={styles.actionBtnText}> Reactivate</Text></>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
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

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Add rider form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Rider</Text>
          <TextInput style={styles.input} placeholder="Full name" value={form.name}
            onChangeText={v => setForm(f => ({ ...f, name: v }))} />
          <TextInput style={styles.input} placeholder="Phone number" keyboardType="phone-pad"
            value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry
            value={form.password} onChangeText={v => setForm(f => ({ ...f, password: v }))} />
          <TextInput style={styles.input} placeholder="Vehicle (default: Bike)"
            value={form.vehicle} onChangeText={v => setForm(f => ({ ...f, vehicle: v }))} />
          <TouchableOpacity style={[styles.createBtn, creating && styles.createBtnDisabled]}
            onPress={createRider} disabled={creating}>
            {creating
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.createBtnText}>Create Rider</Text>
            }
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color="#2D8B47" style={{ marginTop: 32 }} />}

        {!loading && (
          <>
            {/* Pending approval */}
            {pending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.groupHeader}>
                  <Ionicons name="time-outline" size={18} color="#D97706" />
                  <Text style={[styles.groupTitle, { color: '#D97706' }]}>
                    Pending Approval ({pending.length})
                  </Text>
                </View>
                {pending.map(r => <RiderCard key={r.id} rider={r} />)}
              </View>
            )}

            {/* Active riders */}
            <View style={styles.section}>
              <View style={styles.groupHeader}>
                <Ionicons name="bicycle-outline" size={18} color="#2D8B47" />
                <Text style={[styles.groupTitle, { color: '#2D8B47' }]}>
                  Active Riders ({active.length})
                </Text>
              </View>
              {active.length === 0
                ? <Text style={styles.empty}>No active riders.</Text>
                : active.map(r => <RiderCard key={r.id} rider={r} />)
              }
            </View>

            {/* Suspended */}
            {suspended.length > 0 && (
              <View style={styles.section}>
                <View style={styles.groupHeader}>
                  <Ionicons name="ban-outline" size={18} color="#EF4444" />
                  <Text style={[styles.groupTitle, { color: '#EF4444' }]}>
                    Suspended ({suspended.length})
                  </Text>
                </View>
                {suspended.map(r => <RiderCard key={r.id} rider={r} />)}
              </View>
            )}
          </>
        )}
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
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 14 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  groupTitle: { fontSize: 15, fontWeight: '700' },
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
  empty: { color: '#6B7280', textAlign: 'center', paddingVertical: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 3, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  riderName: { fontWeight: '700', color: '#111', fontSize: 15, marginBottom: 2 },
  riderMeta: { color: '#6B7280', fontSize: 13 },
  statusBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  orderNote: { fontSize: 12, color: '#3B82F6', marginBottom: 8 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 100, justifyContent: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  approveBtn: { backgroundColor: '#2D8B47' },
  suspendBtn: { backgroundColor: '#EF4444' },
  reactivateBtn: { backgroundColor: '#6366F1' },
});
