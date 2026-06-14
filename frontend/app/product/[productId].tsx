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
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useCartStore } from '../../store/cartStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Review {
  id: string;
  user_name: string;
  rating: number;
  comment: string;
  date: string;
  helpful_count: number;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const { productId } = useLocalSearchParams();
  const { addToCart } = useCartStore();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [inWishlist, setInWishlist] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  useEffect(() => {
    fetchProductDetails();
  }, [productId]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch main product
      const response = await api.get(`/products/${productId}`);
      setProduct(response.data);
      
      // Fetch related products (same category)
      if (response.data.category) {
        const relatedResponse = await api.get('/products', {
          params: { category: response.data.category, limit: 6 }
        });
        setRelatedProducts(
          relatedResponse.data.products.filter((p: any) => p.id !== productId).slice(0, 4)
        );
      }
      
      // Fetch reviews from response if they exist, otherwise default to empty
      if (response.data.reviews && Array.isArray(response.data.reviews)) {
        setReviews(response.data.reviews);
      } else {
        setReviews([]);
      }
      
    } catch (error) {
      console.error('Failed to fetch product details:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    try {
      if (product.stock === 0) {
        Alert.alert('Out of Stock', 'This product is currently unavailable');
        return;
      }
      
      await addToCart(product.id, quantity);
      Toast.show({
        type: 'success',
        text1: 'Added to Cart',
        text2: `${quantity} item(s) added to cart!`,
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    } catch (error) {
      console.error('Failed to add to cart:', error);
      Alert.alert('Error', 'Failed to add product to cart');
    }
  };

  const toggleWishlist = () => {
    setInWishlist(!inWishlist);
    Alert.alert(
      inWishlist ? 'Removed from Wishlist' : 'Added to Wishlist',
      inWishlist ? 'Product removed from your wishlist' : 'Product added to your wishlist'
    );
  };

  const calculateDiscount = () => {
    if (product?.original_price && product?.price) {
      const discount = ((product.original_price - product.price) / product.original_price) * 100;
      return Math.round(discount);
    }
    return product?.discount_percentage || 0;
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 4.5;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D8B47" />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#DC2626" />
          <Text style={styles.errorTitle}>Product Not Found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Product images
  const productImages = product.images && Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.image ? [product.image] : []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleWishlist}>
            <Ionicons 
              name={inWishlist ? "heart" : "heart-outline"} 
              size={24} 
              color={inWishlist ? "#DC2626" : "#111"} 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/cart')}>
            <Ionicons name="cart-outline" size={24} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Image Gallery */}
        <View style={styles.imageGallery}>
          {productImages.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setSelectedImageIndex(index);
                }}
              >
                {productImages.map((img: string, index: number) => (
                  <Image
                    key={index}
                    source={{ uri: img }}
                    style={styles.productImage}
                  />
                ))}
              </ScrollView>
              <View style={styles.imageIndicators}>
                {productImages.map((_: any, index: number) => (
                  <View
                    key={index}
                    style={[
                      styles.indicator,
                      selectedImageIndex === index && styles.indicatorActive
                    ]}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="cube-outline" size={80} color="#D1D5DB" />
            </View>
          )}
          
          {product.stock === 0 && (
            <View style={styles.outOfStockBanner}>
              <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
            </View>
          )}
          
          {calculateDiscount() > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{calculateDiscount()}% OFF</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productBrand}>{product.brand || product.category}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          
          {/* Rating */}
          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              <Ionicons name="star" size={18} color="#FF8C42" />
              <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
            </View>
            <Text style={styles.reviewCount}>({reviews.length} reviews)</Text>
          </View>

          {/* Price */}
          <View style={styles.priceContainer}>
            <Text style={styles.productPrice}>₹{product.price}</Text>
            {product.original_price && product.original_price > product.price && (
              <Text style={styles.productOldPrice}>₹{product.original_price}</Text>
            )}
            <Text style={styles.productUnit}>{product.unit || '1 kg'}</Text>
          </View>

          {/* Stock Info */}
          {product.stock > 0 && product.stock <= 10 && (
            <View style={styles.stockWarning}>
              <Ionicons name="warning-outline" size={16} color="#DC2626" />
              <Text style={styles.stockWarningText}>
                Only {product.stock} left in stock!
              </Text>
            </View>
          )}

          {/* Description */}
          {product.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
            </View>
          )}

          {/* Product Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            <View style={styles.detailsGrid}>
              {product.brand && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Brand:</Text>
                  <Text style={styles.detailValue}>{product.brand}</Text>
                </View>
              )}
              {product.weight && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Weight:</Text>
                  <Text style={styles.detailValue}>{product.weight} kg</Text>
                </View>
              )}
              {product.shelf_life_days && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Shelf Life:</Text>
                  <Text style={styles.detailValue}>{product.shelf_life_days} days</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SKU:</Text>
                <Text style={styles.detailValue}>{product.sku || product.id}</Text>
              </View>
            </View>
          </View>

          {/* Nutritional Info */}
          {product.nutrition && Object.keys(product.nutrition).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nutritional Information</Text>
              <View style={styles.nutritionGrid}>
                {Object.entries(product.nutrition).map(([key, val]: [string, any]) => (
                  <View key={key} style={styles.nutritionItem}>
                    <Text style={styles.nutritionLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                    <Text style={styles.nutritionValue}>{String(val)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Customer Reviews</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.reviewSummary}>
                <View style={styles.ratingLarge}>
                  <Text style={styles.ratingLargeNumber}>{averageRating.toFixed(1)}</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= averageRating ? "star" : "star-outline"}
                        size={16}
                        color="#FF8C42"
                      />
                    ))}
                  </View>
                  <Text style={styles.reviewSummaryText}>{reviews.length} reviews</Text>
                </View>
              </View>

              {reviews.slice(0, 2).map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={styles.reviewerAvatar}>
                        <Text style={styles.reviewerInitial}>
                          {review.user_name.charAt(0)}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewerName}>{review.user_name}</Text>
                        <Text style={styles.reviewDate}>{review.date}</Text>
                      </View>
                    </View>
                    <View style={styles.reviewRating}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= review.rating ? "star" : "star-outline"}
                          size={14}
                          color="#FF8C42"
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                  <TouchableOpacity style={styles.helpfulButton}>
                    <Ionicons name="thumbs-up-outline" size={14} color="#6B7280" />
                    <Text style={styles.helpfulText}>Helpful ({review.helpful_count})</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Similar Products</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.relatedProducts}>
                  {relatedProducts.map((relatedProduct) => (
                    <TouchableOpacity
                      key={relatedProduct.id}
                      style={styles.relatedProductCard}
                      onPress={() => router.push(`/product/${relatedProduct.id}`)}
                    >
                      {relatedProduct.image ? (
                        <Image
                          source={{ uri: relatedProduct.image }}
                          style={styles.relatedProductImage}
                        />
                      ) : (
                        <View style={styles.relatedProductImagePlaceholder}>
                          <Ionicons name="cube-outline" size={32} color="#D1D5DB" />
                        </View>
                      )}
                      <Text style={styles.relatedProductName} numberOfLines={2}>
                        {relatedProduct.name}
                      </Text>
                      <Text style={styles.relatedProductPrice}>₹{relatedProduct.price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.quantitySelector}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={product.stock === 0}
          >
            <Ionicons name="remove" size={20} color="#111" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => setQuantity(Math.min(product.stock, quantity + 1))}
            disabled={product.stock === 0}
          >
            <Ionicons name="add" size={20} color="#111" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.addToCartButton, product.stock === 0 && styles.addToCartButtonDisabled]}
          onPress={handleAddToCart}
          disabled={product.stock === 0}
        >
          <Ionicons name="cart-outline" size={20} color="#fff" />
          <Text style={styles.addToCartButtonText}>
            {product.stock === 0 ? 'Out of Stock' : `Add to Cart • ₹${product.price * quantity}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 16,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: '#2D8B47',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  
  content: { flex: 1 },
  
  imageGallery: {
    position: 'relative',
    backgroundColor: '#fff',
  },
  productImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#F3F4F6',
  },
  productImagePlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  indicatorActive: {
    backgroundColor: '#fff',
  },
  outOfStockBanner: {
    position: 'absolute',
    top: SCREEN_WIDTH / 2 - 20,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  discountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  productInfo: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  productBrand: {
    fontSize: 13,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
  },
  
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  reviewCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  productPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D8B47',
  },
  productOldPrice: {
    fontSize: 18,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  productUnit: {
    fontSize: 14,
    color: '#6B7280',
  },
  
  stockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  stockWarningText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: '#2D8B47',
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
  },
  
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
  },
  
  reviewSummary: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 16,
  },
  ratingLarge: {
    alignItems: 'center',
  },
  ratingLargeNumber: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#111',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 8,
  },
  reviewSummaryText: {
    fontSize: 13,
    color: '#6B7280',
  },
  
  reviewCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2D8B47',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helpfulText: {
    fontSize: 12,
    color: '#6B7280',
  },
  
  relatedProducts: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  relatedProductCard: {
    width: 140,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  relatedProductImage: {
    width: 140,
    height: 140,
    backgroundColor: '#E5E7EB',
  },
  relatedProductImagePlaceholder: {
    width: 140,
    height: 140,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedProductName: {
    fontSize: 13,
    color: '#111',
    padding: 8,
    paddingBottom: 4,
  },
  relatedProductPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D8B47',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  quantityButton: {
    padding: 12,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    minWidth: 32,
    textAlign: 'center',
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2D8B47',
    paddingVertical: 14,
    borderRadius: 8,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
