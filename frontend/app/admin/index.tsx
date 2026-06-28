import React, { useState, useEffect } from 'react';
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
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [featRes, allRes] = await Promise.all([
        api.get('/products/featured'),
        api.get('/products?limit=500'),
      ]);
      setFeatured(featRes.data.products || []);
      const all = allRes.data.products || allRes.data || [];
      setAllProducts(Array.isArray(all) ? all : []);
    } catch { setFeatured([]); }
    finally { setLoading(false); }
  };

  // Products not yet featured
  const notFeatured = allProducts.filter(p => !p.is_featured);
  const filtered = pickerSearch.trim()
    ? notFeatured.filter(p => p.name?.toLowerCase().includes(pickerSearch.toLowerCase()))
    : notFeatured;

  const handleFeature = async (productId: string) => {
    setSaving(true);
    try {
      await api.post(`/admin/products/${productId}/toggle-featured`);
      setShowPicker(false);
      setPickerSearch('');
      loadData();
    } catch { Alert.alert('Error', 'Failed to update'); }
    finally { setSaving(false); }
  };

  const handleUnfeature = async (productId: string) => {
    try {
      await api.post(`/admin/products/${productId}/toggle-featured`);
      loadData();
    } catch { Alert.alert('Error', 'Failed to update'); }
  };

  const handleDelete = async (productId: string) => {
    Alert.alert('Delete', 'Delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/admin/products/${productId}`); loadData(); }
        catch { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  if (loading) return <ActivityIndicator color="#2D8B47" style={{ margin: 20 }} />;

  return (
    <View>
      <TouchableOpacity style={fp.addBtn} onPress={() => { setShowPicker(v => !v); setPickerSearch(''); }}>
        <Ionicons name={showPicker ? 'close' : 'star'} size={18} color="#fff" />
        <Text style={fp.addBtnText}>{showPicker ? 'Cancel' : 'Add to Featured'}</Text>
      </TouchableOpacity>

      {showPicker && (
        <View style={fp.pickerBox}>
          <Text style={fp.pickerTitle}>Select a product to feature</Text>
          <TextInput
            style={fp.searchInput}
            placeholder="Search products..."
            value={pickerSearch}
            onChangeText={setPickerSearch}
            placeholderTextColor="#9CA3AF"
          />
          {filtered.length === 0 ? (
            <Text style={fp.emptyPicker}>No products found</Text>
          ) : (
            filtered.slice(0, 30).map(p => (
              <TouchableOpacity key={p.id} style={fp.pickerRow} onPress={() => handleFeature(p.id)} disabled={saving}>
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={fp.pickerThumb} />
                ) : (
                  <View style={[fp.pickerThumb, { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="image-outline" size={14} color="#9CA3AF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={fp.pickerName} numberOfLines={1}>{p.name}</Text>
                  <Text style={fp.pickerPrice}>{p.category} · ₹{p.price ?? '—'}</Text>
                </View>
                <Ionicons name="add-circle" size={22} color="#2D8B47" />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {featured.length === 0 && !showPicker && (
        <Text style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>No featured products yet</Text>
      )}

      {featured.map(p => (
        <View key={p.id} style={fp.row}>
          {p.image_url ? <Image source={{ uri: p.image_url }} style={fp.thumb} /> : (
            <View style={[fp.thumb, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="image-outline" size={20} color="#9CA3AF" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={fp.rowName} numberOfLines={1}>{p.name}</Text>
            <Text style={fp.rowPrice}>₹{p.price ?? '—'} · {p.category}</Text>
          </View>
          <TouchableOpacity style={fp.unfeatureBtn} onPress={() => handleUnfeature(p.id)}>
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
  pickerBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', maxHeight: 320 },
  pickerTitle: { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 8 },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, marginBottom: 8, color: '#111' },
  emptyPicker: { color: '#9CA3AF', textAlign: 'center', padding: 12, fontSize: 13 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  pickerThumb: { width: 36, height: 36, borderRadius: 6, resizeMode: 'cover' },
  pickerName: { fontSize: 13, fontWeight: '600', color: '#111' },
  pickerPrice: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  thumb: { width: 44, height: 44, borderRadius: 8, resizeMode: 'cover' },
  rowName: { fontSize: 14, fontWeight: '600', color: '#111' },
  rowPrice: { fontSize: 12, color: '#6B7280' },
  unfeatureBtn: { padding: 8, backgroundColor: '#FFFBEB', borderRadius: 8 },
  deleteBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },
});

// ─── Offers Manager ──────────────────────────────────────────────────────────
function OffersManager() {
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQty, setOfferQty] = useState('');
  const [offerLabel, setOfferLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allRes, offRes] = await Promise.all([
        api.get('/products?limit=500'),
        api.get('/admin/offers').catch(() => ({ data: { offers: [] } })),
      ]);
      const all = allRes.data.products || allRes.data || [];
      setAllProducts(Array.isArray(all) ? all : []);
      setOffers(offRes.data.offers || offRes.data || []);
    } catch { setAllProducts([]); }
    finally { setLoading(false); }
  };

  const filtered = pickerSearch.trim()
    ? allProducts.filter(p => p.name?.toLowerCase().includes(pickerSearch.toLowerCase()))
    : allProducts;

  const handleSaveOffer = async () => {
    if (!selectedProduct) { Alert.alert('Error', 'Select a product'); return; }
    const price = parseFloat(offerPrice);
    if (!offerPrice || isNaN(price)) { Alert.alert('Error', 'Enter a valid offer price'); return; }
    setSaving(true);
    try {
      await api.post('/admin/offers', {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        offer_price: price,
        offer_price_paise: Math.round(price * 100),
        original_price: selectedProduct.price,
        quantity_limit: offerQty ? parseInt(offerQty) : null,
        label: offerLabel.trim() || 'Special Offer',
        is_active: true,
      });
      setShowForm(false);
      setSelectedProduct(null);
      setOfferPrice('');
      setOfferQty('');
      setOfferLabel('');
      setPickerSearch('');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to save offer');
    } finally { setSaving(false); }
  };

  const handleDeleteOffer = async (offerId: string) => {
    Alert.alert('Delete Offer', 'Remove this offer?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/admin/offers/${offerId}`);
          loadData();
        } catch { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  if (loading) return <ActivityIndicator color="#2D8B47" style={{ margin: 20 }} />;

  return (
    <View>
      <TouchableOpacity style={off.addBtn} onPress={() => { setShowForm(v => !v); setPickerSearch(''); setSelectedProduct(null); }}>
        <Ionicons name={showForm ? 'close' : 'pricetag'} size={18} color="#fff" />
        <Text style={off.addBtnText}>{showForm ? 'Cancel' : 'Create Offer'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={off.form}>
          {!selectedProduct ? (
            <>
              <Text style={off.formLabel}>Select Product</Text>
              <TextInput
                style={off.searchInput}
                placeholder="Search products..."
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholderTextColor="#9CA3AF"
              />
              <View style={off.productList}>
                {filtered.slice(0, 25).map(p => (
                  <TouchableOpacity key={p.id} style={off.productRow} onPress={() => setSelectedProduct(p)}>
                    {p.image_url ? (
                      <Image source={{ uri: p.image_url }} style={off.productThumb} />
                    ) : (
                      <View style={[off.productThumb, { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="cube-outline" size={14} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={off.productName} numberOfLines={1}>{p.name}</Text>
                      <Text style={off.productPrice}>₹{p.price ?? '—'} · {p.category}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={off.selectedProduct}>
                {selectedProduct.image_url ? (
                  <Image source={{ uri: selectedProduct.image_url }} style={off.selectedThumb} />
                ) : (
                  <View style={[off.selectedThumb, { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="cube-outline" size={20} color="#9CA3AF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={off.selectedName}>{selectedProduct.name}</Text>
                  <Text style={off.selectedOrigPrice}>Original: ₹{selectedProduct.price}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                  <Ionicons name="close-circle" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <Text style={off.formLabel}>Offer Price (₹) *</Text>
              <TextInput style={off.input} placeholder="e.g. 49" value={offerPrice} onChangeText={setOfferPrice} keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />

              <Text style={off.formLabel}>Quantity Limit (optional)</Text>
              <TextInput style={off.input} placeholder="e.g. 100 units available" value={offerQty} onChangeText={setOfferQty} keyboardType="numeric" placeholderTextColor="#9CA3AF" />

              <Text style={off.formLabel}>Offer Label</Text>
              <TextInput style={off.input} placeholder="e.g. Weekend Sale, Flash Deal" value={offerLabel} onChangeText={setOfferLabel} placeholderTextColor="#9CA3AF" />

              <TouchableOpacity style={[off.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSaveOffer} disabled={saving}>
                <Text style={off.saveBtnText}>{saving ? 'Saving...' : 'Save Offer'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {offers.length === 0 && !showForm && (
        <Text style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>No offers created yet</Text>
      )}

      {offers.map((o, i) => (
        <View key={o.id ?? i} style={off.offerRow}>
          <View style={off.offerBadge}>
            <Ionicons name="pricetag" size={14} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={off.offerName} numberOfLines={1}>{o.product_name || o.label}</Text>
            <Text style={off.offerPriceText}>
              ₹{o.offer_price} <Text style={{ color: '#9CA3AF', textDecorationLine: 'line-through' }}>₹{o.original_price}</Text>
              {o.quantity_limit ? ` · Qty: ${o.quantity_limit}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={off.delBtn} onPress={() => handleDeleteOffer(o.id)}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const off = StyleSheet.create({
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', borderRadius: 10, padding: 10, alignSelf: 'flex-start', marginBottom: 12 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  form: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 8 },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, marginBottom: 8, color: '#111' },
  productList: { maxHeight: 240 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  productThumb: { width: 34, height: 34, borderRadius: 6, resizeMode: 'cover' },
  productName: { fontSize: 13, fontWeight: '600', color: '#111' },
  productPrice: { fontSize: 11, color: '#6B7280' },
  selectedProduct: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10, marginBottom: 4 },
  selectedThumb: { width: 40, height: 40, borderRadius: 8, resizeMode: 'cover' },
  selectedName: { fontSize: 14, fontWeight: '700', color: '#111' },
  selectedOrigPrice: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: '#111', marginBottom: 4 },
  saveBtn: { backgroundColor: '#7C3AED', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  offerBadge: { backgroundColor: '#7C3AED', borderRadius: 8, padding: 6 },
  offerName: { fontSize: 13, fontWeight: '600', color: '#111' },
  offerPriceText: { fontSize: 12, color: '#2D8B47', marginTop: 2 },
  delBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'featured' | 'offers'>('overview');

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <Text style={[styles.tabText, activeTab === 'featured' && styles.tabTextActive]}>Featured</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'offers' && styles.tabActive]} onPress={() => setActiveTab('offers')}>
          <Ionicons name="pricetag" size={14} color={activeTab === 'offers' ? '#7C3AED' : '#6B7280'} style={{ marginRight: 4 }} />
          <Text style={[styles.tabText, activeTab === 'offers' && { color: '#7C3AED', fontWeight: '700' }]}>Offers</Text>
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
        ) : activeTab === 'featured' ? (
          <View style={{ padding: 16 }}>
            <Text style={styles.sectionTitle}>Featured Products</Text>
            <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 16 }}>
              These products appear in the Featured section on the home screen.
            </Text>
            <FeaturedProductsManager />
          </View>
        ) : activeTab === 'offers' ? (
          <View style={{ padding: 16 }}>
            <Text style={styles.sectionTitle}>Offers</Text>
            <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 16 }}>
              Set special offer prices and quantity limits on any product.
            </Text>
            <OffersManager />
          </View>
        ) : null}
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
