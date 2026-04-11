import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function CheckoutPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { items, clearCart } = useCartStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Address state
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [address, setAddress] = useState({
    fullAddress: user?.address || '',
    city: user?.city || '',
    pincode: user?.pincode || '',
    phone: user?.phone || '',
  });
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('');
  
  // Cart details with product info
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [rewardInfo, setRewardInfo] = useState<any>(null);
  const deliveryFee = 40;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setInitialLoading(true);
      await Promise.all([loadCartWithProducts(), loadSavedAddresses()]);
    } catch (error) {
      console.error('Failed to load checkout data:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadCartWithProducts = async () => {
    try {
      const cartResponse = await api.get('/cart');
      const cartItems = cartResponse.data.items || [];
      
      if (cartItems.length === 0) return;
      
      // Fetch product details for each cart item
      const enrichedItems = await Promise.all(
        cartItems.map(async (item: any) => {
          try {
            const productResponse = await api.get(`/products/${item.product_id}`);
            return {
              ...item,
              name: productResponse.data.name,
              price: productResponse.data.price,
              image: productResponse.data.image,
              unit: productResponse.data.unit,
            };
          } catch {
            return { ...item, name: 'Unknown Product', price: 0 };
          }
        })
      );
      
      setCartItems(enrichedItems);
      
      const total = enrichedItems.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity, 0
      );
      setSubtotal(total);
      
      // Calculate rewards
      try {
        const rewardResponse = await api.post('/checkout/calculate-rewards', { subtotal: total });
        setRewardInfo(rewardResponse.data);
      } catch (error) {
        console.error('Failed to calculate rewards:', error);
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  };

  const loadSavedAddresses = async () => {
    try {
      const response = await api.get('/user/addresses');
      const addresses = response.data.addresses || [];
      setSavedAddresses(addresses);
      
      // Auto-select default address
      const defaultAddr = addresses.find((a: any) => a.is_default);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
      } else if (addresses.length > 0) {
        setSelectedAddressId(addresses[0].id);
      }
    } catch (error) {
      console.error('Failed to load addresses:', error);
    }
  };

  const getDeliveryAddress = () => {
    if (selectedAddressId && !showNewAddress) {
      const addr = savedAddresses.find(a => a.id === selectedAddressId);
      if (addr) {
        return `${addr.address || addr.fullAddress || ''}, ${addr.city || ''}, ${addr.pincode || ''}`;
      }
    }
    return `${address.fullAddress}, ${address.city}, ${address.pincode}`;
  };

  const getDeliveryPhone = () => {
    if (selectedAddressId && !showNewAddress) {
      const addr = savedAddresses.find(a => a.id === selectedAddressId);
      return addr?.phone || address.phone;
    }
    return address.phone;
  };

  const validateAddress = () => {
    if (selectedAddressId && !showNewAddress) return true;
    
    if (!address.fullAddress || address.fullAddress.length < 5) {
      Alert.alert('Invalid Address', 'Please enter a complete delivery address');
      return false;
    }
    if (!address.city) {
      Alert.alert('Invalid City', 'Please enter your city');
      return false;
    }
    if (!address.pincode || address.pincode.length !== 6) {
      Alert.alert('Invalid Pincode', 'Please enter a valid 6-digit pincode');
      return false;
    }
    if (!address.phone || address.phone.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!paymentMethod) {
      Alert.alert('Select Payment', 'Please select a payment method');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
        })),
        subtotal: subtotal,
        delivery_address: getDeliveryAddress(),
        phone: getDeliveryPhone(),
        payment_method: paymentMethod,
      };

      const response = await api.post('/orders', orderData);
      
      // Clear cart
      await clearCart();
      await refreshUser();
      
      // Navigate to success page
      const orderResponse = response.data;
      router.replace({
        pathname: '/order-success',
        params: {
          orderId: orderResponse.id,
          total: String(orderResponse.total?.toFixed(2) || '0'),
          rewardUsed: String(orderResponse.rewards_breakdown?.rewards_used?.toFixed(2) || '0'),
          cashbackEarned: String(orderResponse.rewards_breakdown?.cashback_earned?.toFixed(2) || '0'),
          tier: orderResponse.rewards_breakdown?.new_tier || 'Base',
        },
      });
    } catch (error: any) {
      console.error('Order failed:', error);
      Alert.alert('Order Failed', error.response?.data?.detail || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D8B47" />
          <Text style={styles.loadingText}>Preparing checkout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Cart is Empty</Text>
          <Text style={styles.emptyText}>Add items to cart before checkout</Text>
          <TouchableOpacity 
            style={styles.shopButton}
            onPress={() => router.push('/(tabs)/home')}
          >
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const stepLabels = ['Review', 'Address', 'Payment'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(step - 1)}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={styles.stepWrapper}>
            <View style={styles.stepRow}>
              <View style={[styles.stepCircle, step >= s && styles.stepCircleActive]}>
                {step > s ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={[styles.stepNumber, step >= s && styles.stepNumberActive]}>{s}</Text>
                )}
              </View>
              {s < 3 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
            </View>
            <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>{stepLabels[s - 1]}</Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Step 1: Review Cart */}
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>Review Your Order</Text>
              {cartItems.map((item, index) => (
                <View key={index} style={styles.cartItem}>
                  <View style={styles.cartItemIcon}>
                    <Ionicons name="bag-outline" size={24} color="#2D8B47" />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemQty}>Qty: {item.quantity} {item.unit ? `• ${item.unit}` : ''}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₹{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
              
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal ({cartItems.length} items)</Text>
                  <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>₹{deliveryFee}</Text>
                </View>
                
                {rewardInfo && rewardInfo.rewards_auto_applied > 0 && (
                  <View style={styles.summaryRow}>
                    <View style={styles.rewardRow}>
                      <Ionicons name="gift" size={16} color="#2D8B47" />
                      <Text style={styles.rewardLabel}>Rewards Applied</Text>
                    </View>
                    <Text style={styles.rewardValue}>-₹{rewardInfo.rewards_auto_applied.toFixed(2)}</Text>
                  </View>
                )}
                
                {rewardInfo && rewardInfo.order_cashback_earned > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.cashbackLabel}>Cashback you'll earn</Text>
                    <Text style={styles.cashbackValue}>+₹{rewardInfo.order_cashback_earned.toFixed(2)}</Text>
                  </View>
                )}
                
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    ₹{((rewardInfo?.final_total || subtotal) + deliveryFee).toFixed(2)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.nextButton}
                onPress={() => setStep(2)}
              >
                <Text style={styles.nextButtonText}>Proceed to Address</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Delivery Address */}
          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>Delivery Address</Text>
              
              {/* Saved Addresses */}
              {savedAddresses.length > 0 && !showNewAddress && (
                <View>
                  <Text style={styles.sectionLabel}>Saved Addresses</Text>
                  {savedAddresses.map((addr) => (
                    <TouchableOpacity
                      key={addr.id}
                      style={[
                        styles.addressCard,
                        selectedAddressId === addr.id && styles.addressCardSelected,
                      ]}
                      onPress={() => setSelectedAddressId(addr.id)}
                    >
                      <View style={styles.addressRadio}>
                        <View style={[styles.radio, selectedAddressId === addr.id && styles.radioSelected]}>
                          {selectedAddressId === addr.id && <View style={styles.radioInner} />}
                        </View>
                      </View>
                      <View style={styles.addressContent}>
                        <View style={styles.addressHeader}>
                          <Text style={styles.addressLabel}>{addr.label || 'Home'}</Text>
                          {addr.is_default && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.addressText} numberOfLines={2}>
                          {addr.address || addr.fullAddress}, {addr.city}, {addr.pincode}
                        </Text>
                        {addr.phone && <Text style={styles.addressPhone}>{addr.phone}</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  <TouchableOpacity
                    style={styles.addNewButton}
                    onPress={() => {
                      setShowNewAddress(true);
                      setSelectedAddressId(null);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#2D8B47" />
                    <Text style={styles.addNewButtonText}>Add New Address</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* New Address Form */}
              {(savedAddresses.length === 0 || showNewAddress) && (
                <View>
                  {showNewAddress && (
                    <TouchableOpacity
                      style={styles.backToSaved}
                      onPress={() => {
                        setShowNewAddress(false);
                        if (savedAddresses.length > 0) {
                          setSelectedAddressId(savedAddresses[0].id);
                        }
                      }}
                    >
                      <Ionicons name="arrow-back" size={16} color="#2D8B47" />
                      <Text style={styles.backToSavedText}>Back to saved addresses</Text>
                    </TouchableOpacity>
                  )}
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Full Address *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="House no, Building name, Street"
                      value={address.fullAddress}
                      onChangeText={(text) => setAddress({ ...address, fullAddress: text })}
                      multiline
                    />
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.label}>City *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="City"
                        value={address.city}
                        onChangeText={(text) => setAddress({ ...address, city: text })}
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={styles.label}>Pincode *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="000000"
                        value={address.pincode}
                        onChangeText={(text) => setAddress({ ...address, pincode: text })}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Phone Number *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="10-digit mobile number"
                      value={address.phone}
                      onChangeText={(text) => setAddress({ ...address, phone: text })}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity 
                style={styles.nextButton}
                onPress={() => {
                  if (validateAddress()) setStep(3);
                }}
              >
                <Text style={styles.nextButtonText}>Proceed to Payment</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: Payment Method */}
          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>Select Payment Method</Text>

              <TouchableOpacity 
                style={[styles.paymentOption, paymentMethod === 'COD' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('COD')}
              >
                <View style={styles.paymentLeft}>
                  <View style={[styles.paymentIconBg, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="cash-outline" size={24} color="#2D8B47" />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentTitle}>Cash on Delivery</Text>
                    <Text style={styles.paymentSubtitle}>Pay when you receive your order</Text>
                  </View>
                </View>
                <View style={[styles.paymentRadio, paymentMethod === 'COD' && styles.paymentRadioSelected]}>
                  {paymentMethod === 'COD' && <View style={styles.paymentRadioInner} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.paymentOption, paymentMethod === 'ONLINE' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('ONLINE')}
              >
                <View style={styles.paymentLeft}>
                  <View style={[styles.paymentIconBg, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="card-outline" size={24} color="#3B82F6" />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentTitle}>Online Payment</Text>
                    <Text style={styles.paymentSubtitle}>UPI, Cards, Net Banking</Text>
                  </View>
                </View>
                <View style={[styles.paymentRadio, paymentMethod === 'ONLINE' && styles.paymentRadioSelected]}>
                  {paymentMethod === 'ONLINE' && <View style={styles.paymentRadioInner} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.paymentOption, paymentMethod === 'WALLET' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('WALLET')}
              >
                <View style={styles.paymentLeft}>
                  <View style={[styles.paymentIconBg, { backgroundColor: '#FFF7ED' }]}>
                    <Ionicons name="wallet-outline" size={24} color="#FF8C42" />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentTitle}>GrocerEase Wallet</Text>
                    <Text style={styles.paymentSubtitle}>Balance: ₹{user?.current_reward || 0}</Text>
                  </View>
                </View>
                <View style={[styles.paymentRadio, paymentMethod === 'WALLET' && styles.paymentRadioSelected]}>
                  {paymentMethod === 'WALLET' && <View style={styles.paymentRadioInner} />}
                </View>
              </TouchableOpacity>

              {/* Order Summary */}
              <View style={styles.finalSummary}>
                <Text style={styles.finalSummaryTitle}>Order Summary</Text>
                
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Items ({cartItems.length})</Text>
                  <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery</Text>
                  <Text style={styles.summaryValue}>₹{deliveryFee}</Text>
                </View>
                {rewardInfo && rewardInfo.rewards_auto_applied > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.rewardLabel}>Rewards</Text>
                    <Text style={styles.rewardValue}>-₹{rewardInfo.rewards_auto_applied.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    ₹{((rewardInfo?.final_total || subtotal) + deliveryFee).toFixed(2)}
                  </Text>
                </View>
                
                <View style={styles.addressSummary}>
                  <Ionicons name="location" size={16} color="#6B7280" />
                  <Text style={styles.addressSummaryText} numberOfLines={2}>
                    {getDeliveryAddress()}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.placeOrderButton, loading && styles.placeOrderButtonDisabled]}
                onPress={handlePlaceOrder}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.placeOrderButtonText}>
                      Place Order • ₹{((rewardInfo?.final_total || subtotal) + deliveryFee).toFixed(2)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  stepWrapper: { alignItems: 'center', flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: '#2D8B47' },
  stepNumber: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  stepNumberActive: { color: '#fff' },
  stepLine: { width: 48, height: 2, backgroundColor: '#E5E7EB' },
  stepLineActive: { backgroundColor: '#2D8B47' },
  stepLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  stepLabelActive: { color: '#2D8B47', fontWeight: '500' },
  
  content: { flex: 1, padding: 16 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  
  // Cart Items
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
  },
  cartItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '500', color: '#111' },
  itemQty: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '600', color: '#2D8B47' },
  
  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '500', color: '#111' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rewardLabel: { fontSize: 14, color: '#2D8B47' },
  rewardValue: { fontSize: 14, fontWeight: '600', color: '#2D8B47' },
  cashbackLabel: { fontSize: 13, color: '#FF8C42', fontStyle: 'italic' },
  cashbackValue: { fontSize: 13, fontWeight: '600', color: '#FF8C42' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#2D8B47' },
  
  // Address
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 12 },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  addressCardSelected: { borderColor: '#2D8B47', backgroundColor: '#FAFFFE' },
  addressRadio: { marginRight: 12, paddingTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#2D8B47' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2D8B47' },
  addressContent: { flex: 1 },
  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addressLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
  defaultBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  defaultBadgeText: { fontSize: 10, color: '#2D8B47', fontWeight: '600' },
  addressText: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  addressPhone: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D8B47',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addNewButtonText: { fontSize: 14, color: '#2D8B47', fontWeight: '500' },
  backToSaved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backToSavedText: { fontSize: 14, color: '#2D8B47', fontWeight: '500' },
  
  // Form
  formGroup: { marginBottom: 16 },
  formRow: { flexDirection: 'row' },
  label: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#111',
  },
  
  // Payment
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  paymentOptionSelected: { borderColor: '#2D8B47', backgroundColor: '#FAFFFE' },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  paymentIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentInfo: { flex: 1 },
  paymentTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  paymentSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  paymentRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRadioSelected: { borderColor: '#2D8B47' },
  paymentRadioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2D8B47' },
  
  // Final Summary
  finalSummary: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  finalSummaryTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 12 },
  addressSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  addressSummaryText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 18 },
  
  // Buttons
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2D8B47',
    padding: 16,
    borderRadius: 12,
  },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF8C42',
    padding: 18,
    borderRadius: 12,
  },
  placeOrderButtonDisabled: { opacity: 0.6 },
  placeOrderButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  
  // States
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: '#111', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 8 },
  shopButton: {
    marginTop: 24,
    backgroundColor: '#2D8B47',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
