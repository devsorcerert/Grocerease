import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useCartStore } from '../../store/cartStore';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const params = useLocalSearchParams();
  const { addToCart } = useCartStore();

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (params.selectedCategory) {
      setSelectedCategory(params.selectedCategory as string);
      fetchProducts(params.selectedCategory as string);
    }
  }, [params.selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProducts = async (category?: string) => {
    try {
      setLoading(true);
      const response = await api.get('/products', { 
        params: category ? { category } : {} 
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    fetchProducts(categoryName);
  };

  const handleAddToCart = async (productId: string, productName: string) => {
    try {
      await addToCart(productId, 1);
      Alert.alert('Success', `${productName} added to cart!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to add to cart');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryList}>
        <TouchableOpacity 
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => { setSelectedCategory(null); fetchProducts(); }}
        >
          <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity 
            key={cat.id} 
            style={[styles.categoryChip, selectedCategory === cat.name && styles.categoryChipActive]}
            onPress={() => handleCategorySelect(cat.name)}
          >
            <Text style={[styles.categoryChipText, selectedCategory === cat.name && styles.categoryChipTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <ScrollView style={styles.productList}>
          {products.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="basket-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          ) : (
            products.map((product) => (
              <View key={product.id} style={styles.productItem}>
                <View style={styles.productImage}>
                  <Ionicons name="bag-outline" size={40} color="#2D8B47" />
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productUnit}>{product.unit}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.productPrice}>₹{product.price}</Text>
                    {product.original_price && (
                      <Text style={styles.originalPrice}>₹{product.original_price}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => handleAddToCart(product.id, product.name)}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  categoryList: { padding: 16, maxHeight: 60 },
  categoryChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#2D8B47' },
  categoryChipText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: '#6B7280' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16 },
  productList: { flex: 1, padding: 16 },
  productItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 12 },
  productImage: { width: 60, height: 60, backgroundColor: '#E5E7EB', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 16, fontWeight: '600', color: '#111' },
  productUnit: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  productPrice: { fontSize: 16, fontWeight: 'bold', color: '#2D8B47' },
  originalPrice: { fontSize: 14, color: '#9CA3AF', textDecorationLine: 'line-through', marginLeft: 8 },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2D8B47', alignItems: 'center', justifyContent: 'center' },
});
