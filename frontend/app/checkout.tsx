import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, clearCart } = useCartStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Address state
  const [address, setAddress] = useState({
    fullAddress: user?.address || '',
    city: user?.city || '',
    pincode: user?.pincode || '',
    phone: user?.phone || '',
  });
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('');
  
  // Cart details
  const [cartDetails, setCartDetails] = useState<any[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const deliveryFee = 40;

  useEffect(() => {
    loadCartDetails();
  }, [items]);

  const loadCartDetails = async () => {
    try {
      const response = await api.get('/cart');
      const cart = response.data;
      setCartDetails(cart.items || []);
      
      // Calculate subtotal
      const total = (cart.items || []).reduce((sum: number, item: any) => 
        sum + (item.price * item.quantity), 0
      );
      setSubtotal(total);
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  };

  const validateAddress = () => {
    if (!address.fullAddress || address.fullAddress.length < 10) {
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
        items: cartDetails.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          name: item.name
        })),
        delivery_address: `${address.fullAddress}, ${address.city}, ${address.pincode}`,
        phone: address.phone,
        payment_method: paymentMethod,
        total: subtotal + deliveryFee
      };

      const response = await api.post('/orders', orderData);
      
      // Clear cart
      await clearCart();
      
      // Show success and navigate
      Alert.alert(
        'Order Placed! 🎉',
        `Order ID: ${response.data.order_id}\nEstimated delivery: 30-40 minutes`,
        [
          {
            text: 'View Order',
            onPress: () => router.push('/orders')
          },
          {
            text: 'Continue Shopping',
            onPress: () => router.push('/(tabs)/home')
          }
        ]
      );
    } catch (error: any) {
      console.error('Order failed:', error);
      Alert.alert('Order Failed', error.response?.data?.detail || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  if (cartDetails.length === 0 && !loading) {
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(step - 1)}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout ({step}/3)</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={styles.stepContainer}>
            <View style={[styles.stepCircle, step >= s && styles.stepCircleActive]}>
              <Text style={[styles.stepNumber, step >= s && styles.stepNumberActive]}>{s}</Text>
            </View>
            {s < 3 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
          </View>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* Step 1: Review Cart */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Review Your Order</Text>
            {cartDetails.map((item, index) => (
              <View key={index} style={styles.cartItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
              </View>
            ))}
            
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₹{subtotal}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>₹{deliveryFee}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₹{subtotal + deliveryFee}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.nextButton}
              onPress={() => setStep(2)}
            >
              <Text style={styles.nextButtonText}>Proceed to Address</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Delivery Address */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Delivery Address</Text>
            
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

            <TouchableOpacity 
              style={styles.nextButton}
              onPress={() => {
                if (validateAddress()) {
                  setStep(3);
                }
              }}
            >
              <Text style={styles.nextButtonText}>Proceed to Payment</Text>
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
                <Ionicons name="cash-outline" size={24} color="#2D8B47" />
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>Cash on Delivery</Text>
                  <Text style={styles.paymentSubtitle}>Pay when you receive</Text>
                </View>
              </View>
              {paymentMethod === 'COD' && <Ionicons name="checkmark-circle" size={24} color="#2D8B47" />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.paymentOption, paymentMethod === 'ONLINE' && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod('ONLINE')}
            >
              <View style={styles.paymentLeft}>
                <Ionicons name="card-outline" size={24} color="#3B82F6" />
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>Online Payment</Text>
                  <Text style={styles.paymentSubtitle}>UPI, Cards, Net Banking</Text>
                </View>
              </View>
              {paymentMethod === 'ONLINE' && <Ionicons name="checkmark-circle" size={24} color="#2D8B47" />}
            </TouchableOpacity>

            <View style={styles.orderSummary}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <Text style={styles.summaryDetail}>Items: {cartDetails.length}</Text>
              <Text style={styles.summaryDetail}>Total: ₹{subtotal + deliveryFee}</Text>
              <Text style={styles.summaryDetail}>Address: {address.city}, {address.pincode}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.placeOrderButton, loading && styles.placeOrderButtonDisabled]}
              onPress={handlePlaceOrder}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.placeOrderButtonText}>Place Order - ₹{subtotal + deliveryFee}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  stepContainer: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: '#2D8B47' },
  stepNumber: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  stepNumberActive: { color: '#fff' },
  stepLine: { width: 60, height: 2, backgroundColor: '#E5E7EB' },
  stepLineActive: { backgroundColor: '#2D8B47' },
  
  content: { flex: 1, padding: 16 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '500', color: '#111' },
  itemQuantity: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  itemPrice: { fontSize: 16, fontWeight: '600', color: '#2D8B47' },
  
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '500', color: '#111' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#2D8B47' },
  
  formGroup: { marginBottom: 16 },
  formRow: { flexDirection: 'row' },
  label: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111',
  },
  
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  paymentOptionSelected: { borderColor: '#2D8B47', backgroundColor: '#ECFDF5' },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  paymentInfo: { marginLeft: 12, flex: 1 },
  paymentTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  paymentSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  
  orderSummary: {
    backgroundColor: '#FFF7ED',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 8 },
  summaryDetail: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  
  nextButton: {
    backgroundColor: '#2D8B47',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  placeOrderButton: {
    backgroundColor: '#FF8C42',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  placeOrderButtonDisabled: { opacity: 0.6 },
  placeOrderButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
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
