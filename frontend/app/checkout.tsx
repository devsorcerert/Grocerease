import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL, RAZORPAY_KEY_ID } from '../constants/api';

type PaymentMethod = 'razorpay' | 'cod';
type OrderSummary = { subtotal: number; delivery_fee: number; rewards_discount: number; total: number; rewards_earned: number; tier: string; };

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ cart_total?: string }>();
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [razorpayUrl, setRazorpayUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const res = await axios.get(`${API_BASE_URL}/api/checkout/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSummary(res.data);
    } catch {
      Alert.alert('Error', 'Could not load order summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handlePlaceOrder = async () => {
    if (!address.trim()) { Alert.alert('Address Required', 'Please enter your delivery address.'); return; }
    setPlacing(true);
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const res = await axios.post(
        `${API_BASE_URL}/api/orders/create`,
        { delivery_address: address, payment_method: paymentMethod },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newOrderId = res.data.order_id;
      setOrderId(newOrderId);

      if (paymentMethod === 'cod') {
        router.replace({ pathname: '/order-success', params: { order_id: newOrderId, payment: 'cod' } });
        return;
      }

      // Razorpay: create payment order on backend
      const payRes = await axios.post(
        `${API_BASE_URL}/api/payments/razorpay/create`,
        { order_id: newOrderId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { razorpay_order_id, amount, currency } = payRes.data;

      // Build inline HTML for Razorpay Checkout (WebView approach — works without native SDK)
      const html = buildRazorpayHtml({ razorpay_order_id, amount, currency, orderId: newOrderId });
      setRazorpayUrl(html);
    } catch (err: any) {
      Alert.alert('Order Failed', err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'success') {
        const token = await SecureStore.getItemAsync('access_token');
        await axios.post(
          `${API_BASE_URL}/api/payments/razorpay/verify`,
          {
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
            order_id: orderId,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRazorpayUrl(null);
        router.replace({ pathname: '/order-success', params: { order_id: orderId!, payment: 'razorpay' } });
      } else if (data.status === 'dismissed') {
        setRazorpayUrl(null);
        Alert.alert('Payment Cancelled', 'Your payment was cancelled. Your order has been saved — you can retry from Orders.');
      } else if (data.status === 'failed') {
        setRazorpayUrl(null);
        Alert.alert('Payment Failed', data.error || 'Payment failed. Please try again.');
      }
    } catch {
      setRazorpayUrl(null);
    }
  };

  if (razorpayUrl) {
    return (
      <View style={{ flex: 1 }}>
        <WebView
          source={{ html: razorpayUrl }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          style={{ flex: 1 }}
        />
      </View>
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.heading}>Checkout</Text>

      {/* Delivery Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Delivery Address</Text>
        <TextInput
          style={styles.addressInput}
          placeholder="House no, Street, Area, Tirupati..."
          multiline
          numberOfLines={3}
          value={address}
          onChangeText={setAddress}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Order Summary */}
      {summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧾 Order Summary</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>₹{summary.subtotal.toFixed(2)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery Fee</Text><Text style={styles.summaryValue}>₹{summary.delivery_fee.toFixed(2)}</Text></View>
          {summary.rewards_discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, styles.green]}>🎁 Rewards Discount ({summary.tier})</Text>
              <Text style={[styles.summaryValue, styles.green]}>-₹{summary.rewards_discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{summary.total.toFixed(2)}</Text>
          </View>
          {summary.rewards_earned > 0 && (
            <View style={styles.rewardsBadge}>
              <Text style={styles.rewardsBadgeText}>✨ You'll earn ₹{summary.rewards_earned.toFixed(2)} cashback on this order</Text>
            </View>
          )}
        </View>
      )}

      {/* Payment Method */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💳 Payment Method</Text>
        <TouchableOpacity
          style={[styles.payOption, paymentMethod === 'razorpay' && styles.payOptionSelected]}
          onPress={() => setPaymentMethod('razorpay')}
        >
          <View style={[styles.radio, paymentMethod === 'razorpay' && styles.radioSelected]} />
          <View>
            <Text style={styles.payLabel}>UPI / Card / Netbanking</Text>
            <Text style={styles.paySubLabel}>Powered by Razorpay — secure & instant</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.payOption, paymentMethod === 'cod' && styles.payOptionSelected]}
          onPress={() => setPaymentMethod('cod')}
        >
          <View style={[styles.radio, paymentMethod === 'cod' && styles.radioSelected]} />
          <View>
            <Text style={styles.payLabel}>Cash on Delivery</Text>
            <Text style={styles.paySubLabel}>Pay when your order arrives</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.placeBtn, placing && styles.disabledBtn]}
        onPress={handlePlaceOrder}
        disabled={placing}
      >
        {placing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.placeBtnText}>
            {paymentMethod === 'cod' ? '✅ Place Order (COD)' : '🔒 Pay ₹' + (summary?.total.toFixed(2) || '0')}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function buildRazorpayHtml({ razorpay_order_id, amount, currency, orderId }: any) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body style="background:#F0FDF4;display:flex;align-items:center;justify-content:center;height:100vh;">
<script>
var options = {
  key: "${RAZORPAY_KEY_ID}",
  amount: "${amount}",
  currency: "${currency}",
  name: "GrocerEase",
  description: "Grocery Order #${orderId}",
  order_id: "${razorpay_order_id}",
  prefill: {},
  theme: { color: "#2D8B47" },
  handler: function(response) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      status: "success",
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature
    }));
  },
  modal: {
    ondismiss: function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ status: "dismissed" }));
    }
  }
};
var rzp = new Razorpay(options);
rzp.on("payment.failed", function(response) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ status: "failed", error: response.error.description }));
});
rzp.open();
</script>
</body>
</html>`;
}

const BRAND = '#2D8B47';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20 },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  addressInput: { borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827', minHeight: 80, textAlignVertical: 'top' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: '#6B7280', fontSize: 14 },
  summaryValue: { color: '#111827', fontSize: 14, fontWeight: '500' },
  green: { color: BRAND, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  totalLabel: { fontSize: 17, fontWeight: '800', color: '#111827' },
  totalValue: { fontSize: 17, fontWeight: '800', color: '#111827' },
  rewardsBadge: { backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginTop: 10 },
  rewardsBadgeText: { color: BRAND, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  payOption: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, marginBottom: 10 },
  payOptionSelected: { borderColor: BRAND, backgroundColor: '#F0FDF4' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB' },
  radioSelected: { borderColor: BRAND, backgroundColor: BRAND },
  payLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  paySubLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  placeBtn: { backgroundColor: BRAND, paddingVertical: 17, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  disabledBtn: { opacity: 0.6 },
  placeBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
