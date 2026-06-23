import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';
import { useCartStore } from '../store/cartStore';
import Toast from 'react-native-toast-message';

const BRAND = '#2D8B47';

export default function WishlistScreen() {
  const router = useRouter();
  const { addToCart } = useCartStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchWishlist = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/wishlist');
      setItems(res.data.items || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchWishlist(); }, []);

  const handleRemove = async (productId: string) => {
    setRemoving(productId);
    try {
      await api.delete(`/wishlist/${productId}`);
      setItems(prev => prev.filter(p => p.id !== productId));
    } catch {}
    finally { setRemoving(null); }
  };

  const handleAddToCart = async (product: any) => {
    try {
      await addToCart(product.id, 1);
      Toast.show({ type: 'success', text1: 'Added to Cart', text2: product.name, position: 'bottom', visibilityTime: 1500 });
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>My Wishlist</Text>
        <Text style={styles.count}>{items.length} items</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={72} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptyText}>Save products you love by tapping the heart icon.</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(tabs)/home')}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWishlist(true); }} colors={[BRAND]} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity onPress={() => router.push(`/product/${item.id}` as any)} style={styles.cardLeft}>
                {item.image?.startsWith('http') ? (
                  <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Ionicons name="leaf-outline" size={32} color="#D1D5DB" />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.cardBody}>
                <TouchableOpacity onPress={() => router.push(`/product/${item.id}` as any)}>
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  {item.brand && <Text style={styles.brand}>{item.brand}</Text>}
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>₹{item.price}</Text>
                    {item.offer_price > item.price && (
                      <Text style={styles.originalPrice}>₹{item.offer_price}</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.addBtn, item.stock === 0 && styles.addBtnDisabled]} onPress={() => handleAddToCart(item)} disabled={item.stock === 0}>
                    <Ionicons name="cart-outline" size={16} color="#fff" />
                    <Text style={styles.addBtnText}>{item.stock === 0 ? 'Out of Stock' : 'Add to Cart'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.id)} disabled={removing === item.id}>
                    {removing === item.id
                      ? <ActivityIndicator size="small" color="#EF4444" />
                      : <Ionicons name="heart" size={22} color="#EF4444" />
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 22, fontWeight: 'bold', color: '#111' },
  count: { fontSize: 14, color: '#6B7280' },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#374151' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  shopBtn: { backgroundColor: BRAND, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
  shopBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  card: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardLeft: {},
  productImage: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#F9FAFB' },
  productImagePlaceholder: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, justifyContent: 'space-between' },
  productName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  brand: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  price: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  originalPrice: { fontSize: 14, color: '#9CA3AF', textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: BRAND, paddingVertical: 9, borderRadius: 10 },
  addBtnDisabled: { backgroundColor: '#9CA3AF' },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  removeBtn: { padding: 6 },
});
