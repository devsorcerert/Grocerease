import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
    loadKPIs();
  }, []);

  const checkAdminAccess = () => {
    if (!user || user.email !== 'admin@grocereasetv.com') {
      Alert.alert('Access Denied', 'Admin access required');
      router.back();
    }
  };

  const loadKPIs = async () => {
    try {
      const response = await api.get('/admin/kpis');
      console.log('Admin KPIs loaded:', response.data);
      setKpis(response.data);
    } catch (error: any) {
      console.error('Failed to load KPIs:', error);
      console.error('Error details:', error.response?.data);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to load dashboard data. Please ensure you\'re logged in as admin.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D8B47" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={loadKPIs}>
          <Ionicons name="refresh" size={24} color="#2D8B47" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/admin/products')}
            >
              <Ionicons name="cube-outline" size={32} color="#2D8B47" />
              <Text style={styles.actionTitle}>Products</Text>
              <Text style={styles.actionSubtitle}>Manage inventory</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/admin/excel-import')}
            >
              <Ionicons name="cloud-upload-outline" size={32} color="#FF8C42" />
              <Text style={styles.actionTitle}>Excel Import</Text>
              <Text style={styles.actionSubtitle}>Bulk upload</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Operational KPIs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Operational Metrics</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.kpiLabel}>NPS Score</Text>
              <Text style={styles.kpiValue}>{kpis?.nps || 0}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.kpiLabel}>Delivery Time</Text>
              <Text style={styles.kpiValue}>{kpis?.avgDeliveryTime || 0}m</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.kpiLabel}>Efficiency</Text>
              <Text style={styles.kpiValue}>{kpis?.deliveryEfficiency || 0}%</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#FFF7ED' }]}>
              <Text style={styles.kpiLabel}>Deliveries</Text>
              <Text style={styles.kpiValue}>{kpis?.totalDeliveries || 0}</Text>
            </View>
          </View>
        </View>

        {/* Financial KPIs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Financial Metrics</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: '#FFF7ED' }]}>
              <Text style={styles.kpiLabel}>Total Revenue</Text>
              <Text style={styles.kpiValue}>₹{kpis?.totalRevenue || 0}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#FFF7ED' }]}>
              <Text style={styles.kpiLabel}>AOV</Text>
              <Text style={styles.kpiValue}>₹{kpis?.aov || 0}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.kpiLabel}>Gross Margin</Text>
              <Text style={styles.kpiValue}>{kpis?.grossMargin || 0}%</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.kpiLabel}>Cost/Delivery</Text>
              <Text style={styles.kpiValue}>₹{kpis?.costPerDelivery || 0}</Text>
            </View>
          </View>
        </View>

        {/* Customer KPIs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Customer Metrics</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.kpiLabel}>Retention</Text>
              <Text style={styles.kpiValue}>{kpis?.customerRetentionRate || 0}%</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.kpiLabel}>Satisfaction</Text>
              <Text style={styles.kpiValue}>{kpis?.customerSatisfaction || 0}%</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.kpiLabel}>CAC</Text>
              <Text style={styles.kpiValue}>₹{kpis?.cac || 0}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#FFF7ED' }]}>
              <Text style={styles.kpiLabel}>CLV</Text>
              <Text style={styles.kpiValue}>₹{kpis?.clv || 0}</Text>
            </View>
          </View>
        </View>

        {/* Inventory KPIs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Inventory Metrics</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.kpiLabel}>Turnover</Text>
              <Text style={styles.kpiValue}>{kpis?.inventoryTurnover || 0}x</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#F3E8FF' }]}>
              <Text style={styles.kpiLabel}>Total Products</Text>
              <Text style={styles.kpiValue}>{kpis?.totalProducts || 0}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.kpiLabel}>Out of Stock</Text>
              <Text style={styles.kpiValue}>{kpis?.outOfStock || 0}</Text>
            </View>
          </View>
        </View>

        {/* TV Integration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📺 GrocerEase TV</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.kpiLabel}>Orders via QR</Text>
              <Text style={styles.kpiValue}>{kpis?.ordersViaQR || 0}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.kpiLabel}>TV Users</Text>
              <Text style={styles.kpiValue}>{kpis?.tvUsersLinked || 0}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.kpiLabel}>QR Conversion</Text>
              <Text style={styles.kpiValue}>{kpis?.qrConversionRate || 0}%</Text>
            </View>
          </View>
        </View>

        {/* Brand Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏷️ Brand Analytics</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: '#F3E8FF', flex: 1 }]}>
              <Text style={styles.kpiLabel}>Top Brand</Text>
              <Text style={styles.kpiValue}>{kpis?.topBrand || 'N/A'}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#EFF6FF', flex: 1 }]}>
              <Text style={styles.kpiLabel}>Avg Consumption</Text>
              <Text style={styles.kpiValue}>{kpis?.avgBrandConsumption || 0}</Text>
            </View>
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
  
  content: { flex: 1 },
  
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  
  actionsGrid: { flexDirection: 'row', gap: 12 },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginTop: 8 },
  actionSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  kpiLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  kpiValue: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280' },
});
