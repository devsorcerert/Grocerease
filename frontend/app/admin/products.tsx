import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

export default function AdminProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/products');
      setProducts(response.data.products || []);
    } catch {
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/admin/products/${productId}`);
          loadProducts();
        } catch { Alert.alert('Error', 'Failed to delete product'); }
      }},
    ]);
  };

  const handleToggleFeatured = async (productId: string, current: boolean) => {
    setTogglingId(productId);
    try {
      const res = await api.post(`/admin/products/${productId}/toggle-featured`);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_featured: res.data.is_featured } : p));
    } catch { Alert.alert('Error', 'Failed to update featured status'); }
    finally { setTogglingId(null); }
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Management</Text>
        <TouchableOpacity onPress={loadProducts}>
          <Ionicons name="refresh" size={24} color="#2D8B47" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{products.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{products.filter(p => p.is_featured).length}</Text>
          <Text style={styles.statLabel}>Featured</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{filteredProducts.length}</Text>
          <Text style={styles.statLabel}>Showing</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {filteredProducts.map((product) => (
          <View key={product.id || product._id} style={[styles.productCard, product.is_featured && styles.featuredCard]}>
            <View style={styles.productInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                {product.is_featured && (
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>★ Featured</Text>
                  </View>
                )}
              </View>
              <Text style={styles.productCategory}>{product.category}</Text>
              <View style={styles.productDetails}>
                <Text style={styles.productPrice}>₹{product.price ?? (product.price_paise ? (product.price_paise / 100).toFixed(0) : '—')}</Text>
                <Text style={styles.productStock}>Stock: {product.stock || 0}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.featuredBtn, product.is_featured && styles.featuredBtnActive]}
                onPress={() => handleToggleFeatured(product.id, product.is_featured)}
                disabled={togglingId === product.id}
              >
                {togglingId === product.id
                  ? <ActivityIndicator size="small" color={product.is_featured ? '#fff' : '#F59E0B'} />
                  : <Ionicons name={product.is_featured ? 'star' : 'star-outline'} size={18} color={product.is_featured ? '#fff' : '#F59E0B'} />
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(product.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {filteredProducts.length === 0 && (
          <View style={styles.center}>
            <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/admin/excel-import')}>
        <Ionicons name="cloud-upload" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#111' },
  statsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 12, alignItems: 'center', elevation: 1 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#2D8B47' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 16 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 10, elevation: 1 },
  featuredCard: { borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600', color: '#111' },
  productCategory: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  productDetails: { flexDirection: 'row', gap: 12 },
  productPrice: { fontSize: 14, fontWeight: '700', color: '#2D8B47' },
  productStock: { fontSize: 13, color: '#6B7280' },
  featuredBadge: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  featuredBadgeText: { fontSize: 10, color: '#D97706', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  featuredBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  featuredBtnActive: { backgroundColor: '#F59E0B' },
  deleteButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  fab: { position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2D8B47', alignItems: 'center', justifyContent: 'center', elevation: 8 },
});
