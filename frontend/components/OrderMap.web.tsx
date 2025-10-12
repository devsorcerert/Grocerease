import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OrderMapProps {
  deliveryLocation: { latitude: number; longitude: number };
  deliveryAddress: string;
  assignedStore?: {
    name: string;
    location: { latitude: number; longitude: number };
    distance: number;
  };
  deliveryPartner?: {
    name: string;
    current_location: { latitude: number; longitude: number };
    estimated_arrival: string;
  };
  geofenceRadius: number;
}

export default function OrderMap(props: OrderMapProps) {
  return (
    <View style={styles.mapPlaceholder}>
      <Ionicons name="map" size={48} color="#9CA3AF" />
      <Text style={styles.mapPlaceholderText}>
        📍 Interactive map with geofencing available on mobile app
      </Text>
      <Text style={styles.mapPlaceholderSubtext}>
        Download the mobile app to see real-time delivery tracking with Google Maps
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
