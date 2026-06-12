import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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

export default function OrderMap({
  deliveryLocation,
  deliveryAddress,
  assignedStore,
  deliveryPartner,
  geofenceRadius,
}: OrderMapProps) {
  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: deliveryLocation.latitude,
          longitude: deliveryLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {/* Delivery Location Marker */}
        <Marker
          coordinate={deliveryLocation}
          title="Delivery Location"
          description={deliveryAddress}
          pinColor="#2D8B47"
        >
          <View style={styles.markerContainer}>
            <Ionicons name="home" size={30} color="#2D8B47" />
          </View>
        </Marker>

        {/* Geofence Circle */}
        <Circle
          center={deliveryLocation}
          radius={geofenceRadius}
          fillColor="rgba(45, 139, 71, 0.1)"
          strokeColor="rgba(45, 139, 71, 0.5)"
          strokeWidth={2}
        />

        {/* Assigned Store Marker */}
        {assignedStore && (
          <Marker
            coordinate={assignedStore.location}
            title={assignedStore.name}
            description={`${assignedStore.distance.toFixed(2)}km away`}
            pinColor="#FF8C42"
          >
            <View style={styles.storeMarkerContainer}>
              <Ionicons name="storefront" size={30} color="#FF8C42" />
            </View>
          </Marker>
        )}

        {/* Delivery Partner Location */}
        {deliveryPartner && (
          <Marker
            coordinate={deliveryPartner.current_location}
            title={deliveryPartner.name}
            description={`ETA: ${deliveryPartner.estimated_arrival}`}
          >
            <View style={styles.deliveryMarkerContainer}>
              <Ionicons name="bicycle" size={30} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Route Line */}
        {deliveryPartner && assignedStore && (
          <Polyline
            coordinates={[
              assignedStore.location,
              deliveryPartner.current_location,
              deliveryLocation,
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
  );
}

const styles = StyleSheet.create({
  mapContainer: { height: 300, backgroundColor: '#E5E7EB', position: 'relative' },
  map: { flex: 1 },
  
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
});
