import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/cartStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';

export default function CartScreen() {
  const { items, fetchCart, updateQuantity, clearCart } = useCartStore();
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [rewardCalculation, setRewardCalculation] = useState<any>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  useEffect(() => {
    fetchProductDetails();
    if (items.length > 0) {
      calculateRewards();
    }
  }, [items]);

  const fetchProductDetails = async () => {
    if (items.length === 0) return;
    try {
      const productPromises = items.map(item => api.get(`/products/${item.product_id}`));
      const responses = await Promise.all(productPromises);
      setProducts(responses.map(r => r.data));
    } catch (error) {
      console.error('Failed to fetch product details:', error);
    }
  };

  const calculateRewards = async () => {
    try {
      const subtotal = calculateSubtotal();
      if (subtotal > 0) {
        const response = await api.post('/checkout/calculate-rewards', { subtotal });
        setRewardCalculation(response.data);
      }
    } catch (error) {
      console.error('Failed to calculate rewards:', error);
    }
  };

  const handleUpdateQuantity = async (productId: string, newQuantity: number) => {
    try {
      await updateQuantity(productId, newQuantity);
    } catch (error) {
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.product_id);
      return sum + (product?.price || 0) * item.quantity;
    }, 0);
  };

  const calculateReward = () => {
    const spend = user?.monthly_spend || 0;
    if (spend >= 25000) return 1000;
    if (spend >= 13000) return 500;
    if (spend >= 7000) return 250;
    return 0;
  };

  const handleCheckout = () => {
    router.push('/checkout');
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyCart}>
          <Ionicons name="cart-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>{t('emptyCart')}</Text>
          <Text style={styles.emptySubtext}>Add items to get started</Text>
        </View>
      </SafeAreaView>
    );
  }

  const subtotal = calculateSubtotal();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('myCart')}</Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.itemList}>
        {items.map((item) => {
          const product = products.find(p => p.id === item.product_id);
          if (!product) return null;

          return (
            <View key={item.product_id} style={styles.cartItem}>
              <View style={styles.productImage}>
                <Ionicons name="bag-outline" size={32} color="#2D8B47" />
              </View>
              <View style={styles.productDetails}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productPrice}>₹{product.price}</Text>
              </View>
              <View style={styles.quantityControl}>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={16} color="#2D8B47" />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                >
                  <Ionicons name="add" size={16} color="#2D8B47" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{t('subtotal')}</Text>
          <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
        </View>
        
        {/* Auto-Rewards Display */}
        {rewardCalculation && (
          <>
            <View style={styles.rewardsBanner}>
              <View style={styles.rewardsBannerHeader}>
                <Ionicons name="gift" size={20} color="#2D8B47" />
                <Text style={styles.rewardsBannerTitle}>Auto-Applied Rewards 🎉</Text>
              </View>
              <Text style={styles.rewardsBannerSubtitle}>
                Infrastructure ready for advanced reward algorithms
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <View style={styles.rewardDetails}>
                <Text style={styles.summaryText}>Current Tier Rewards</Text>
                <Text style={styles.tierBadge}>{rewardCalculation.new_tier_info?.tier_name || 'Base'}</Text>
              </View>
              <Text style={[styles.summaryValue, styles.discountText]}>
                -₹{rewardCalculation.rewards_auto_applied?.toFixed(2) || '0.00'}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>Will Earn (Cashback)</Text>
              <Text style={[styles.summaryValue, styles.earnText]}>
                +₹{rewardCalculation.order_cashback_earned?.toFixed(2) || '0.00'}
              </Text>
            </View>
            
            <View style={styles.infrastructureNote}>
              <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
              <Text style={styles.infrastructureText}>
                Ready for real API integration with external reward systems
              </Text>
            </View>
          </>
        )}
        
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalText}>{t('totalAmount')}</Text>
          <Text style={styles.totalValue}>
            ₹{rewardCalculation ? rewardCalculation.final_total?.toFixed(2) : subtotal.toFixed(2)}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.checkoutButton, loading && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={loading}
        >
          <Ionicons name="card" size={20} color="#fff" style={styles.checkoutIcon} />
          <Text style={styles.checkoutButtonText}>
            {t('checkout')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  clearText: { fontSize: 14, color: '#EF4444' },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#6B7280', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  itemList: { flex: 1, padding: 16 },
  cartItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 12 },
  productImage: { width: 60, height: 60, backgroundColor: '#E5E7EB', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  productDetails: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 16, fontWeight: '600', color: '#111' },
  productPrice: { fontSize: 14, color: '#2D8B47', marginTop: 4 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantityButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#2D8B47', alignItems: 'center', justifyContent: 'center' },
  quantityText: { fontSize: 16, fontWeight: '600', color: '#111', minWidth: 24, textAlign: 'center' },
  summary: { padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryText: { fontSize: 16, color: '#6B7280' },
  summaryValue: { fontSize: 16, color: '#111' },
  discountText: { color: '#2D8B47', fontWeight: '600' },
  earnText: { color: '#FF8C42', fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, marginTop: 8 },
  totalText: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  
  // Auto-Rewards UI
  rewardsBanner: { 
    backgroundColor: '#ECFDF5', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D8B47'
  },
  rewardsBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rewardsBannerTitle: { fontSize: 14, fontWeight: '600', color: '#2D8B47' },
  rewardsBannerSubtitle: { fontSize: 11, color: '#6B7280', fontStyle: 'italic' },
  
  rewardDetails: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierBadge: { 
    backgroundColor: '#FF8C42', 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: 'bold', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  
  infrastructureNote: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: '#F9FAFB', 
    padding: 8, 
    borderRadius: 6, 
    marginBottom: 8 
  },
  infrastructureText: { fontSize: 11, color: '#6B7280', flex: 1, fontStyle: 'italic' },
  
  checkoutButton: { 
    backgroundColor: '#2D8B47', 
    paddingVertical: 16, 
    borderRadius: 12, 
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  checkoutButtonDisabled: { opacity: 0.5 },
  checkoutIcon: { marginRight: 4 },
  checkoutButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
