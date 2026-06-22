import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

type Rider = { id: string; name: string; phone: string; availability: boolean };
type Order = {
  id: string; status: string; total_amount: number;
  created_at: string; assigned_rider_id: string | null;
  user_name?: string;
};

export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [pickerOrder, setPickerOrder] = useState<Order | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [oRes, rRes] = await Promise.all([
        api.get('/orders/admin/list'),
        api.get('/admin/riders'),
      ]);
      setOrders(oRes.data.orders ?? []);
      setRiders(rRes.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const assignRider = async (orderId: string, riderId: string) => {
    setAssigning(orderId);
    setPickerOrder(null);
    try {
      await api.post(`/orders/admin/${orderId}/assign-rider`, { rider_id: riderId });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Assignment failed');
    } finally {
      setAssigning(null);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'delivered') return '#2D8B47';
    if (s === 'out_for_delivery' || s === 'picked_up') return '#FF8C42';
    if (s === 'cancelled') return '#EF4444';
    return '#6B7280';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2D8B47" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders</Text>
        <TouchableOpacity onPress={load}>
          <Ionicons name="refresh" size={24} color="#2D8B47" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {orders.length === 0 && (
          <Text style={styles.empty}>No orders yet.</Text>
        )}
        {orders.map((order) => {
          const assignedRider = riders.find(r => r.id === order.assigned_rider_id);
          const available = riders.filter(r => r.availability);
          return (
            <View key={order.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
                <Text style={[styles.status, { color: statusColor(order.status) }]}>
                  {order.status.replace(/_/g, ' ')}
                </Text>
              </View>
              <Text style={styles.meta}>₹{order.total_amount?.toFixed(2)}</Text>
              {assignedRider ? (
                <Text style={styles.riderAssigned}>
                  <Ionicons name="bicycle" size={13} color="#2D8B47" /> {assignedRider.name}
                </Text>
              ) : (
                <Text style={styles.unassigned}>No rider assigned</Text>
              )}
              {assigning === order.id ? (
                <ActivityIndicator size="small" color="#2D8B47" style={{ marginTop: 8 }} />
              ) : (
                <TouchableOpacity
                  style={[styles.assignBtn, available.length === 0 && styles.assignBtnDisabled]}
                  disabled={available.length === 0}
                  onPress={() => setPickerOrder(order)}
                >
                  <Text style={styles.assignBtnText}>
                    {assignedRider ? 'Reassign Rider' : 'Assign Rider'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!pickerOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Rider</Text>
            <FlatList
              data={riders.filter(r => r.availability)}
              keyExtractor={r => r.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.riderRow}
                  onPress={() => pickerOrder && assignRider(pickerOrder.id, item.id)}
                >
                  <Ionicons name="person-circle-outline" size={28} color="#2D8B47" />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.riderName}>{item.name}</Text>
                    <Text style={styles.riderPhone}>{item.phone}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No available riders.</Text>}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPickerOrder(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 3, elevation: 2,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  orderId: { fontWeight: '700', color: '#111', fontSize: 15 },
  status: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  meta: { color: '#6B7280', fontSize: 13, marginBottom: 6 },
  riderAssigned: { color: '#2D8B47', fontSize: 13, marginBottom: 8 },
  unassigned: { color: '#9CA3AF', fontSize: 13, marginBottom: 8 },
  assignBtn: {
    backgroundColor: '#2D8B47', borderRadius: 8, paddingVertical: 8,
    alignItems: 'center',
  },
  assignBtnDisabled: { backgroundColor: '#D1D5DB' },
  assignBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '60%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  riderRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  riderName: { fontWeight: '600', color: '#111', fontSize: 15 },
  riderPhone: { color: '#6B7280', fontSize: 13 },
  cancelBtn: {
    marginTop: 16, backgroundColor: '#F3F4F6', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: '#111', fontWeight: '600', fontSize: 15 },
});
