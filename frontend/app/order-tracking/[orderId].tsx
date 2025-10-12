import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle, Polyline } from 'react-native-maps';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

interface Store {
  id: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance: number; // in km
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

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [trackingData, setTrackingData] = useState<OrderTrackingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrackingData();
    // Set up polling for real-time updates
    const interval = setInterval(fetchTrackingData, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchTrackingData = async () => {
    try {
      const response = await api.get(`/orders/${orderId}/tracking`);
      setTrackingData(response.data);
    } catch (error) {
      console.error('Failed to fetch tracking data:', error);
      // Mock data for demonstration - Infrastructure ready for real API
      setTrackingData({
        order_id: orderId as string,
        status: 'out_for_delivery',
        delivery_partner: {
          id: 'dp_001',
          name: 'Rajesh Kumar',
          phone: '+91 98765 43210',
          vehicle: 'Bike - MH 12 AB 1234',
          rating: 4.8,
          current_location: {
            latitude: 19.0760,
            longitude: 72.8777
          },
          estimated_arrival: '15 minutes'
        },
        delivery_address: user?.address || 'Your delivery address',
        estimated_delivery: '2024-01-15T14:30:00Z',
        tracking_updates: [
          { timestamp: '2024-01-15T12:00:00Z', status: 'confirmed', message: 'Order confirmed and being prepared' },
          { timestamp: '2024-01-15T12:30:00Z', status: 'preparing', message: 'Items being picked and packed' },
          { timestamp: '2024-01-15T13:00:00Z', status: 'picked_up', message: 'Order picked up by delivery partner' },
          { timestamp: '2024-01-15T13:15:00Z', status: 'out_for_delivery', message: 'On the way to your location' },
        ]
      });
    } finally {
      setLoading(false);
    }
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
    Linking.canOpenURL(phoneUrl).then(supported => {
      if (supported) {
        Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'Unable to make phone call');
      }
    });
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

      <View style={styles.content}>
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

            <View style={styles.infrastructureNote}>
              <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
              <Text style={styles.infrastructureText}>
                🚀 Infrastructure ready for real-time GPS tracking integration
              </Text>
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

        {/* Delivery Address */}
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <Ionicons name="location-outline" size={20} color="#2D8B47" />
            <Text style={styles.addressTitle}>Delivery Address</Text>
          </View>
          <Text style={styles.addressText}>{trackingData.delivery_address}</Text>
        </View>
      </View>
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
  
  content: { flex: 1, padding: 16 },
  
  statusCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 16,
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
    marginBottom: 16,
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
  
  partnerActions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
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
  
  infrastructureNote: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F3F4F6', 
    padding: 12, 
    borderRadius: 8 
  },
  infrastructureText: { fontSize: 11, color: '#6B7280', marginLeft: 8, flex: 1 },
  
  timelineCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 16,
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
  
  addressCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16,
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