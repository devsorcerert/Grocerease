import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    users: 0,
    orders: 0,
    products: 0,
    revenue: 0
  });
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only allow admin access on web platform
    if (Platform.OS !== 'web') {
      Alert.alert('Access Denied', 'Admin panel is only available on web interface');
      router.replace('/(tabs)/home');
      return;
    }

    if (!user?.is_admin) {
      Alert.alert('Access Denied', 'Admin privileges required');
      router.replace('/(tabs)/home');
      return;
    }

    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load products
      const productsRes = await api.get('/products');
      setProducts(productsRes.data);
      
      // Load orders  
      const ordersRes = await api.get('/orders');
      setOrders(ordersRes.data);
      
      // Calculate stats
      setStats({
        users: 150, // Mock data
        orders: ordersRes.data.length,
        products: productsRes.data.length,
        revenue: ordersRes.data.reduce((sum: number, order: any) => sum + (order.total || order.subtotal || 0), 0)
      });
      
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="desktop-outline" size={64} color="#6B7280" />
          <Text style={styles.errorTitle}>Web Only</Text>
          <Text style={styles.errorText}>Admin panel requires web browser access</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="shield-outline" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>Admin privileges required</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoContainer}>
            <Ionicons name="basket" size={32} color="#2D8B47" />
            <View style={styles.logoText}>
              <Text style={styles.logoGreen}>Grocer</Text>
              <Text style={styles.logoOrange}>Ease</Text>
            </View>
          </View>
          <Text style={styles.adminBadge}>Admin Dashboard</Text>
        </View>
        
        <View style={styles.headerRight}>
          <Text style={styles.welcomeAdmin}>Welcome, {user.name}</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainContainer}>
        {/* Sidebar Navigation */}
        <View style={styles.sidebar}>
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
            onPress={() => setActiveTab('dashboard')}
          >
            <Ionicons name="speedometer-outline" size={20} color={activeTab === 'dashboard' ? '#fff' : '#6B7280'} />
            <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>Dashboard</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'products' && styles.navItemActive]}
            onPress={() => setActiveTab('products')}
          >
            <Ionicons name="cube-outline" size={20} color={activeTab === 'products' ? '#fff' : '#6B7280'} />
            <Text style={[styles.navText, activeTab === 'products' && styles.navTextActive]}>Products</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'orders' && styles.navItemActive]}
            onPress={() => setActiveTab('orders')}
          >
            <Ionicons name="receipt-outline" size={20} color={activeTab === 'orders' ? '#fff' : '#6B7280'} />
            <Text style={[styles.navText, activeTab === 'orders' && styles.navTextActive]}>Orders</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'features' && styles.navItemActive]}
            onPress={() => setActiveTab('features')}
          >
            <Ionicons name="settings-outline" size={20} color={activeTab === 'features' ? '#fff' : '#6B7280'} />
            <Text style={[styles.navText, activeTab === 'features' && styles.navTextActive]}>Features</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backToApp}
            onPress={() => router.push('/(tabs)/home')}
          >
            <Ionicons name="arrow-back-outline" size={20} color="#2D8B47" />
            <Text style={styles.backToAppText}>Back to App</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <ScrollView style={styles.content}>
          {activeTab === 'dashboard' && (
            <View style={styles.tabContent}>
              <Text style={styles.tabTitle}>Dashboard Overview</Text>
              
              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, styles.statCardGreen]}>
                  <Text style={styles.statNumber}>{stats.users}</Text>
                  <Text style={styles.statLabel}>Total Users</Text>
                </View>
                
                <View style={[styles.statCard, styles.statCardOrange]}>
                  <Text style={styles.statNumber}>{stats.orders}</Text>
                  <Text style={styles.statLabel}>Orders</Text>
                </View>
                
                <View style={[styles.statCard, styles.statCardGreen]}>
                  <Text style={styles.statNumber}>{stats.products}</Text>
                  <Text style={styles.statLabel}>Products</Text>
                </View>
                
                <View style={[styles.statCard, styles.statCardOrange]}>
                  <Text style={styles.statNumber}>₹{Math.round(stats.revenue)}</Text>
                  <Text style={styles.statLabel}>Revenue</Text>
                </View>
              </View>

              {/* Recent Orders */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Orders</Text>
                {orders.slice(0, 5).map((order: any) => (
                  <View key={order.id} style={styles.orderItem}>
                    <Text style={styles.orderId}>#{order.id.substring(0, 8)}</Text>
                    <Text style={styles.orderAmount}>₹{order.total || order.subtotal}</Text>
                    <Text style={styles.orderStatus}>{order.status}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'products' && (
            <View style={styles.tabContent}>
              <Text style={styles.tabTitle}>Product Management</Text>
              
              <TouchableOpacity style={styles.addButton}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add Product</Text>
              </TouchableOpacity>

              {products.map((product: any) => (
                <View key={product.id} style={styles.productItem}>
                  <View style={styles.productIcon}>
                    <Ionicons name="cube-outline" size={24} color="#2D8B47" />
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productPrice}>₹{product.price} - {product.unit}</Text>
                  </View>
                  <TouchableOpacity style={styles.editButton}>
                    <Ionicons name="pencil-outline" size={16} color="#FF8C42" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'orders' && (
            <View style={styles.tabContent}>
              <Text style={styles.tabTitle}>Order Management</Text>
              
              {orders.map((order: any) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderIdFull}>Order #{order.id.substring(0, 12)}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.orderTotal}>Total: ₹{order.total || order.subtotal}</Text>
                  <Text style={styles.orderItems}>
                    {order.items?.length || 0} items • Status: {order.status}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'features' && (
            <View style={styles.tabContent}>
              <Text style={styles.tabTitle}>Feature Management</Text>
              
              <View style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <Ionicons name="tv-outline" size={24} color="#2D8B47" />
                  <Text style={styles.featureTitle}>Cable TV Integration</Text>
                  <View style={styles.featureStatus}>
                    <Text style={styles.featureStatusText}>Active</Text>
                  </View>
                </View>
                <Text style={styles.featureDesc}>
                  API-ready infrastructure for real cable TV provider integration
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <Ionicons name="gift-outline" size={24} color="#FF8C42" />
                  <Text style={styles.featureTitle}>Auto-Rewards System</Text>
                  <View style={styles.featureStatus}>
                    <Text style={styles.featureStatusText}>Active</Text>
                  </View>
                </View>
                <Text style={styles.featureDesc}>
                  Tier-based automatic reward calculation and application
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <Ionicons name="restaurant-outline" size={24} color="#2D8B47" />
                  <Text style={styles.featureTitle}>Bulk Ingredients</Text>
                  <View style={styles.featureStatus}>
                    <Text style={styles.featureStatusText}>Active</Text>
                  </View>
                </View>
                <Text style={styles.featureDesc}>
                  One-click ingredient addition from GrocerEase TV videos
                </Text>
              </View>

              <View style={styles.infrastructureCard}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.infrastructureTitle}>Infrastructure Ready</Text>
                <Text style={styles.infrastructureDesc}>
                  All features have complete infrastructure and are ready for real API integration
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: { flexDirection: 'row' },
  logoGreen: { fontSize: 20, fontWeight: 'bold', color: '#2D8B47' },
  logoOrange: { fontSize: 20, fontWeight: 'bold', color: '#FF8C42' },
  adminBadge: { 
    backgroundColor: '#2D8B47', 
    color: '#fff', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12, 
    fontSize: 12, 
    fontWeight: '600' 
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  welcomeAdmin: { fontSize: 14, color: '#6B7280' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logoutText: { color: '#EF4444', fontWeight: '600' },

  mainContainer: { flex: 1, flexDirection: 'row' },
  
  sidebar: {
    width: 250,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    padding: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  navItemActive: { backgroundColor: '#2D8B47' },
  navText: { fontSize: 14, color: '#6B7280' },
  navTextActive: { color: '#fff' },
  backToApp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#2D8B47',
    borderRadius: 8,
  },
  backToAppText: { color: '#2D8B47', fontWeight: '600' },

  content: { flex: 1, padding: 24 },
  tabContent: { flex: 1 },
  tabTitle: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 24 },

  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 16, 
    marginBottom: 32 
  },
  statCard: {
    width: '22%',
    minWidth: 150,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statCardGreen: { backgroundColor: '#2D8B47' },
  statCardOrange: { backgroundColor: '#FF8C42' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#fff', opacity: 0.9 },

  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 16 },

  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  orderId: { fontSize: 14, fontWeight: '600', color: '#111' },
  orderAmount: { fontSize: 14, color: '#2D8B47', fontWeight: '600' },
  orderStatus: { fontSize: 12, color: '#6B7280' },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2D8B47',
    padding: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },

  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
  },
  productIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#ECFDF5',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', color: '#111' },
  productPrice: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  editButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#FF8C42',
    borderRadius: 6,
  },

  orderCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderIdFull: { fontSize: 14, fontWeight: '600', color: '#111' },
  orderDate: { fontSize: 12, color: '#6B7280' },
  orderTotal: { fontSize: 16, fontWeight: 'bold', color: '#2D8B47', marginBottom: 4 },
  orderItems: { fontSize: 12, color: '#6B7280' },

  featureCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  featureTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111' },
  featureStatus: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureStatusText: { fontSize: 12, color: '#2D8B47', fontWeight: '600' },
  featureDesc: { fontSize: 14, color: '#6B7280', lineHeight: 20 },

  infrastructureCard: {
    backgroundColor: '#ECFDF5',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
  },
  infrastructureTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  infrastructureDesc: { fontSize: 14, color: '#6B7280', flex: 1 },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: { fontSize: 24, fontWeight: 'bold', color: '#111', marginTop: 16 },
  errorText: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
});