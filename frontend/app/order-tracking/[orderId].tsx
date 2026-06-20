import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, ScrollView, RefreshControl } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useTranslation } from '../../context/LanguageContext';

interface TrackingUpdate {
  timestamp: string;
  status: string;
  message: string;
}

const STATUS_STEPS = [
  { key: 'confirmed', label: 'Order Confirmed', icon: 'checkmark-circle', description: 'Your order has been received' },
  { key: 'preparing', label: 'Preparing', icon: 'restaurant', description: 'Items are being packed' },
  { key: 'picked_up', label: 'Picked Up', icon: 'bicycle', description: 'Delivery partner has picked up your order' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: 'navigate', description: 'Your order is on the way' },
  { key: 'delivered', label: 'Delivered', icon: 'home', description: 'Order delivered successfully' },
];

const STATUS_INDEX: Record<string, number> = {
  confirmed: 0,
  preparing: 1,
  picked_up: 2,
  out_for_delivery: 3,
  delivered: 4,
  cancelled: -1,
};

export default function OrderTrackingPage() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const { t } = useTranslation();
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const TERMINAL_STATUSES = ['delivered', 'cancelled'];

  useEffect(() => {
    fetchTracking(true);
    
    // Don't poll if already in terminal state
    if (TERMINAL_STATUSES.includes(tracking?.status)) return;
    
    const pollInterval = setInterval(() => {
      fetchTracking(false);
    }, 15000);
    
    return () => clearInterval(pollInterval);
  }, [orderId, tracking?.status]);

  const fetchTracking = async (showLoader = false) => {
    // BUG-03 fix: bail early if orderId is undefined — avoids "/orders/undefined/tracking" 404
    if (!orderId) {
      setLoading(false);
      if (showLoader) Alert.alert('Error', 'Invalid order ID. Please try again from the Orders page.');
      return;
    }
    try {
      if (showLoader || !tracking) {
        setLoading(true);
      }
      const response = await api.get(`/orders/${orderId}/tracking`);
      setTracking(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch tracking:', error);
      if (showLoader || !tracking) {
        Alert.alert('Error', 'Failed to load tracking information');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              await api.post(`/orders/${orderId}/cancel`);
              Alert.alert('Order Cancelled', 'Your order has been cancelled successfully.', [
                { text: 'OK', onPress: () => router.push('/orders') }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to cancel order');
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  const callDeliveryPartner = () => {
    if (tracking?.delivery_partner?.phone) {
      Linking.openURL(`tel:${tracking.delivery_partner.phone.replace(/\s/g, '')}`);
    }
  };

  if (loading && !tracking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D8B47" />
          <Text style={styles.loadingText}>Loading tracking info...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStatus = tracking?.status || 'confirmed';
  const currentStepIndex = STATUS_INDEX[currentStatus] ?? 0;
  const isCancelled = currentStatus === 'cancelled';
  const isDelivered = currentStatus === 'delivered';
  const canCancel = !isCancelled && !isDelivered && currentStepIndex <= 1;

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };


  // Build Leaflet/OSM map HTML — no API key needed
  const buildMapHtml = (address: string, riderLat?: number, riderLng?: number) => {
    const encodedAddr = encodeURIComponent(address || 'Tirupati, Andhra Pradesh, India');
    const riderMarker = (riderLat && riderLng)
      ? `var riderIcon = L.divIcon({className:'', html:'<div style="background:#2563EB;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>'});
         var riderMarker = L.marker([${riderLat ? riderLat.toFixed(6) : 'null'}, ${riderLng ? riderLng.toFixed(6) : 'null'}], {icon:riderIcon}).addTo(map);
         riderMarker.bindPopup('<b>Delivery Partner</b>');`
      : '';
    return `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>html,body,#map{margin:0;padding:0;height:100%;width:100%;}</style>
    </head><body>
      <div id="map"></div>
      <script>
        var map = L.map('map',{zoomControl:true,attributionControl:false});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
        map.setView([13.6288,79.4192],13);
        var delivIcon = L.divIcon({className:'',html:'<div style="background:#2D8B47;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>'});
        ${riderMarker}
        fetch('https://nominatim.openstreetmap.org/search?q=${encodedAddr}&format=json&limit=1')
          .then(r=>r.json()).then(data=>{
            if(data && data[0]){
              var lat=parseFloat(data[0].lat), lng=parseFloat(data[0].lon);
              var m=L.marker([lat,lng],{icon:delivIcon}).addTo(map);
              m.bindPopup('<b>Delivery Address</b><br>${address.replace(/'/g, "\'")}').openPopup();
              map.setView([lat,lng],15);
            }
          }).catch(()=>{});
      </script>
    </body></html>`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('trackOrder')}</Text>
        <TouchableOpacity onPress={() => fetchTracking(true)}>
          <Ionicons name="refresh" size={24} color="#2D8B47" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={() => fetchTracking(true)} 
            colors={['#2D8B47']}
            tintColor="#2D8B47"
          />
        }
      >
        {/* Order ID */}
        <View style={styles.orderIdCard}>
          <View style={styles.orderIdLeft}>
            <Text style={styles.orderIdLabel}>Order ID</Text>
            <Text style={styles.orderIdValue}>{orderId ? `#${String(orderId).slice(0, 8).toUpperCase()}` : "---"}</Text>
          </View>
          {tracking?.estimated_delivery && !isCancelled && !isDelivered && (
            <View style={styles.etaContainer}>
              <Ionicons name="time-outline" size={18} color="#FF8C42" />
              <Text style={styles.etaText}>
                ETA: {formatTime(tracking.estimated_delivery)}
              </Text>
            </View>
          )}
        </View>

        {/* Cancelled Banner */}
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="close-circle" size={24} color="#DC2626" />
            <View style={styles.cancelledContent}>
              <Text style={styles.cancelledTitle}>Order Cancelled</Text>
              <Text style={styles.cancelledText}>This order has been cancelled.</Text>
              {tracking?.payment_status === 'refund_pending' && (
                <Text style={[styles.cancelledText, { color: '#D97706', fontWeight: 'bold' }]}>
                  Your refund has been initiated.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Delivered Banner */}
        {isDelivered && (
          <View style={styles.deliveredBanner}>
            <Ionicons name="checkmark-circle" size={24} color="#2D8B47" />
            <View style={styles.deliveredContent}>
              <Text style={styles.deliveredTitle}>Order Delivered!</Text>
              <Text style={styles.deliveredText}>Enjoy your groceries</Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        {!isCancelled && (
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Delivery Progress</Text>
            
            {STATUS_STEPS.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isLast = index === STATUS_STEPS.length - 1;
              
              return (
                <View key={step.key} style={styles.timelineStep}>
                  {/* Line */}
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineCircle,
                      isCompleted && styles.timelineCircleCompleted,
                      isCurrent && styles.timelineCircleCurrent,
                    ]}>
                      {isCompleted ? (
                        <Ionicons name={step.icon as any} size={16} color="#fff" />
                      ) : (
                        <Text style={styles.timelineStepNumber}>{index + 1}</Text>
                      )}
                    </View>
                    {!isLast && (
                      <View style={[
                        styles.timelineLine,
                        isCompleted && index < currentStepIndex && styles.timelineLineCompleted,
                      ]} />
                    )}
                  </View>
                  
                  <View style={styles.timelineRight}>
                    <Text style={[
                      styles.timelineLabel,
                      isCompleted && styles.timelineLabelCompleted,
                      isCurrent && styles.timelineLabelCurrent,
                    ]}>
                      {step.label}
                    </Text>
                    <Text style={styles.timelineDescription}>{step.description}</Text>
                    {isCurrent && (
                      <View style={styles.currentBadge}>
                        <View style={styles.currentDot} />
                        <Text style={styles.currentText}>Current</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {lastUpdated && (
          <Text style={styles.lastUpdated}>Last updated: {lastUpdated.toLocaleTimeString()}</Text>
        )}

        {/* Delivery Partner */}
        {tracking?.delivery_partner && !isCancelled && currentStepIndex >= 2 && (
          <View style={styles.partnerCard}>
            <Text style={styles.sectionTitle}>Delivery Partner</Text>
            <View style={styles.partnerInfo}>
              <View style={styles.partnerAvatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View style={styles.partnerDetails}>
                <Text style={styles.partnerName}>{tracking.delivery_partner.name}</Text>
                <Text style={styles.partnerVehicle}>{tracking.delivery_partner.vehicle}</Text>
                <View style={styles.partnerRating}>
                  <Ionicons name="star" size={14} color="#FF8C42" />
                  <Text style={styles.ratingText}>{tracking.delivery_partner.rating}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.callButton} onPress={callDeliveryPartner}>
                <Ionicons name="call" size={20} color="#2D8B47" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Live Map */}
        {tracking?.delivery_address && (
          <View style={styles.mapCard}>
            <Text style={styles.sectionTitle}>Live Tracking Map</Text>
            <WebView
              source={{ html: buildMapHtml(
                tracking.delivery_address,
                tracking.delivery_partner?.current_location?.latitude,
                tracking.delivery_partner?.current_location?.longitude
              )}}
              style={styles.mapWebView}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Delivery Address */}
        {tracking?.delivery_address && (
          <View style={styles.addressCard}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <View style={styles.addressRow}>
              <Ionicons name="location" size={20} color="#2D8B47" />
              <Text style={styles.addressText}>{tracking.delivery_address}</Text>
            </View>
          </View>
        )}

        {/* Tracking History */}
        {tracking?.tracking_updates && tracking.tracking_updates.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Tracking History</Text>
            {tracking.tracking_updates.map((update: TrackingUpdate, index: number) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyMessage}>{update.message}</Text>
                  <Text style={styles.historyTime}>
                    {formatDate(update.timestamp)} • {formatTime(update.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Cancel Order Button */}
        {canCancel && (
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={handleCancelOrder}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                <Text style={styles.cancelButtonText}>{t('cancelOrder')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Need Help */}
        <TouchableOpacity 
          style={styles.helpButton}
          onPress={() => router.push('/profile/help-support')}
        >
          <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.helpButtonText}>Need Help?</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  
  content: { flex: 1, padding: 16 },
  
  orderIdCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  orderIdLeft: {},
  orderIdLabel: { fontSize: 12, color: '#6B7280' },
  orderIdValue: { fontSize: 18, fontWeight: 'bold', color: '#111', marginTop: 2 },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  etaText: { fontSize: 14, fontWeight: '600', color: '#FF8C42' },
  
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelledContent: {},
  cancelledTitle: { fontSize: 16, fontWeight: 'bold', color: '#DC2626' },
  cancelledText: { fontSize: 13, color: '#DC2626', marginTop: 2 },
  
  deliveredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  deliveredContent: {},
  deliveredTitle: { fontSize: 16, fontWeight: 'bold', color: '#2D8B47' },
  deliveredText: { fontSize: 13, color: '#2D8B47', marginTop: 2 },
  
  // Timeline
  timelineCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  timelineTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 20 },
  timelineStep: { flexDirection: 'row', minHeight: 70 },
  timelineLeft: { alignItems: 'center', width: 40 },
  timelineCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineCircleCompleted: { backgroundColor: '#2D8B47' },
  timelineCircleCurrent: { backgroundColor: '#FF8C42' },
  timelineStepNumber: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  timelineLine: {
    width: 3,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: -2,
  },
  timelineLineCompleted: { backgroundColor: '#2D8B47' },
  timelineRight: {
    flex: 1,
    paddingLeft: 16,
    paddingBottom: 20,
  },
  timelineLabel: { fontSize: 15, fontWeight: '500', color: '#9CA3AF' },
  timelineLabelCompleted: { color: '#2D8B47', fontWeight: '600' },
  timelineLabelCurrent: { color: '#FF8C42', fontWeight: '600' },
  timelineDescription: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  currentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF8C42' },
  currentText: { fontSize: 11, color: '#FF8C42', fontWeight: '600' },
  
  // Delivery Partner
  partnerCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 12 },
  partnerInfo: { flexDirection: 'row', alignItems: 'center' },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2D8B47',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerDetails: { flex: 1, marginLeft: 12 },
  partnerName: { fontSize: 16, fontWeight: '600', color: '#111' },
  partnerVehicle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  partnerRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 13, fontWeight: '500', color: '#111' },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Address
  addressCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addressText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  
  // History
  historyCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2D8B47',
    marginTop: 6,
  },
  historyContent: { flex: 1 },
  historyMessage: { fontSize: 14, color: '#111' },
  historyTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  
  // Cancel
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
  
  // Help
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
  },
  helpButtonText: { fontSize: 14, color: '#6B7280' },
  lastUpdated: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 16,
  },
  mapCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  mapWebView: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
});
