import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const [showCableTVModal, setShowCableTVModal] = useState(false);
  const [userIdNuid, setUserIdNuid] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceProvider, setServiceProvider] = useState('');
  const [providers, setProviders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchProviders();
    fetchFeaturedProducts();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await api.get('/service-providers');
      setProviders(response.data);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.slice(0, 6));
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleLinkCableTV = async () => {
    if (!userIdNuid || !phone || !serviceProvider) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      await api.post('/cable-tv/link', {
        user_id_nuid: userIdNuid,
        phone,
        service_provider: serviceProvider,
      });
      Alert.alert('Success', 'Cable TV linked successfully!');
      setShowCableTVModal(false);
      refreshUser();
    } catch (error) {
      Alert.alert('Error', 'Failed to link Cable TV');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name}!</Text>
            <Text style={styles.subgreeting}>Get fresh groceries delivered</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#111" />
          </TouchableOpacity>
        </View>

        {!user?.cable_tv_linked && (
          <TouchableOpacity style={styles.cableTVCard} onPress={() => setShowCableTVModal(true)}>
            <View style={styles.cableTVIcon}>
              <Ionicons name="tv" size={32} color="#10B981" />
            </View>
            <View style={styles.cableTVContent}>
              <Text style={styles.cableTVTitle}>Link Your Cable TV</Text>
              <Text style={styles.cableTVSubtitle}>Unlock exclusive rewards up to ₹1000</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#10B981" />
          </TouchableOpacity>
        )}

        {user?.cable_tv_linked && (
          <View style={styles.rewardsCard}>
            <Text style={styles.rewardsTitle}>Your Rewards</Text>
            <Text style={styles.rewardsAmount}>₹{user?.current_reward || 0}</Text>
            <Text style={styles.rewardsSubtitle}>Monthly Spend: ₹{user?.monthly_spend || 0}</Text>
            <View style={styles.rewardsProgress}>
              <View style={[styles.progressBar, { width: `${Math.min((user?.monthly_spend || 0) / 250, 100)}%` }]} />
            </View>
            <Text style={styles.rewardsHint}>Spend ₹{Math.max(7000 - (user?.monthly_spend || 0), 0)} more to unlock ₹250</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
          <View style={styles.productGrid}>
            {products.map((product) => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productImagePlaceholder}>
                  <Ionicons name="bag-outline" size={32} color="#10B981" />
                </View>
                <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.productPrice}>₹{product.price}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={showCableTVModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link Cable TV</Text>
              <TouchableOpacity onPress={() => setShowCableTVModal(false)}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="User ID / NUID"
              value={userIdNuid}
              onChangeText={setUserIdNuid}
            />

            <TextInput
              style={styles.input}
              placeholder="Registered Phone Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Select Service Provider</Text>
            <ScrollView style={styles.providerList}>
              {providers.map((provider) => (
                <TouchableOpacity
                  key={provider.id}
                  style={[styles.providerItem, serviceProvider === provider.name && styles.providerItemSelected]}
                  onPress={() => setServiceProvider(provider.name)}
                >
                  <Text style={[styles.providerText, serviceProvider === provider.name && styles.providerTextSelected]}>
                    {provider.name}
                  </Text>
                  {serviceProvider === provider.name && (
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.submitButton} onPress={handleLinkCableTV}>
              <Text style={styles.submitButtonText}>Link Cable TV</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  subgreeting: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  notificationButton: { padding: 8 },
  cableTVCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 16, margin: 16, borderRadius: 16 },
  cableTVIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cableTVContent: { flex: 1, marginLeft: 16 },
  cableTVTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  cableTVSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  rewardsCard: { backgroundColor: '#FEF3C7', padding: 20, margin: 16, borderRadius: 16 },
  rewardsTitle: { fontSize: 14, color: '#92400E', fontWeight: '600' },
  rewardsAmount: { fontSize: 36, fontWeight: 'bold', color: '#92400E', marginTop: 8 },
  rewardsSubtitle: { fontSize: 12, color: '#92400E', marginTop: 4 },
  rewardsProgress: { height: 8, backgroundColor: '#FDE68A', borderRadius: 4, marginTop: 12 },
  progressBar: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  rewardsHint: { fontSize: 12, color: '#92400E', marginTop: 8 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: { width: '48%', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  productImagePlaceholder: { width: '100%', height: 100, backgroundColor: '#E5E7EB', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  productName: { fontSize: 14, color: '#111', marginBottom: 4 },
  productPrice: { fontSize: 16, fontWeight: 'bold', color: '#10B981' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  providerList: { maxHeight: 200, marginBottom: 16 },
  providerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 8 },
  providerItemSelected: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  providerText: { fontSize: 16, color: '#111' },
  providerTextSelected: { color: '#10B981', fontWeight: '600' },
  submitButton: { backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 12 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
