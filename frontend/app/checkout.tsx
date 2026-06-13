/**
 * GrocerEase — Checkout Screen
 * Fixes applied:
 *   [1] Razorpay payment gate — order only confirmed after real payment verification
 *   [2] Rewards auto-apply removed — rewards shown as earned info only, NOT deducted
 *   [4] Saved addresses — auto-detect location, match to saved, pick or add new
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { useTranslation } from '../context/LanguageContext';
import { RAZORPAY_KEY_ID } from '../constants/api';
import api from '../utils/api';

type PaymentMethod = 'razorpay' | 'cod';

type SavedAddress = {
  id: string;
  label: string;
  full_address: string;
  landmark?: string;
  lat?: number;
  lng?: number;
};

type OrderSummary = {
  subtotal: number;
  delivery_fee: number;
  total: number;
  discount: number;
  rewards_will_earn: number; // FIX [2]: only shows what user WILL earn, not auto-deducted
  tier: string;
};

const BRAND = '#2D8B47';

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // FIX [1]: payment gate state — order only marked paid after Razorpay verification
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [razorpayHtml, setRazorpayHtml] = useState<string | null>(null);
  const [paymentVerified, setPaymentVerified] = useState(false);

  // FIX [4]: address management
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('Home');
  const [newLandmark, setNewLandmark] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // ── Load summary ────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async (code?: string) => {
    try {
      const url = code ? `/checkout/summary?coupon_code=${code}` : '/checkout/summary';
      const res = await api.get(url);
      setSummary(res.data);
      if (code) {
        setAppliedCoupon(code);
        setCouponError(null);
      }
    } catch (err: any) {
      if (code) {
        setCouponError(err?.response?.data?.detail || 'Invalid coupon');
        setAppliedCoupon(null);
        // fallback
        const fallbackRes = await api.get('/checkout/summary');
        setSummary(fallbackRes.data);
      } else {
        Alert.alert('Error', 'Could not load order summary.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    setLoading(true);
    fetchSummary(couponCode.trim());
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError(null);
    setLoading(true);
    fetchSummary();
  };

  // ── Load saved addresses ────────────────────────────────────────────────
  const fetchSavedAddresses = useCallback(async () => {
    try {
      const res = await api.get('/user/addresses');
      setSavedAddresses(res.data.addresses || []);
      if (res.data.addresses?.length > 0) {
        setSelectedAddress(res.data.addresses[0]);
      }
    } catch (error: any) {
      console.warn('Could not load saved addresses:', error?.message || error);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchSavedAddresses();
    autoDetectAndMatch();
  }, []);

  // ── FIX [4]: auto-detect location & match nearest saved address ─────────
  const autoDetectAndMatch = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setDetectingLocation(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      // Ask backend to match nearest saved address for this geolocation
      const res = await api.post(
        '/user/addresses/nearest',
        { lat: latitude, lng: longitude }
      );
      if (res.data.matched_address) {
        setSelectedAddress(res.data.matched_address);
      }
    } catch (error: any) {
      console.log('Location detection skipped or failed:', error?.message || error);
    } finally {
      setDetectingLocation(false);
    }
  };

  // ── Save new address ────────────────────────────────────────────────────
  const handleSaveNewAddress = async () => {
    if (!newAddress.trim()) { Alert.alert('Required', 'Please enter an address.'); return; }
    setSavingAddress(true);
    try {
      let coords: { lat?: number; lng?: number } = {};
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }
      } catch (error: any) {
        console.warn('Geolocation auto-detect failed while saving address:', error?.message || error);
      }

      const res = await api.post(
        '/user/addresses',
        { label: newLabel, full_address: newAddress.trim(), landmark: newLandmark.trim(), ...coords }
      );
      const saved = res.data.address || res.data;
      setSavedAddresses(prev => [saved, ...prev]);
      setSelectedAddress(saved);
      setShowNewAddressForm(false);
      setNewAddress('');
      setNewLandmark('');
    } catch {
      Alert.alert('Error', 'Could not save address. Please try again.');
    } finally {
      setSavingAddress(false);
    }
  };

  // ── FIX [1]: Place order — for Razorpay, only create order (not confirm) ─
  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select or add a delivery address.');
      return;
    }
    setPlacing(true);
    try {
      if (paymentMethod === 'cod') {
        // COD: create + immediately confirm
        const res = await api.post(
          '/orders/create',
          { address_id: selectedAddress.id, payment_method: 'cod', coupon_code: appliedCoupon }
        );
        router.replace({ pathname: '/order-success', params: { order_id: res.data.order_id, payment: 'cod' } });
        return;
      }

      // FIX [1]: Razorpay — create a PENDING order first, DO NOT confirm yet
      const res = await api.post(
        '/orders/create-pending',
        { address_id: selectedAddress.id, payment_method: 'razorpay', coupon_code: appliedCoupon }
      );
      const newOrderId = res.data.order_id;
      setPendingOrderId(newOrderId);

      // Create Razorpay payment order
      const payRes = await api.post(
        '/payments/razorpay/create',
        { order_id: newOrderId }
      );
      const { razorpay_order_id, amount, currency } = payRes.data;

      // Open Razorpay WebView — order only confirmed in handleWebViewMessage after signature verified
      setRazorpayHtml(buildRazorpayHtml({ razorpay_order_id, amount, currency, orderId: newOrderId }));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  // ── FIX [1]: Only navigate to success AFTER backend signature verification ─
  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.status === 'success') {
        // CRITICAL: verify signature on backend BEFORE showing success
        await api.post(
          '/payments/razorpay/verify',
          {
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
            order_id: pendingOrderId,
          }
        );
        // Only here — after server confirms — do we navigate to success
        setRazorpayHtml(null);
        setPaymentVerified(true);
        router.replace({ pathname: '/order-success', params: { order_id: pendingOrderId!, payment: 'razorpay' } });

      } else if (data.status === 'dismissed') {
        setRazorpayHtml(null);
        // Cancel the pending order on backend
        try {
          await api.post(`/orders/${pendingOrderId}/cancel`, {});
        } catch (error: any) {
          console.warn('Failed to cancel pending order on server:', error?.message || error);
        }
        setPendingOrderId(null);
        Alert.alert('Payment Cancelled', 'Your payment was cancelled. Cart is still saved.');

      } else if (data.status === 'failed') {
        setRazorpayHtml(null);
        setPendingOrderId(null);
        Alert.alert('Payment Failed', data.error || 'Payment failed. Please try again.');
      }
    } catch (err: any) {
      setRazorpayHtml(null);
      Alert.alert('Verification Failed', 'Payment could not be verified. Contact support if money was deducted.');
    }
  };

  // ── Razorpay WebView ────────────────────────────────────────────────────
  if (razorpayHtml) {
    return (
      <View style={{ flex: 1 }}>
        <WebView
          source={{ html: razorpayHtml }}
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
      <Text style={styles.heading}>{t('checkout')}</Text>

      {/* ── FIX [4]: Saved Address Picker Inline ─────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📍 {t('deliveryAddress')}</Text>
          {detectingLocation && <Text style={styles.detectingText}>📡 Detecting location...</Text>}
        </View>

        {savedAddresses.length > 0 ? (
          <View style={styles.addressListContainer}>
            {savedAddresses.map((item) => {
              const isSelected = selectedAddress?.id === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.addressItemCard, isSelected && styles.addressItemCardSelected]}
                  onPress={() => setSelectedAddress(item)}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInnerCircle} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.addressCardHeader}>
                      <View style={[styles.addressBadge, isSelected && styles.addressBadgeActive]}>
                        <Text style={[styles.addressBadgeText, isSelected && styles.addressBadgeTextActive]}>{item.label}</Text>
                      </View>
                      {isSelected && <Text style={styles.selectedMarkerText}>Selected</Text>}
                    </View>
                    <Text style={styles.addressText}>{item.full_address}</Text>
                    {item.landmark ? (
                      <Text style={styles.addressLandmark}>Near: {item.landmark}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>{t('emptyAddresses')}</Text>
        )}

        {/* Inline Add Address Accordion Form */}
        {!showNewAddressForm ? (
          <TouchableOpacity
            style={styles.addAddressInlineBtn}
            onPress={() => setShowNewAddressForm(true)}
          >
            <Text style={styles.addAddressInlineBtnText}>+ Add New Address</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.inlineFormContainer}>
            <View style={styles.inlineFormHeader}>
              <Text style={styles.inlineFormTitle}>Add New Address</Text>
              <TouchableOpacity onPress={() => setShowNewAddressForm(false)}>
                <Text style={styles.inlineFormCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Label</Text>
            <View style={styles.labelRow}>
              {['Home', 'Work', 'Other'].map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.labelChip, newLabel === l && styles.labelChipSelected]}
                  onPress={() => setNewLabel(l)}
                >
                  <Text style={[styles.labelChipText, newLabel === l && styles.labelChipTextSelected]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Full Address *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="House no, Street, Area, Tirupati"
              multiline
              numberOfLines={3}
              value={newAddress}
              onChangeText={setNewAddress}
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />

            <Text style={styles.formLabel}>Landmark (optional)</Text>
            <TextInput
              style={[styles.formInput, { height: 48, minHeight: 48 }]}
              placeholder="Near temple, school, etc."
              value={newLandmark}
              onChangeText={setNewLandmark}
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity
              style={[styles.saveAddressBtn, savingAddress && styles.disabledBtn]}
              onPress={handleSaveNewAddress}
              disabled={savingAddress}
            >
              {savingAddress ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveAddressBtnText}>Save & Use Address</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Coupon Section ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎟️ Apply Coupon</Text>
        <View style={styles.couponRow}>
          <TextInput
            style={styles.couponInput}
            placeholder="Enter coupon code"
            value={couponCode}
            onChangeText={setCouponCode}
            autoCapitalize="characters"
          />
          {appliedCoupon ? (
            <TouchableOpacity style={styles.removeCouponBtn} onPress={handleRemoveCoupon}>
              <Text style={styles.removeCouponText}>Remove</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.applyCouponBtn} onPress={handleApplyCoupon}>
              <Text style={styles.applyCouponText}>Apply</Text>
            </TouchableOpacity>
          )}
        </View>
        {couponError && <Text style={styles.couponErrorText}>{couponError}</Text>}
        {appliedCoupon && !couponError && <Text style={styles.couponSuccessText}>Coupon applied successfully!</Text>}
      </View>

      {/* ── Order Summary ─────────────────────────────────────────── */}
      {summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧾 {t('orderSummary')}</Text>
          <View style={styles.row}><Text style={styles.label}>{t('subtotal')}</Text><Text style={styles.value}>₹{summary.subtotal.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>{t('deliveryFee')}</Text><Text style={styles.value}>₹{summary.delivery_fee.toFixed(2)}</Text></View>
          {summary.discount > 0 && (
            <View style={styles.row}><Text style={styles.label}>Discount</Text><Text style={[styles.value, {color: '#10B981'}]}>-₹{summary.discount.toFixed(2)}</Text></View>
          )}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>{t('totalAmount')}</Text>
            <Text style={styles.totalValue}>₹{summary.total.toFixed(2)}</Text>
          </View>
          {/* Rewards shown as what they WILL earn */}
          {summary.rewards_will_earn > 0 && (
            <View style={styles.rewardsBadge}>
              <Text style={styles.rewardsBadgeText}>
                ✨ {t('rewardsWillEarn')}: ₹{summary.rewards_will_earn.toFixed(2)} ({summary.tier} tier)
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Payment Method ──────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💳 {t('selectPaymentMethod')}</Text>
        {(['razorpay', 'cod'] as PaymentMethod[]).map(method => (
          <TouchableOpacity
            key={method}
            style={[styles.payOption, paymentMethod === method && styles.payOptionSelected]}
            onPress={() => setPaymentMethod(method)}
          >
            <View style={[styles.radio, paymentMethod === method && styles.radioSelected]} />
            <View>
              <Text style={styles.payLabel}>{method === 'razorpay' ? t('payOnlineRazorpay') : t('cashOnDelivery')}</Text>
              <Text style={styles.paySubLabel}>{method === 'razorpay' ? 'Powered by Razorpay — secure & instant' : 'Pay when your order arrives'}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.placeBtn, (placing || !selectedAddress) && styles.disabledBtn]}
        onPress={handlePlaceOrder}
        disabled={placing || !selectedAddress}
      >
        {placing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.placeBtnText}>
            {paymentMethod === 'cod' ? `✅ ${t('placeOrder')} (COD)` : `🔒 ${t('checkout')} ₹${summary?.total.toFixed(2) || '0'}`}
          </Text>
        )}
      </TouchableOpacity>


    </ScrollView>
  );
}

function buildRazorpayHtml({ razorpay_order_id, amount, currency, orderId }: any) {
  const isMock = razorpay_order_id.startsWith("rzp_mock_");
  
  if (isMock) {
    if (!__DEV__) {
      return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FEE2E2;color:#991B1B;font-family:sans-serif"><div style="padding:20px;text-align:center;border:1px solid #FCA5A5;background:#FFF5F5;border-radius:8px"><h2>Payment Error</h2><p>Mock payments are disabled in production builds.</p></div></body></html>`;
    }
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #F0FDF4;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #1E293B;
    }
    .card {
      background: #FFFFFF;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      text-align: center;
      max-width: 320px;
      width: 90%;
      border: 1px solid #E2E8F0;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: #2D8B47;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 13px;
      color: #64748B;
      margin-bottom: 20px;
    }
    .loader {
      border: 4px solid #F1F5F9;
      border-top: 4px solid #2D8B47;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="loader"></div>
    <div class="title">Secure Mock Payment Gateway</div>
    <div class="subtitle">Simulating transaction for Order #${orderId.slice(0, 8)}...</div>
  </div>
  <script>
    setTimeout(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        status: "success",
        razorpay_order_id: "${razorpay_order_id}",
        razorpay_payment_id: "pay_mock_" + Math.random().toString(36).substring(2, 10),
        razorpay_signature: "sig_mock_" + Math.random().toString(36).substring(2, 10)
      }));
    }, 1500);
  </script>
</body>
</html>`;
  }

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0"><script src="https://checkout.razorpay.com/v1/checkout.js"></script></head><body style="margin:0;background:#F0FDF4;display:flex;align-items:center;justify-content:center;min-height:100vh"><script>
(function(){
  var rzp = new Razorpay({
    key:"${RAZORPAY_KEY_ID}",
    amount:"${amount}",
    currency:"${currency}",
    name:"GrocerEase",
    description:"Grocery Order",
    order_id:"${razorpay_order_id}",
    theme:{color:"#2D8B47"},
    handler:function(r){
      window.ReactNativeWebView.postMessage(JSON.stringify({
        status:"success",
        razorpay_order_id:r.razorpay_order_id,
        razorpay_payment_id:r.razorpay_payment_id,
        razorpay_signature:r.razorpay_signature
      }));
    },
    modal:{
      ondismiss:function(){
        window.ReactNativeWebView.postMessage(JSON.stringify({status:"dismissed"}));
      }
    }
  });
  rzp.on("payment.failed",function(r){
    window.ReactNativeWebView.postMessage(JSON.stringify({status:"failed",error:r.error.description}));
  });
  rzp.open();
})();
</script></body></html>`;
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#F9FAFB' },
  scroll:{ padding:20, paddingBottom:48 },
  center:{ flex:1, justifyContent:'center', alignItems:'center' },
  heading:{ fontSize:24, fontWeight:'800', color:'#111827', marginBottom:20 },
  section:{ backgroundColor:'#fff', borderRadius:14, padding:18, marginBottom:16, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:8, elevation:2 },
  sectionHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  sectionTitle:{ fontSize:15, fontWeight:'700', color:'#111827' },
  detectingText:{ fontSize:12, color:'#6B7280' },
  addressListContainer: { gap: 12, marginBottom: 12 },
  addressItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  addressItemCardSelected: {
    borderColor: BRAND,
    backgroundColor: '#F0FDF4',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: BRAND,
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND,
  },
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  addressBadgeActive: {
    backgroundColor: BRAND,
  },
  addressBadgeText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
  },
  addressBadgeTextActive: {
    color: '#FFFFFF',
  },
  selectedMarkerText: {
    fontSize: 12,
    color: BRAND,
    fontWeight: '700',
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    lineHeight: 18,
    flex: 1,
  },
  addressLandmark: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  addAddressInlineBtn: {
    borderWidth: 1.5,
    borderColor: BRAND,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  addAddressInlineBtnText: {
    color: BRAND,
    fontWeight: '700',
    fontSize: 14,
  },
  inlineFormContainer: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    backgroundColor: '#FAFAFA',
  },
  inlineFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  inlineFormTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  inlineFormCloseText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  saveAddressBtn: {
    backgroundColor: BRAND,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  saveAddressBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  row:{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  totalRow:{ borderTopWidth:1, borderTopColor:'#F3F4F6', paddingTop:10, marginTop:4 },
  label:{ color:'#6B7280', fontSize:14 },
  value:{ color:'#111827', fontSize:14, fontWeight:'500' },
  totalLabel:{ fontSize:17, fontWeight:'800', color:'#111827' },
  totalValue:{ fontSize:17, fontWeight:'800', color:BRAND },
  rewardsBadge:{ backgroundColor:'#F0FDF4', borderRadius:8, padding:10, marginTop:10 },
  rewardsBadgeText:{ color:BRAND, fontSize:13, fontWeight:'600', textAlign:'center' },
  payOption:{ flexDirection:'row', alignItems:'center', gap:14, borderWidth:1.5, borderColor:'#E5E7EB', borderRadius:12, padding:14, marginBottom:10 },
  payOptionSelected:{ borderColor:BRAND, backgroundColor:'#F0FDF4' },
  radio:{ width:20, height:20, borderRadius:10, borderWidth:2, borderColor:'#D1D5DB' },
  radioSelected:{ borderColor:BRAND, backgroundColor:BRAND },
  payLabel:{ fontSize:15, fontWeight:'600', color:'#111827' },
  paySubLabel:{ fontSize:12, color:'#6B7280', marginTop:2 },
  placeBtn:{ backgroundColor:BRAND, paddingVertical:17, borderRadius:14, alignItems:'center', marginTop:8 },
  disabledBtn:{ opacity:0.6 },
  placeBtnText:{ color:'#fff', fontSize:17, fontWeight:'800' },
  emptyText:{ textAlign:'center', color:'#9CA3AF', padding:20 },
  formLabel:{ fontSize:13, fontWeight:'600', color:'#374151', marginBottom:6, marginTop:12 },
  formInput:{ borderWidth:1.5, borderColor:'#D1FAE5', borderRadius:10, padding:12, fontSize:14, color:'#111827', minHeight:80 },
  labelRow:{ flexDirection:'row', gap:10 },
  labelChip:{ paddingHorizontal:16, paddingVertical:8, borderRadius:20, borderWidth:1.5, borderColor:'#E5E7EB' },
  labelChipSelected:{ borderColor:BRAND, backgroundColor:'#F0FDF4' },
  labelChipText:{ color:'#6B7280', fontWeight:'600' },
  labelChipTextSelected:{ color:BRAND },
  couponRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  couponInput: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, fontSize: 14 },
  applyCouponBtn: { backgroundColor: '#10B981', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 10 },
  applyCouponText: { color: '#fff', fontWeight: '700' },
  removeCouponBtn: { backgroundColor: '#EF4444', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 10 },
  removeCouponText: { color: '#fff', fontWeight: '700' },
  couponErrorText: { color: '#EF4444', fontSize: 13, marginTop: 6 },
  couponSuccessText: { color: '#10B981', fontSize: 13, marginTop: 6, fontWeight: '500' },
});
