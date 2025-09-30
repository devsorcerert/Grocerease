import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, Dimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [showCableTVModal, setShowCableTVModal] = useState(false);
  const [userIdNuid, setUserIdNuid] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceProvider, setServiceProvider] = useState('');
  const [providers, setProviders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    fetchProviders();
    fetchFeaturedProducts();
    fetchCategories();
    fetchVideos();
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

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await api.get('/videos');
      setVideos(response.data.slice(0, 3));
    } catch (error) {
      console.error('Failed to fetch videos:', error);
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

  const getMonthlyOfferUsage = () => {
    const spend = user?.monthly_spend || 0;
    if (spend >= 25000) return { used: 3, total: 3, maxReward: 1000 };
    if (spend >= 13000) return { used: 2, total: 3, maxReward: 500 };
    if (spend >= 7000) return { used: 1, total: 3, maxReward: 250 };
    return { used: 0, total: 3, maxReward: 0 };
  };

  const getYearlyStats = () => {
    const totalSpend = user?.total_spend || 0;
    const yearlyOffers = Math.floor(totalSpend / 25000);
    return { offers: yearlyOffers, savings: yearlyOffers * 1000 };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
          <View style={styles.cableTVLinkedCard}>
            <View style={styles.tvLinkedHeader}>
              <View style={styles.tvLinkedLeft}>
                <View style={styles.tvIconSmall}>
                  <Ionicons name="tv" size={20} color="#10B981" />
                </View>
                <View>
                  <Text style={styles.tvLinkedTitle}>Cable TV Linked</Text>
                  <Text style={styles.tvProvider}>{user?.cable_tv_details?.service_provider}</Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </View>

            <View style={styles.offerUsageSection}>
              <Text style={styles.usageTitle}>Offer Usage Tracking</Text>
              
              <View style={styles.usageCard}>
                <View style={styles.usageHeader}>
                  <Ionicons name="calendar-outline" size={20} color="#10B981" />
                  <Text style={styles.usageCardTitle}>This Month</Text>
                </View>
                <View style={styles.usageStats}>
                  <View style={styles.usageStatItem}>
                    <Text style={styles.usageStatValue}>₹{user?.monthly_spend || 0}</Text>
                    <Text style={styles.usageStatLabel}>Spent</Text>
                  </View>
                  <View style={styles.usageStatDivider} />
                  <View style={styles.usageStatItem}>
                    <Text style={styles.usageStatValue}>₹{user?.current_reward || 0}</Text>
                    <Text style={styles.usageStatLabel}>Reward</Text>
                  </View>
                  <View style={styles.usageStatDivider} />
                  <View style={styles.usageStatItem}>
                    <Text style={styles.usageStatValue}>{getMonthlyOfferUsage().used}/{getMonthlyOfferUsage().total}</Text>
                    <Text style={styles.usageStatLabel}>Tiers</Text>
                  </View>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${Math.min((user?.monthly_spend || 0) / 250, 100)}%` }]} />
                </View>
                <Text style={styles.nextTierText}>
                  {getMonthlyOfferUsage().used === 3 
                    ? '🎉 Maximum tier unlocked!' 
                    : `Spend ₹${Math.max(7000 - (user?.monthly_spend || 0), 0)} more for next tier`}
                </Text>
              </View>

              <View style={styles.usageCard}>
                <View style={styles.usageHeader}>
                  <Ionicons name="calendar" size={20} color="#F59E0B" />
                  <Text style={styles.usageCardTitle}>This Year</Text>
                </View>
                <View style={styles.usageStats}>
                  <View style={styles.usageStatItem}>
                    <Text style={styles.usageStatValue}>₹{user?.total_spend || 0}</Text>
                    <Text style={styles.usageStatLabel}>Total Spent</Text>
                  </View>
                  <View style={styles.usageStatDivider} />
                  <View style={styles.usageStatItem}>
                    <Text style={styles.usageStatValue}>{getYearlyStats().offers}</Text>
                    <Text style={styles.usageStatLabel}>Max Offers</Text>
                  </View>
                  <View style={styles.usageStatDivider} />
                  <View style={styles.usageStatItem}>
                    <Text style={styles.usageStatValue}>₹{getYearlyStats().savings}</Text>
                    <Text style={styles.usageStatLabel}>Saved</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* FMCG Brand Banners */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Brand Offers</Text>
            <Text style={styles.sectionSubtitle}>Exclusive deals from top brands</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bannersScroll}>
            <View style={[styles.brandBanner, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.bannerBrand}>Amul</Text>
              <Text style={styles.bannerOffer}>20% OFF</Text>
              <Text style={styles.bannerText}>On all dairy products</Text>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>PROVISION</Text>
              </View>
            </View>
            <View style={[styles.brandBanner, { backgroundColor: '#DBEAFE' }]}>
              <Text style={styles.bannerBrand}>Britannia</Text>
              <Text style={styles.bannerOffer}>Buy 2 Get 1</Text>
              <Text style={styles.bannerText}>On biscuits & cookies</Text>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>PROVISION</Text>
              </View>
            </View>
            <View style={[styles.brandBanner, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.bannerBrand}>Tata Tea</Text>
              <Text style={styles.bannerOffer}>₹50 OFF</Text>
              <Text style={styles.bannerText}>On 500g pack</Text>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>PROVISION</Text>
              </View>
            </View>
            <View style={[styles.brandBanner, { backgroundColor: '#E0E7FF' }]}>
              <Text style={styles.bannerBrand}>Nestlé</Text>
              <Text style={styles.bannerOffer}>15% OFF</Text>
              <Text style={styles.bannerText}>On coffee range</Text>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>PROVISION</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Product Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/categories')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            {categories.slice(0, 8).map((cat) => (
              <TouchableOpacity key={cat.id} style={styles.categoryItem}>
                <View style={styles.categoryIcon}>
                  <Ionicons name={cat.icon} size={32} color="#10B981" />
                </View>
                <Text style={styles.categoryName} numberOfLines={2}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Products</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/categories')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productGrid}>
            {products.map((product) => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productImagePlaceholder}>
                  <Ionicons name="bag-outline" size={32} color="#10B981" />
                </View>
                <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.productUnit}>{product.unit}</Text>
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>₹{product.price}</Text>
                  <TouchableOpacity style={styles.addBtn}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* GrocerEase TV Section */}
        <View style={styles.section}>
          <View style={styles.tvSectionHeader}>
            <View style={styles.tvHeaderLeft}>
              <Ionicons name="tv" size={28} color="#EF4444" />
              <View style={styles.tvHeaderText}>
                <Text style={styles.tvSectionTitle}>GrocerEase TV</Text>
                <Text style={styles.tvSectionSubtitle}>Cooking shows & recipes</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/videos')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.videosScroll}>
            {videos.map((video) => (
              <TouchableOpacity key={video.id} style={styles.videoCard} onPress={() => router.push('/(tabs)/videos')}>
                <View style={styles.videoThumbnail}>
                  <Ionicons name="play-circle" size={40} color="#fff" />
                  {video.is_live && (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                  <Text style={styles.videoDuration}>{video.duration}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 20 }} />
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
