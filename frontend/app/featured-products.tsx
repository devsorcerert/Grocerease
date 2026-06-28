import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';
import ProductImage from '../components/ProductImage';
import QuantitySelector from '../components/QuantitySelector';

export default function FeaturedProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeatured();
  }, []);

  const fetchFeatured = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products/featured');
      const prods = res.data.products || res.data;
      if (Array.isArray(prods) && prods.length > 0) {
        setProducts(prods);
      } else {
        // Fallback: show all products if none are featured yet
        const fallback = await api.get('/products');
        setProducts(fallback.data.products || fallback.data || []);
      }
    } catch {
      try {
        const fallback = await api.get('/products');
        setProducts(fallback.data.products || fallback.data || []);
      } catch {}
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
        <Text style={styles.headerTitle}>Featured Products</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2D8B47" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {products.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/product/[productId]', params: { productId: product.id } })}
            >
              <ProductImage uri={product.image} style={styles.image} />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.unit}>{product.unit}</Text>
                <View style={styles.footer}>
                  <Text style={styles.price}>₹{Math.ceil(product.price || 0)}</Text>
                  {product.offer_price && product.offer_price > product.price && (
                    <Text style={styles.mrp}>₹{Math.ceil(product.offer_price)}</Text>
                  )}
                </View>
                <View style={{ marginTop: 8 }}>
                  <QuantitySelector productId={product.id} size="small" color="#2D8B47" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
          {products.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="star-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No featured products yet</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  grid: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
    shadowRadius: 4, elevation: 2,
  },
  image: { width: '100%', height: 130 },
  info: { padding: 10 },
  name: { fontSize: 13, fontWeight: '600', color: '#111', marginBottom: 2 },
  unit: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 15, fontWeight: 'bold', color: '#2D8B47' },
  mrp: { fontSize: 12, color: '#9CA3AF', textDecorationLine: 'line-through' },
});
