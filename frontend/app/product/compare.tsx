import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useCartStore } from '../../store/cartStore';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = SCREEN_WIDTH * 0.65; // Each product column takes up 65% of screen width for easy swipe comparisons

export default function ProductComparePage() {
  const router = useRouter();
  const { ids } = useLocalSearchParams();
  const { addToCart } = useCartStore();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);

  useEffect(() => {
    fetchComparisonData();
  }, [ids]);

  const fetchComparisonData = async () => {
    if (!ids) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const productIds = (ids as string).split(',');
      const response = await api.post('/products/compare', productIds);
      setProducts(response.data.products);
      setComparison(response.data.comparison);
    } catch (error) {
      console.error('Failed to fetch comparison:', error);
      Alert.alert('Error', 'Failed to load product comparison');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (product: any) => {
    try {
      if (product.stock === 0) {
        Alert.alert('Out of Stock', 'This product is currently out of stock');
        return;
      }
      await addToCart(product.id, 1);
      Toast.show({
        type: 'success',
        text1: 'Added to Cart',
        text2: `${product.name} added to cart!`,
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    } catch (error) {
      console.error('Failed to add to cart:', error);
      Alert.alert('Error', 'Failed to add product to cart');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D8B47" />
          <Text style={styles.loadingText}>Comparing products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (products.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="git-compare-outline" size={64} color="#6B7280" />
          <Text style={styles.errorTitle}>No Products to Compare</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compare Products</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Comparison Summary Box */}
        {comparison && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Comparison Quick Facts</Text>
            <View style={styles.summaryStats}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Lowest Price</Text>
                <Text style={styles.statValue}>₹{comparison.price.lowest.toFixed(2)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Highest Price</Text>
                <Text style={styles.statValue}>₹{comparison.price.highest.toFixed(2)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Average Price</Text>
                <Text style={styles.statValue}>₹{comparison.price.average.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Side-by-Side Product Columns ScrollView */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.scrollContainer}
        >
          {products.map((product) => {
            const hasDiscount = product.original_price && product.original_price > product.price;
            return (
              <View key={product.id} style={styles.productColumn}>
                <View>
                  {/* Image & Main Info Header Card */}
                  <View style={styles.productCard}>
                    {product.image_url ? (
                      <Image source={{ uri: product.image_url }} style={styles.productImage} />
                    ) : (
                      <View style={styles.productImagePlaceholder}>
                        <Ionicons name="cube-outline" size={40} color="#9CA3AF" />
                      </View>
                    )}
                    {product.stock === 0 && (
                      <View style={styles.outOfStockBadge}>
                        <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
                      </View>
                    )}
                    <Text style={styles.productBrand}>{product.brand || product.category || 'Grocerease'}</Text>
                    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                    
                    <View style={styles.priceContainer}>
                      <Text style={styles.productPrice}>₹{product.price}</Text>
                      {hasDiscount && (
                        <Text style={styles.productOldPrice}>₹{product.original_price}</Text>
                      )}
                    </View>
                  </View>

                  {/* Specs Section */}
                  <View style={styles.specsSection}>
                    {/* Weight / Unit */}
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Pack Size</Text>
                      <Text style={styles.specValue}>{product.unit || 'N/A'}</Text>
                    </View>

                    {/* Stock Status */}
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Availability</Text>
                      <Text style={[
                        styles.specValue, 
                        { color: product.stock > 0 ? '#2D8B47' : '#DC2626', fontWeight: 'bold' }
                      ]}>
                        {product.stock > 0 ? `${product.stock} In Stock` : 'Out of Stock'}
                      </Text>
                    </View>

                    {/* Shelf Life */}
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Shelf Life</Text>
                      <Text style={styles.specValue}>
                        {product.shelf_life_days ? `${product.shelf_life_days} days` : 'N/A'}
                      </Text>
                    </View>

                    {/* Category */}
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Category</Text>
                      <Text style={styles.specValue}>{product.category || 'N/A'}</Text>
                    </View>

                    {/* Description */}
                    <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.specLabel}>Description</Text>
                      <Text style={styles.descriptionText} numberOfLines={8}>
                        {product.description || 'No description provided.'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions Button */}
                <TouchableOpacity 
                  style={[
                    styles.addToCartBtn, 
                    product.stock === 0 && styles.addToCartBtnDisabled
                  ]}
                  onPress={() => handleAddToCart(product)}
                  disabled={product.stock === 0}
                >
                  <Ionicons name="cart-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.addToCartBtnText}>
                    {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#374151' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: 'bold', color: '#111', marginTop: 16 },
  backButton: { marginTop: 24, backgroundColor: '#2D8B47', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  content: { flex: 1 },
  
  summaryContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryTitle: { fontSize: 15, fontWeight: 'bold', color: '#111', marginBottom: 12 },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: 'bold', color: '#2D8B47' },

  scrollContainer: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  productColumn: {
    width: COLUMN_WIDTH,
    marginHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  productCard: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  productImagePlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 50,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  outOfStockText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  productBrand: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 },
  productName: { fontSize: 14, fontWeight: 'bold', color: '#111', textAlign: 'center', height: 40, lineHeight: 20 },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  productPrice: { fontSize: 18, fontWeight: 'bold', color: '#2D8B47' },
  productOldPrice: { fontSize: 14, color: '#9CA3AF', textDecorationLine: 'line-through' },
  
  specsSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    marginBottom: 16,
  },
  specRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  specLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500', marginBottom: 2 },
  specValue: { fontSize: 13, color: '#111' },
  descriptionText: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  
  addToCartBtn: {
    backgroundColor: '#FF8C42',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  addToCartBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  addToCartBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
