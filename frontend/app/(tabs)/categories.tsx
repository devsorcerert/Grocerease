import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCartStore } from '../../store/cartStore';
import { useTranslation } from '../../context/LanguageContext';

// Category icon mapping
const categoryIconMap: { [key: string]: any } = {
  'Fruits & Vegetables': 'leaf',
  'Dairy & Breakfast': 'cafe',
  'Munchies': 'fast-food',
  'Cold Drinks & Juices': 'beer',
  'Instant & Frozen': 'snow',
  'Tea, Coffee & More': 'cafe-outline',
  'Bakery & Biscuits': 'restaurant',
  'Sweet Tooth': 'ice-cream',
  'Atta, Rice & Dal': 'nutrition',
  'Masala & Spices': 'flame',
  'Sauces & Spreads': 'water',
  'Chicken, Meat & Fish': 'fish',
  'Cleaning Essentials': 'water-outline',
  'Personal Care': 'body',
  'Home & Kitchen': 'home',
};

export default function CategoriesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(true);
  const params = useLocalSearchParams();
  const { addToCart } = useCartStore();

  useEffect(() => {
    fetchCategories();
    if (!params.selectedCategory) {
      fetchProducts();
    }
  }, []);

  useEffect(() => {
    if (params.selectedCategory) {
      setSelectedCategory(params.selectedCategory as string);
      setShowCategories(false);
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
      // Handle new API response format
      setProducts(response.data.products || response.data || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      Alert.alert('Error', 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setShowCategories(false);
    fetchProducts(categoryName);
  };

  const handleBackToCategories = () => {
    setShowCategories(true);
    setSelectedCategory(null);
  };

  const handleAddToCart = async (productId: string, productName: string) => {
    try {
      await addToCart(productId, 1);
      Alert.alert('Success', `${productName} added to cart!`);
    } catch (error: any) {
      console.error('Add to cart error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to add to cart';
      Alert.alert('Error', errorMessage);
    }
  };

  if (showCategories) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('categoriesTitle')}</Text>
        </View>

        <ScrollView style={styles.categoryGrid}>
          <View style={styles.gridContainer}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat.id} 
                style={styles.categoryCard}
                onPress={() => handleCategorySelect(cat.name)}
              >
                <View style={styles.categoryIconContainer}>
                  <Ionicons name={categoryIconMap[cat.name] || 'apps'} size={36} color="#2D8B47" />
                </View>
                <Text style={styles.categoryCardName} numberOfLines={2}>
                  {cat.name}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={styles.categoryArrow} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackToCategories} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>{selectedCategory || t('allProducts')}</Text>
      </View>

      <View style={styles.filterChips}>
        <TouchableOpacity 
          style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
          onPress={() => { setSelectedCategory(null); fetchProducts(); }}
        >
          <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>{t('allProducts')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.filterChip}
          onPress={handleBackToCategories}
        >
          <Ionicons name="grid-outline" size={16} color="#6B7280" />
          <Text style={styles.filterChipText}>{t('categoriesTitle')}</Text>
        </TouchableOpacity>
      </View>

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
              <TouchableOpacity 
                key={product.id} 
                style={styles.productItem}
                onPress={() => router.push(`/product/${product.id}`)}
                activeOpacity={0.7}
              >
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
                  onPress={(e) => {
                    e.stopPropagation();
                    handleAddToCart(product.id, product.name);
                  }}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backButton: { marginRight: 12 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111', flex: 1 },
  
  // Category Grid
  categoryGrid: { flex: 1 },
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    padding: 12,
    justifyContent: 'space-between',
  },
  categoryCard: { 
    width: '48%', 
    backgroundColor: '#F9FAFB', 
    borderRadius: 16, 
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  categoryIconContainer: { 
    width: 70, 
    height: 70, 
    backgroundColor: '#ECFDF5', 
    borderRadius: 35, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 12,
  },
  categoryCardName: { 
    fontSize: 13, 
    fontWeight: '600',
    color: '#111', 
    textAlign: 'center',
    lineHeight: 18,
    minHeight: 36,
  },
  categoryArrow: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  // Filter Chips
  filterChips: { 
    flexDirection: 'row', 
    padding: 16, 
    gap: 8,
  },
  filterChip: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  filterChipActive: { backgroundColor: '#2D8B47' },
  filterChipText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  
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
