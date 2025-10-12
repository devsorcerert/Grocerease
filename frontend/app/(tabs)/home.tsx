import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, Dimensions, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCartStore } from '../../store/cartStore';

const { width } = Dimensions.get('window');

// Icon mapping for categories
const categoryIconMap: { [key: string]: any } = {
  'Fruits & Vegetables': 'leaf',
  'Dairy & Breakfast': 'cafe',
  'Munchies': 'fast-food',
  'Cold Drinks & Juices': 'beer',
  'Instant & Frozen': 'snow',
  'Tea, Coffee & More': 'cafe-outline',
  'Bakery & Biscuits': 'restaurant',
  'Sweet Tooth': 'ice-cream',
  'Atta, Rice & Dal': 'nutrition',
  'Masala & Spices': 'flame',
  'Sauces & Spreads': 'water',
  'Chicken, Meat & Fish': 'fish',
  'Cleaning Essentials': 'water-outline',
  'Personal Care': 'body',
  'Home & Kitchen': 'home',
};

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { addToCart } = useCartStore();
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

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart(productId, 1);
      // Show success toast
      Alert.alert(
        'Added to Cart! 🛒',
        'Product has been added to your cart successfully.',
        [
          { text: 'Continue Shopping', style: 'default' },
          { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') }
        ]
      );
    } catch (error) {
      console.error('Failed to add to cart:', error);
      Alert.alert('Error', 'Failed to add product to cart. Please try again.');
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    router.push({
      pathname: '/(tabs)/categories',
      params: { selectedCategory: categoryName }
    });
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
          <View style={{flex: 1}}>
            <Text style={styles.greeting}>Hello, {user?.name}!</Text>
            {user?.address && (
              <Text style={styles.addressText}>📍 {user.address}, {user.city} - {user.pincode}</Text>
            )}
            <Text style={styles.subgreeting}>Get fresh groceries delivered</Text>
          </View>
          <View style={styles.headerActions}>
            {user?.is_admin && (
              <TouchableOpacity 
                style={styles.adminButton} 
                onPress={() => router.push('/admin')}
              >
                <Ionicons name="shield-checkmark" size={20} color="#FF8C42" />
                <Text style={styles.adminButtonText}>Admin</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.notificationButton} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications-outline" size={24} color="#111" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>3</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {!user?.cable_tv_linked && (
          <TouchableOpacity style={styles.cableTvCard} onPress={() => setShowCableTVModal(true)}>
            <View style={styles.cableTvHeader}>
              <View style={styles.cableTvMainContent}>
                <View style={styles.cableTvTitleRow}>
                  <Ionicons name="gift" size={24} color="#fff" style={styles.cableTvGiftIcon} />
                  <Text style={styles.cableTvTitle}>Link Your Cable TV</Text>
                </View>
                <Text style={styles.cableTvSubtitle}>Get up to ₹1,000 off monthly grocery spends</Text>
              </View>
              <TouchableOpacity style={styles.linkButton} onPress={() => setShowCableTVModal(true)}>
                <Text style={styles.linkButtonText}>Link Now</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.savingsSection}>
              <Text style={styles.savingsTitle}>Your Potential Savings</Text>
              
              <View style={styles.savingsRow}>
                <View style={styles.savingsLeft}>
                  <Ionicons name="time-outline" size={16} color="#fff" />
                  <Text style={styles.savingsLabel}>Monthly Slot</Text>
                  <Text style={styles.savingsValue}>₹{user?.monthly_spend || 0} / ₹1,000</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min((user?.monthly_spend || 0) / 1000 * 100, 100)}%` }]} />
              </View>
              
              <View style={styles.savingsRow}>
                <View style={styles.savingsLeft}>
                  <Ionicons name="calendar-outline" size={16} color="#fff" />
                  <Text style={styles.savingsLabel}>Annual Slot</Text>
                  <Text style={styles.savingsValue}>₹{user?.total_spend || 0} / ₹12,000</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min((user?.total_spend || 0) / 12000 * 100, 100)}%` }]} />
              </View>
              
              <View style={styles.trustIndicators}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.trustText}>Instant verification • No extra charges • Secure & Private</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {user?.cable_tv_linked && (
          <View style={styles.cableTVLinkedCard}>
            <View style={styles.tvLinkedHeader}>
              <View style={styles.tvLinkedLeft}>
                <View style={styles.tvIconSmall}>
                  <Ionicons name="tv" size={20} color="#2D8B47" />
                </View>
                <View>
                  <Text style={styles.tvLinkedTitle}>Cable TV Linked</Text>
                  <Text style={styles.tvProvider}>{user?.cable_tv_details?.service_provider}</Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#2D8B47" />
            </View>

            <View style={styles.offerUsageSection}>
              <Text style={styles.usageTitle}>Offer Usage Tracking</Text>
              
              <View style={styles.usageCard}>
                <View style={styles.usageHeader}>
                  <Ionicons name="calendar-outline" size={20} color="#2D8B47" />
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
                  <Ionicons name="calendar" size={20} color="#FF8C42" />
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
              <TouchableOpacity 
                key={cat.id} 
                style={styles.categoryItem}
                onPress={() => handleCategoryClick(cat.name)}
              >
                <View style={styles.categoryIcon}>
                  <Ionicons name={categoryIconMap[cat.name] || 'apps'} size={32} color="#2D8B47" />
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
            {products.slice(0, 6).map((product, index) => (
              <TouchableOpacity key={product.id} style={styles.productCard} onPress={() => console.log('Product selected:', product.name)}>
                <View style={styles.productImageContainer}>
                  {product.image ? (
                    <Image 
                      source={{ uri: product.image }} 
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Ionicons name="bag-outline" size={28} color="#2D8B47" />
                    </View>
                  )}
                  <View style={styles.productBadge}>
                    <Text style={styles.badgeText}>Fresh</Text>
                  </View>
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.productUnit}>{product.unit}</Text>
                  <View style={styles.productFooter}>
                    <View style={styles.priceContainer}>
                      <Text style={styles.productPrice}>₹{product.price}</Text>
                      <Text style={styles.originalPrice}>₹{(product.price * 1.2).toFixed(0)}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.addBtn}
                      onPress={() => handleAddToCart(product.id)}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
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

            <View style={styles.benefitsBox}>
              <Text style={styles.benefitsTitle}>📊 Benefits After Linking:</Text>
              <Text style={styles.benefitsText}>• Track monthly & yearly spending</Text>
              <Text style={styles.benefitsText}>• View offer usage in real-time</Text>
              <Text style={styles.benefitsText}>• Unlock rewards up to ₹1000</Text>
              <Text style={styles.benefitsText}>• 🔧 Infrastructure ready for real API integration</Text>
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
                    <Ionicons name="checkmark-circle" size={20} color="#2D8B47" />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  addressText: { fontSize: 12, color: '#2D8B47', marginTop: 4, fontWeight: '500' },
  subgreeting: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  adminButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF7ED', 
    paddingHorizontal: 8, 
    paddingVertical: 6, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF8C42',
    gap: 4
  },
  adminButtonText: { fontSize: 11, color: '#FF8C42', fontWeight: '600' },
  notificationButton: { padding: 8, position: 'relative' },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cableTvCard: { 
    flexDirection: 'column', 
    backgroundColor: '#667eea', 
    padding: 20, 
    margin: 16, 
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cableTvHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cableTvMainContent: {
    flex: 1,
    paddingRight: 12,
  },
  cableTvTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  cableTvGiftIcon: {
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
  },
  cableTvTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#fff',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  cableTvSubtitle: { 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 0.9)', 
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  linkButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    minWidth: 80,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  savingsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  savingsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  savingsRow: {
    flexDirection: 'column',
    marginBottom: 12,
  },
  savingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  savingsLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
    flex: 1,
  },
  savingsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'right',
    paddingLeft: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  trustIndicators: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  trustText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
    flexWrap: 'wrap',
  },
  offerPreviewCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 12, 
    borderRadius: 10, 
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2D8B47',
    gap: 12,
  },
  offerPreviewItem: { 
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerPreviewDivider: { width: 1, backgroundColor: '#E5E7EB' },
  offerPreviewLabel: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  offerPreviewValue: { fontSize: 13, color: '#111', fontWeight: 'bold', marginTop: 2 },
  linkCTA: { fontSize: 11, color: '#2D8B47', fontWeight: '600', marginTop: 8 },
  
  // Cable TV Linked Card with Usage Tracking
  cableTVLinkedCard: { backgroundColor: '#F9FAFB', padding: 16, margin: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  tvLinkedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  tvLinkedLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tvIconSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  tvLinkedTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  tvProvider: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  
  offerUsageSection: { marginTop: 8 },
  usageTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 12 },
  usageCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  usageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  usageCardTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  usageStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  usageStatItem: { alignItems: 'center' },
  usageStatValue: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  usageStatLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  usageStatDivider: { width: 1, backgroundColor: '#E5E7EB' },
  progressBarContainer: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 8 },
  progressBar: { height: '100%', backgroundColor: '#2D8B47', borderRadius: 3 },
  nextTierText: { fontSize: 11, color: '#6B7280', textAlign: 'center' },

  // Brand Banners
  section: { paddingHorizontal: 16, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  sectionSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  viewAllText: { fontSize: 14, color: '#2D8B47', fontWeight: '600' },
  bannersScroll: { marginTop: 8 },
  brandBanner: { width: width * 0.7, padding: 20, borderRadius: 16, marginRight: 12, position: 'relative' },
  bannerBrand: { fontSize: 22, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  bannerOffer: { fontSize: 28, fontWeight: 'bold', color: '#EF4444', marginBottom: 4 },
  bannerText: { fontSize: 14, color: '#6B7280' },
  bannerBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  bannerBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#6B7280' },

  // Categories
  categoriesScroll: { marginTop: 8 },
  categoryItem: { alignItems: 'center', marginRight: 16, width: 80 },
  categoryIcon: { width: 70, height: 70, backgroundColor: '#ECFDF5', borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  categoryName: { fontSize: 11, color: '#111', textAlign: 'center', minHeight: 32, lineHeight: 14, flexWrap: 'wrap' },

  // Products
  productGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16,
    gap: 12,
  },
  productCard: { 
    width: '48%', 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  productImageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F9FAFB',
  },
  productImagePlaceholder: { 
    width: '100%', 
    height: '100%', 
    backgroundColor: '#F3F4F6', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  productBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#2D8B47',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  productInfo: {
    padding: 12,
  },
  productName: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#111', 
    marginBottom: 4,
    lineHeight: 18,
  },
  productUnit: { 
    fontSize: 11, 
    color: '#6B7280', 
    marginBottom: 8,
  },
  productFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  priceContainer: {
    flex: 1,
  },
  productPrice: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#2D8B47',
  },
  originalPrice: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  addBtn: { 
    width: 28, 
    height: 28, 
    backgroundColor: '#FF8C42', 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  
  // Quantity Controls
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 8,
  },
  quantityBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    minWidth: 20,
    textAlign: 'center',
  },

  // GrocerEase TV Section
  tvSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tvHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tvHeaderText: { flexDirection: 'column' },
  tvSectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  tvSectionSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  videosScroll: { marginTop: 8 },
  videoCard: { width: width * 0.65, marginRight: 12, backgroundColor: '#F9FAFB', borderRadius: 12, overflow: 'hidden' },
  videoThumbnail: { width: '100%', height: 140, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  liveBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  videoInfo: { padding: 12 },
  videoTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 4 },
  videoDuration: { fontSize: 11, color: '#9CA3AF' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  benefitsBox: { backgroundColor: '#ECFDF5', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#2D8B47' },
  benefitsTitle: { fontSize: 14, fontWeight: 'bold', color: '#2D8B47', marginBottom: 8 },
  benefitsText: { fontSize: 12, color: '#2D8B47', marginVertical: 2 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  providerList: { maxHeight: 180, marginBottom: 16 },
  providerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 8 },
  providerItemSelected: { borderColor: '#2D8B47', backgroundColor: '#ECFDF5' },
  providerText: { fontSize: 16, color: '#111' },
  providerTextSelected: { color: '#2D8B47', fontWeight: '600' },
  submitButton: { backgroundColor: '#2D8B47', paddingVertical: 16, borderRadius: 12 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
