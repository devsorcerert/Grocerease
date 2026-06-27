import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, TextInput, Image, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Collapsible Section ─────────────────────────────────────────────────────
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };
  return (
    <View style={cs.wrapper}>
      <TouchableOpacity style={cs.header} onPress={toggle} activeOpacity={0.7}>
        <Text style={cs.title}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
      </TouchableOpacity>
      {open && <View style={cs.body}>{children}</View>}
    </View>
  );
}
const cs = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden', elevation: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 16, fontWeight: '700', color: '#111' },
  body: { paddingHorizontal: 12, paddingBottom: 12 },
});

// ─── KPI Grid ────────────────────────────────────────────────────────────────
function KpiGrid({ items }: { items: { label: string; value: any; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((item, i) => (
        <View key={i} style={[styles.kpiCard, { backgroundColor: item.color }]}>
          <Text style={styles.kpiLabel}>{item.label}</Text>
          <Text style={styles.kpiValue}>{item.value ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Featured Products Manager ────────────────────────────────────────────────
function FeaturedProductsManager() {
  const [featured, setFeatured] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadFeatured(); }, []);

  const loadFeatured = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products/featured');
      setFeatured(res.data.products || []);
    } catch { setFeatured([]); }
    finally { setLoading(false); }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets[0]) setNewImage(result.assets[0].uri);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice.trim()) { Alert.alert('Error', 'Name and price are required'); return; }
    setSaving(true);
    try {
      const price = parseFloat(newPrice);
      if (isNaN(price)) { Alert.alert('Error', 'Invalid price'); return; }
      await api.post('/admin/products', {
        name: newName.trim(),
        price_paise: Math.round(price * 100),
        category: newCategory.trim() || 'Featured',
        image: newImage || '',
        is_featured: true,
        stock: 100,
      });
      setNewName(''); setNewPrice(''); setNewImage(''); setNewCategory('');
      setAdding(false);
      loadFeatured();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to add product');
    } finally { setSaving(false); }
  };

  const handleRemoveFeatured = async (productId: string) => {
    try {
      await api.post(`/admin/products/${productId}/toggle-featured`);
      loadFeatured();
    } catch { Alert.alert('Error', 'Failed to update'); }
  };

  const handleDelete = async (productId: string) => {
    Alert.alert('Delete', 'Delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/admin/products/${productId}`); loadFeatured(); }
        catch { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  if (loading) return <ActivityIndicator color="#2D8B47" style={{ margin: 20 }} />;

  return (
    <View>
      <TouchableOpacity style={fp.addBtn} onPress={() => setAdding(v => !v)}>
        <Ionicons name={adding ? 'close' : 'add'} size={18} color="#fff" />
        <Text style={fp.addBtnText}>{adding ? 'Cancel' : 'Add Product'}</Text>
      </TouchableOpacity>

      {adding && (
        <View style={fp.form}>
          <TextInput style={fp.input} placeholder="Product name *" value={newName} onChangeText={setNewName} />
          <TextInput style={fp.input} placeholder="Price (₹) *" value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" />
          <TextInput style={fp.input} placeholder="Category (optional)" value={newCategory} onChangeText={setNewCategory} />
          <TouchableOpacity style={fp.imagePick} onPress={pickImage}>
            <Ionicons name="image-outline" size={18} color="#6B7280" />
            <Text style={fp.imagePickText}>{newImage ? 'Image selected' : 'Pick image (optional)'}</Text>
          </TouchableOpacity>
          {newImage ? <Image source={{ uri: newImage }} style={fp.preview} /> : null}
          <TouchableOpacity style={[fp.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
            <Text style={fp.saveBtnText}>{saving ? 'Saving...' : 'Save Product'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {featured.length === 0 && !adding && (
        <Text style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>No featured products yet</Text>
      )}

      {featured.map(p => (
        <View key={p.id} style={fp.row}>
          {p.image ? <Image source={{ uri: p.image }} style={fp.thumb} /> : (
            <View style={[fp.thumb, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="image-outline" size={20} color="#9CA3AF" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={fp.rowName} numberOfLines={1}>{p.name}</Text>
            <Text style={fp.rowPrice}>₹{p.price ?? '—'} · {p.category}</Text>
          </View>
          <TouchableOpacity style={fp.unfeatureBtn} onPress={() => handleRemoveFeatured(p.id)}>
            <Ionicons name="star" size={16} color="#F59E0B" />
          </TouchableOpacity>
          <TouchableOpacity style={fp.deleteBtn} onPress={() => handleDelete(p.id)}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const fp = StyleSheet.create({
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2D8B47', borderRadius: 10, padding: 10, alignSelf: 'flex-start', marginBottom: 12 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  form: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 12, gap: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, fontSize: 14 },
  imagePick: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8 },
  imagePickText: { color: '#6B7280', fontSize: 13 },
  preview: { width: '100%', height: 120, borderRadius: 8, resizeMode: 'cover' },
  saveBtn: { backgroundColor: '#2D8B47', borderRadius: 10, padding: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#111' },
  rowPrice: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  unfeatureBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'featured'>('overview');

  useEffect(() => {
    if (!user || user.is_admin !== true) {
      Alert.alert('Access Denied', 'Admin access required');
      router.back();
      return;
    }
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      const res = await api.get('/admin/kpis');
      setKpis(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to load dashboard');
    } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#2D8B47" /></View>
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

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'overview' && styles.tabActive]} onPress={() => setActiveTab('overview')}>
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'featured' && styles.tabActive]} onPress={() => setActiveTab('featured')}>
          <Ionicons name="star" size={14} color={activeTab === 'featured' ? '#2D8B47' : '#6B7280'} style={{ marginRight: 4 }} />
          <Text style={[styles.tabText, activeTab === 'featured' && styles.tabTextActive]}>Featured Products</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' ? (
          <>
            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/admin/products')}>
                  <Ionicons name="cube-outline" size={32} color="#2D8B47" />
                  <Text style={styles.actionTitle}>Products</Text>
                  <Text style={styles.actionSubtitle}>Manage inventory</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/admin/orders')}>
                  <Ionicons name="receipt-outline" size={32} color="#6366F1" />
                  <Text style={styles.actionTitle}>Orders</Text>
                  <Text style={styles.actionSubtitle}>Assign riders</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/admin/riders')}>
                  <Ionicons name="bicycle-outline" size={32} color="#0EA5E9" />
                  <Text style={styles.actionTitle}>Riders</Text>
                  <Text style={styles.actionSubtitle}>Manage fleet</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Operational Metrics */}
            <CollapsibleSection title="📊 Operational Metrics">
              <KpiGrid items={[
                { label: 'NPS Score', value: kpis?.nps, color: '#ECFDF5' },
                { label: 'Avg Delivery Time', value: kpis?.avgDeliveryTime ? `${kpis.avgDeliveryTime}m` : null, color: '#EFF6FF' },
                { label: 'Delivery Efficiency', value: kpis?.deliveryEfficiency ? `${kpis.deliveryEfficiency}%` : null, color: '#ECFDF5' },
                { label: 'Order Accuracy', value: kpis?.orderAccuracyRate ? `${kpis.orderAccuracyRate}%` : null, color: '#FFF7ED' },
                { label: 'Fulfilment Speed', value: kpis?.fulfilmentSpeed ? `${kpis.fulfilmentSpeed}m` : null, color: '#EFF6FF' },
                { label: 'Total Deliveries', value: kpis?.totalDeliveries, color: '#F3E8FF' },
              ]} />
            </CollapsibleSection>

            {/* Financial Metrics */}
            <CollapsibleSection title="💰 Financial Metrics">
              <KpiGrid items={[
                { label: 'Total Revenue', value: kpis?.totalRevenue ? `₹${kpis.totalRevenue}` : null, color: '#FFF7ED' },
                { label: 'AOV', value: kpis?.aov ? `₹${kpis.aov}` : null, color: '#FFF7ED' },
                { label: 'Revenue/Delivery', value: kpis?.revenuePerDelivery ? `₹${kpis.revenuePerDelivery}` : null, color: '#FFF7ED' },
                { label: 'Gross Margin', value: kpis?.grossMargin ? `${kpis.grossMargin}%` : null, color: '#ECFDF5' },
                { label: 'Cost/Delivery', value: kpis?.costPerDelivery ? `₹${kpis.costPerDelivery}` : null, color: '#FEE2E2' },
              ]} />
            </CollapsibleSection>

            {/* Customer Metrics */}
            <CollapsibleSection title="👥 Customer Metrics">
              <KpiGrid items={[
                { label: 'Retention Rate', value: kpis?.customerRetentionRate ? `${kpis.customerRetentionRate}%` : null, color: '#ECFDF5' },
                { label: 'Satisfaction', value: kpis?.customerSatisfaction ? `${kpis.customerSatisfaction}%` : null, color: '#ECFDF5' },
                { label: 'CAC', value: kpis?.cac ? `₹${kpis.cac}` : null, color: '#FEE2E2' },
                { label: 'CLV', value: kpis?.clv ? `₹${kpis.clv}` : null, color: '#FFF7ED' },
                { label: 'Total Customers', value: kpis?.totalCustomers, color: '#EFF6FF' },
              ]} />
            </CollapsibleSection>

            {/* Inventory Metrics */}
            <CollapsibleSection title="📦 Inventory Metrics">
              <KpiGrid items={[
                { label: 'Inventory Turnover', value: kpis?.inventoryTurnover ? `${kpis.inventoryTurnover}x` : null, color: '#EFF6FF' },
                { label: 'Total Products', value: kpis?.totalProducts, color: '#F3E8FF' },
                { label: 'Out of Stock', value: kpis?.outOfStock, color: '#FEE2E2' },
              ]} />
            </CollapsibleSection>

            {/* Investor Metrics */}
            <CollapsibleSection title="📈 Investor Metrics">
              <KpiGrid items={[
                { label: 'MoM Growth', value: kpis?.momGrowth ? `${kpis.momGrowth}%` : null, color: '#ECFDF5' },
                { label: 'Burn Rate', value: kpis?.burnRate ? `₹${kpis.burnRate}` : null, color: '#FEE2E2' },
                { label: 'LTV/CAC', value: kpis?.ltvCac, color: '#EFF6FF' },
                { label: 'Active Users', value: kpis?.activeUsers, color: '#F3E8FF' },
              ]} />
            </CollapsibleSection>

            {/* GETV Integrations */}
            <CollapsibleSection title="📺 GETV Integrations">
              <KpiGrid items={[
                { label: 'Orders via QR', value: kpis?.ordersViaQR, color: '#ECFDF5' },
                { label: 'TV Users Linked', value: kpis?.tvUsersLinked, color: '#EFF6FF' },
                { label: 'QR Conversion', value: kpis?.qrConversionRate ? `${kpis.qrConversionRate}%` : null, color: '#ECFDF5' },
              ]} />
            </CollapsibleSection>

            {/* Brand Analytics */}
            <CollapsibleSection title="🏷️ Brand Analytics">
              <KpiGrid items={[
                { label: 'Top Brand', value: kpis?.topBrand || 'N/A', color: '#F3E8FF' },
                { label: 'Avg Consumption', value: kpis?.avgBrandConsumption, color: '#EFF6FF' },
                { label: 'Pricing Index', value: kpis?.competitivePricingIndex, color: '#FFF7ED' },
              ]} />
            </CollapsibleSection>

            <View style={{ height: 32 }} />
          </>
        ) : (
          <View style={{ padding: 16 }}>
            <Text style={styles.sectionTitle}>Featured Products</Text>
            <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 16 }}>
              These products appear in the Featured section on the home screen.
            </Text>
            <FeaturedProductsManager />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2D8B47' },
  tabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: '#2D8B47', fontWeight: '700' },

  content: { flex: 1 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 16 },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { flex: 1, minWidth: '28%', backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', elevation: 2 },
  actionTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginTop: 8, textAlign: 'center' },
  actionSubtitle: { fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  kpiCard: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 12, elevation: 1 },
  kpiLabel: { fontSize: 11, color: '#6B7280', marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: 'bold', color: '#111' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280' },
});
