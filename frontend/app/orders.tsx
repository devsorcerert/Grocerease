import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

interface Order {
  _id: string;
  id: string;
  user_id: string;
  items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: string;
  delivery_address: string;
  payment_method: string;
  created_at: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/user/orders');
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#3B82F6';
      case 'delivered': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'time-outline';
      case 'confirmed': return 'checkmark-circle-outline';
      case 'delivered': return 'checkmark-done-circle';
      case 'cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D8B47" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Orders</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={80} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Start shopping to see your orders here</Text>
          <TouchableOpacity 
            style={styles.shopButton}
            onPress={() => router.push('/(tabs)/home')}
          >
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>My Orders ({orders.length})</Text>
        <TouchableOpacity onPress={fetchOrders}>
          <Ionicons name="refresh" size={24} color="#2D8B47" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {orders.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={styles.orderCard}
            onPress={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
          >
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
                <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
                <Ionicons name={getStatusIcon(order.status) as any} size={16} color={getStatusColor(order.status)} />
                <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                  {order.status}
                </Text>
              </View>
            </View>

            <View style={styles.orderSummary}>
              <Text style={styles.itemCount}>{order.items.length} item(s)</Text>
              <Text style={styles.orderTotal}>₹{order.total}</Text>
            </View>

            {expandedOrder === order.id && (
              <View style={styles.orderDetails}>
                <View style={styles.divider} />
                
                <Text style={styles.sectionTitle}>Items:</Text>
                {order.items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name} x{item.quantity}</Text>
                    <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                  </View>
                ))}

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Delivery Address:</Text>
                  <Text style={styles.detailValue}>{order.delivery_address || 'N/A'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Method:</Text>
                  <Text style={styles.detailValue}>{order.payment_method || 'COD'}</Text>
                </View>

                <TouchableOpacity style={styles.reorderButton}>
                  <Ionicons name="refresh-outline" size={18} color="#2D8B47" />
                  <Text style={styles.reorderText}>Reorder</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.expandIcon}>
              <Ionicons 
                name={expandedOrder === order.id ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#6B7280" 
              />
            </View>
          </TouchableOpacity>
        ))}
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
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280' },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: '#111', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  shopButton: {
    marginTop: 24,
    backgroundColor: '#2D8B47',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  content: { flex: 1 },
  
  orderCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: { fontSize: 16, fontWeight: '600', color: '#111' },
  orderDate: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  
  orderSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: { fontSize: 14, color: '#6B7280' },
  orderTotal: { fontSize: 18, fontWeight: 'bold', color: '#2D8B47' },
  
  orderDetails: { marginTop: 16 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemName: { fontSize: 14, color: '#374151', flex: 1 },
  itemPrice: { fontSize: 14, fontWeight: '500', color: '#111' },
  
  detailRow: { paddingVertical: 6 },
  detailLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  detailValue: { fontSize: 14, color: '#111' },
  
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2D8B47',
    borderRadius: 8,
    gap: 6,
  },
  reorderText: { color: '#2D8B47', fontSize: 14, fontWeight: '600' },
  
  expandIcon: { position: 'absolute', bottom: 16, right: 16 },
});
