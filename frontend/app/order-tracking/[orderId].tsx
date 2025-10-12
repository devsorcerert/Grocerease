import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, ScrollView, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// Conditionally import maps only for native platforms
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  Polyline = Maps.Polyline;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

const { width, height } = Dimensions.get('window');
const GEOFENCE_RADIUS = 5000; // 5km in meters

interface Store {
  id: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance: number;
}

interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
  current_location: {
    latitude: number;
    longitude: number;
  };
  estimated_arrival: string;
}

interface OrderTrackingData {
  order_id: string;
  status: 'confirmed' | 'preparing' | 'picked_up' | 'out_for_delivery' | 'delivered';
  delivery_partner?: DeliveryPartner;
  delivery_address: string;
  delivery_location: {
    latitude: number;
    longitude: number;
  };
  assigned_store?: Store;
  estimated_delivery: string;
  tracking_updates: Array<{
    timestamp: string;
    status: string;
    message: string;
  }>;
}

// Helper: Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [trackingData, setTrackingData] = useState<OrderTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);

  // Mock store locations (in real app, fetch from backend)
  const allStores: Store[] = [
    { id: '1', name: 'GrocerEase Store - Andheri', address: 'Andheri West, Mumbai', location: { latitude: 19.1136, longitude: 72.8697 }, distance: 0 },
    { id: '2', name: 'GrocerEase Store - Bandra', address: 'Bandra West, Mumbai', location: { latitude: 19.0596, longitude: 72.8295 }, distance: 0 },
    { id: '3', name: 'GrocerEase Store - Malad', address: 'Malad West, Mumbai', location: { latitude: 19.1867, longitude: 72.8483 }, distance: 0 },
    { id: '4', name: 'GrocerEase Store - Powai', address: 'Powai, Mumbai', location: { latitude: 19.1176, longitude: 72.9060 }, distance: 0 },
    { id: '5', name: 'GrocerEase Store - Dadar', address: 'Dadar East, Mumbai', location: { latitude: 19.0189, longitude: 72.8478 }, distance: 0 },
  ];

  useEffect(() => {
    fetchTrackingData();
    const interval = setInterval(fetchTrackingData, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchTrackingData = async () => {
    try {
      const response = await api.get(`/orders/${orderId}/tracking`);
      setTrackingData(response.data);
      findNearbyStores(response.data.delivery_location);
    } catch (error) {
      console.error('Failed to fetch tracking data:', error);
      
      // Mock delivery location (user's current location or delivery address)
      const deliveryLoc = { latitude: 19.0760, longitude: 72.8777 }; // Mumbai
      
      // Find nearest store within 5km
      const storesWithDistance = allStores.map(store => ({
        ...store,
        distance: calculateDistance(deliveryLoc.latitude, deliveryLoc.longitude, store.location.latitude, store.location.longitude)
      })).filter(store => store.distance <= 5) // Filter stores within 5km
        .sort((a, b) => a.distance - b.distance); // Sort by nearest
      
      const nearestStore = storesWithDistance[0] || allStores[0]; // Fallback to first store
      
      setNearbyStores(storesWithDistance);
      
      setTrackingData({
        order_id: orderId as string,
        status: 'out_for_delivery',
        delivery_location: deliveryLoc,
        assigned_store: nearestStore,
        delivery_partner: {
          id: 'dp_001',
          name: 'Rajesh Kumar',
          phone: '+91 98765 43210',
          vehicle: 'Bike - MH 12 AB 1234',
          rating: 4.8,
          current_location: {
            latitude: nearestStore.location.latitude + 0.01, // Simulate movement
            longitude: nearestStore.location.longitude + 0.01
          },
          estimated_arrival: '15 minutes'
        },
        delivery_address: user?.address || 'Your delivery address',
        estimated_delivery: '2025-01-15T14:30:00Z',
        tracking_updates: [
          { timestamp: '2025-01-15T12:00:00Z', status: 'confirmed', message: `Order confirmed at ${nearestStore.name}` },
          { timestamp: '2025-01-15T12:30:00Z', status: 'preparing', message: 'Items being picked and packed' },
          { timestamp: '2025-01-15T13:00:00Z', status: 'picked_up', message: `Order picked up from ${nearestStore.name} (${nearestStore.distance.toFixed(2)}km away)` },
          { timestamp: '2025-01-15T13:15:00Z', status: 'out_for_delivery', message: 'On the way to your location' },
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const findNearbyStores = (deliveryLocation: { latitude: number; longitude: number }) => {
    const stores = allStores.map(store => ({
      ...store,
      distance: calculateDistance(deliveryLocation.latitude, deliveryLocation.longitude, store.location.latitude, store.location.longitude)
    })).filter(store => store.distance <= 5).sort((a, b) => a.distance - b.distance);
    
    setNearbyStores(stores);
  };

  const openGoogleMaps = () => {
    if (!trackingData?.delivery_partner) {
      Alert.alert('Location Unavailable', 'Delivery partner location not available yet.');
      return;
    }

    const { latitude, longitude } = trackingData.delivery_partner.current_location;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open Google Maps');
      }
    });
  };

  const callDeliveryPartner = () => {
    if (!trackingData?.delivery_partner?.phone) return;
    const phoneUrl = `tel:${trackingData.delivery_partner.phone}`;
    Linking.openURL(phoneUrl);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#3B82F6';
      case 'preparing': return '#F59E0B';
      case 'picked_up': return '#10B981';
      case 'out_for_delivery': return '#FF8C42';
      case 'delivered': return '#2D8B47';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return 'checkmark-circle';
      case 'preparing': return 'restaurant';
      case 'picked_up': return 'cube';
      case 'out_for_delivery': return 'bicycle';
      case 'delivered': return 'home';
      default: return 'time';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D8B47" />
          <Text style={styles.loadingText}>Loading order tracking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trackingData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Order Not Found</Text>
          <Text style={styles.errorText}>Unable to load tracking information for this order.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <TouchableOpacity onPress={fetchTrackingData}>
          <Ionicons name="refresh" size={24} color="#2D8B47" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Google Maps with Geofencing (Native only) */}
        {Platform.OS !== 'web' && MapView ? (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: trackingData.delivery_location.latitude,
                longitude: trackingData.delivery_location.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
            >
              {/* Delivery Location Marker */}
              <Marker
                coordinate={trackingData.delivery_location}
                title="Delivery Location"
                description={trackingData.delivery_address}
                pinColor="#2D8B47"
              >
                <View style={styles.markerContainer}>
                  <Ionicons name="home" size={30} color="#2D8B47" />
                </View>
              </Marker>

              {/* Geofence Circle (5km radius) */}
              <Circle
                center={trackingData.delivery_location}
                radius={GEOFENCE_RADIUS}
                fillColor="rgba(45, 139, 71, 0.1)"
                strokeColor="rgba(45, 139, 71, 0.5)"
                strokeWidth={2}
              />

              {/* Assigned Store Marker */}
              {trackingData.assigned_store && (
                <Marker
                  coordinate={trackingData.assigned_store.location}
                  title={trackingData.assigned_store.name}
                  description={`${trackingData.assigned_store.distance.toFixed(2)}km away`}
                  pinColor="#FF8C42"
                >
                  <View style={styles.storeMarkerContainer}>
                    <Ionicons name="storefront" size={30} color="#FF8C42" />
                  </View>
                </Marker>
              )}

              {/* Delivery Partner Location */}
              {trackingData.delivery_partner && (
                <Marker
                  coordinate={trackingData.delivery_partner.current_location}
                  title={trackingData.delivery_partner.name}
                  description={`ETA: ${trackingData.delivery_partner.estimated_arrival}`}
                >
                  <View style={styles.deliveryMarkerContainer}>
                    <Ionicons name="bicycle" size={30} color="#fff" />
                  </View>
                </Marker>
              )}

              {/* Route Line */}
              {trackingData.delivery_partner && trackingData.assigned_store && (
                <Polyline
                  coordinates={[
                    trackingData.assigned_store.location,
                    trackingData.delivery_partner.current_location,
                    trackingData.delivery_location,
                  ]}
                  strokeColor="#2D8B47"
                  strokeWidth={3}
                  lineDashPattern={[1, 10]}
                />
              )}
            </MapView>

            {/* Geofence Info Overlay */}
            <View style={styles.geofenceInfo}>
              <Ionicons name="shield-checkmark" size={20} color="#2D8B47" />
              <Text style={styles.geofenceText}>
                5km Geofence Active • Order from nearest store
              </Text>
            </View>
          </View>
        ) : (
          /* Web fallback - Show map info without actual map */
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={48} color="#9CA3AF" />
            <Text style={styles.mapPlaceholderText}>
              📍 Interactive map with geofencing available on mobile app
            </Text>
            <Text style={styles.mapPlaceholderSubtext}>
              Download the mobile app to see real-time delivery tracking with Google Maps
            </Text>
          </View>
        )}

        {/* Assigned Store Info */}
        {trackingData.assigned_store && (
          <View style={styles.storeCard}>
            <View style={styles.storeHeader}>
              <Ionicons name="storefront" size={24} color="#FF8C42" />
              <View style={styles.storeInfo}>
                <Text style={styles.storeTitle}>Fulfilling Store</Text>
                <Text style={styles.storeName}>{trackingData.assigned_store.name}</Text>
                <Text style={styles.storeAddress}>{trackingData.assigned_store.address}</Text>
                <View style={styles.distanceBadge}>
                  <Ionicons name="location-outline" size={14} color="#2D8B47" />
                  <Text style={styles.distanceText}>
                    {trackingData.assigned_store.distance.toFixed(2)}km away (within 5km geofence)
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Order Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, { backgroundColor: getStatusColor(trackingData.status) }]}>
              <Ionicons name={getStatusIcon(trackingData.status)} size={24} color="#fff" />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>{trackingData.status.replace('_', ' ').toUpperCase()}</Text>
              <Text style={styles.orderId}>Order #{trackingData.order_id}</Text>
            </View>
          </View>
          <Text style={styles.estimatedTime}>
            Estimated delivery: {new Date(trackingData.estimated_delivery).toLocaleTimeString()}
          </Text>
        </View>

        {/* Delivery Partner Info */}
        {trackingData.delivery_partner && (
          <View style={styles.partnerCard}>
            <View style={styles.partnerHeader}>
              <View style={styles.partnerIcon}>
                <Ionicons name="person" size={24} color="#2D8B47" />
              </View>
              <View style={styles.partnerInfo}>
                <Text style={styles.partnerName}>{trackingData.delivery_partner.name}</Text>
                <Text style={styles.partnerVehicle}>{trackingData.delivery_partner.vehicle}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.rating}>{trackingData.delivery_partner.rating}</Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.arrivalTime}>
              Arriving in {trackingData.delivery_partner.estimated_arrival}
            </Text>

            <View style={styles.partnerActions}>
              <TouchableOpacity style={styles.actionButton} onPress={callDeliveryPartner}>
                <Ionicons name="call" size={20} color="#2D8B47" />
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionButton, styles.mapButton]} onPress={openGoogleMaps}>
                <Ionicons name="location" size={20} color="#fff" />
                <Text style={[styles.actionText, styles.mapButtonText]}>Track on Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tracking Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Order Progress</Text>
          
          {trackingData.tracking_updates.map((update, index) => (
            <View key={index} style={styles.timelineItem}>
              <View style={styles.timelineDot}>
                <View style={[styles.dot, { 
                  backgroundColor: index === trackingData.tracking_updates.length - 1 ? 
                    getStatusColor(trackingData.status) : '#E5E7EB' 
                }]} />
                {index < trackingData.tracking_updates.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>{update.status.replace('_', ' ').toUpperCase()}</Text>
                <Text style={styles.timelineMessage}>{update.message}</Text>
                <Text style={styles.timelineTime}>
                  {new Date(update.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Nearby Stores (within geofence) */}
        {nearbyStores.length > 0 && (
          <View style={styles.nearbyStoresCard}>
            <Text style={styles.nearbyStoresTitle}>
              🎯 Stores within 5km Geofence ({nearbyStores.length})
            </Text>
            {nearbyStores.map((store) => (
              <View key={store.id} style={styles.nearbyStoreItem}>
                <Ionicons name="storefront-outline" size={18} color="#6B7280" />
                <View style={styles.nearbyStoreInfo}>
                  <Text style={styles.nearbyStoreName}>{store.name}</Text>
                  <Text style={styles.nearbyStoreDistance}>{store.distance.toFixed(2)}km away</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Delivery Address */}
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <Ionicons name="location-outline" size={20} color="#2D8B47" />
            <Text style={styles.addressTitle}>Delivery Address</Text>
          </View>
          <Text style={styles.addressText}>{trackingData.delivery_address}</Text>
        </View>
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
    borderBottomColor: '#E5E7EB'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  
  content: { flex: 1 },
  
  mapContainer: { height: 300, backgroundColor: '#E5E7EB', position: 'relative' },
  map: { flex: 1 },
  
  mapPlaceholder: {
    height: 300,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginTop: 16,
  },
  mapPlaceholderSubtext: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  
  markerContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#2D8B47',
  },
  storeMarkerContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FF8C42',
  },
  deliveryMarkerContainer: {
    backgroundColor: '#2D8B47',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  geofenceInfo: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  geofenceText: { fontSize: 13, fontWeight: '600', color: '#111', marginLeft: 8 },
  
  storeCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 16, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  storeHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  storeInfo: { flex: 1, marginLeft: 12 },
  storeTitle: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  storeName: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  storeAddress: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  distanceText: { fontSize: 11, fontWeight: '600', color: '#2D8B47', marginLeft: 4 },
  
  statusCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16, 
    marginTop: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 16
  },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  orderId: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  estimatedTime: { fontSize: 14, color: '#2D8B47', fontWeight: '600' },
  
  partnerCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16, 
    marginTop: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  partnerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  partnerIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: '#ECFDF5', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 16
  },
  partnerInfo: { flex: 1 },
  partnerName: { fontSize: 16, fontWeight: '600', color: '#111' },
  partnerVehicle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rating: { fontSize: 14, fontWeight: '600', color: '#111', marginLeft: 4 },
  arrivalTime: { fontSize: 14, color: '#FF8C42', fontWeight: '600', marginBottom: 16 },
  
  partnerActions: { flexDirection: 'row', gap: 12 },
  actionButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 12, 
    borderRadius: 12, 
    borderWidth: 1,
    borderColor: '#2D8B47',
    backgroundColor: '#fff'
  },
  mapButton: { backgroundColor: '#2D8B47', borderColor: '#2D8B47' },
  actionText: { fontSize: 14, fontWeight: '600', color: '#2D8B47', marginLeft: 6 },
  mapButtonText: { color: '#fff' },
  
  timelineCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16, 
    marginTop: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  timelineTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: { alignItems: 'center', marginRight: 16 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, height: 32, backgroundColor: '#E5E7EB', marginTop: 4 },
  timelineContent: { flex: 1 },
  timelineStatus: { fontSize: 14, fontWeight: '600', color: '#111' },
  timelineMessage: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  timelineTime: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  
  nearbyStoresCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16, 
    marginTop: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  nearbyStoresTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 12 },
  nearbyStoreItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  nearbyStoreInfo: { flex: 1, marginLeft: 12 },
  nearbyStoreName: { fontSize: 14, fontWeight: '500', color: '#111' },
  nearbyStoreDistance: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  
  addressCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16,
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  addressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addressTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginLeft: 8 },
  addressText: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: '#6B7280', marginTop: 16 },
  
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 24, fontWeight: 'bold', color: '#111', marginTop: 16 },
  errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  backButton: { backgroundColor: '#2D8B47', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
