import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Product form
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productUnit, setProductUnit] = useState('');

  // Video form
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoDuration, setVideoDuration] = useState('');

  useEffect(() => {
    if (!user?.is_admin) {
      Alert.alert('Access Denied', 'You do not have admin privileges');
      router.replace('/(tabs)/home');
      return;
    }
    fetchProducts();
    fetchVideos();
  }, [user]);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await api.get('/videos');
      setVideos(response.data);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    }
  };

  const handleAddProduct = async () => {
    if (!productName || !productCategory || !productPrice || !productUnit) {
      Alert.alert('Error', 'Please fill all product fields');
      return;
    }

    setLoading(true);
    try {
      await api.post('/products', {
        name: productName,
        category: productCategory,
        subcategory: productCategory,
        price: parseFloat(productPrice),
        unit: productUnit,
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        description: `${productName} - ${productUnit}`,
        stock: 100,
      });
      Alert.alert('Success', 'Product added successfully!');
      setProductName('');
      setProductCategory('');
      setProductPrice('');
      setProductUnit('');
      fetchProducts();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVideo = async () => {
    if (!videoTitle || !videoDescription || !videoDuration) {
      Alert.alert('Error', 'Please fill all video fields');
      return;
    }

    setLoading(true);
    try {
      await api.post('/videos', {
        title: videoTitle,
        description: videoDescription,
        duration: videoDuration,
        thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        stream_url: null,
        ingredients: [],
        is_live: false,
      });
      Alert.alert('Success', 'Video added successfully!');
      setVideoTitle('');
      setVideoDescription('');
      setVideoDuration('');
      fetchVideos();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Panel</Text>
        <TouchableOpacity onPress={() => {
          logout();
          router.replace('/(auth)/welcome');
        }}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
            Products ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'videos' && styles.tabActive]}
          onPress={() => setActiveTab('videos')}
        >
          <Text style={[styles.tabText, activeTab === 'videos' && styles.tabTextActive]}>
            Videos ({videos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
            Stats
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'products' && (
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add New Product</Text>
              <TextInput
                style={styles.input}
                placeholder="Product Name"
                value={productName}
                onChangeText={setProductName}
              />
              <TextInput
                style={styles.input}
                placeholder="Category (e.g., Fruits & Vegetables)"
                value={productCategory}
                onChangeText={setProductCategory}
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Price (₹)"
                  value={productPrice}
                  onChangeText={setProductPrice}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Unit (e.g., 1 kg)"
                  value={productUnit}
                  onChangeText={setProductUnit}
                />
              </View>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={handleAddProduct}
                disabled={loading}
              >
                <Text style={styles.addButtonText}>
                  {loading ? 'Adding...' : 'Add Product'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Products</Text>
              {products.map((product) => (
                <View key={product.id} style={styles.listItem}>
                  <View style={styles.listItemInfo}>
                    <Text style={styles.listItemName}>{product.name}</Text>
                    <Text style={styles.listItemDetail}>₹{product.price} • {product.unit}</Text>
                    <Text style={styles.listItemCategory}>{product.category}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color="#2D8B47" />
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'videos' && (
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add New Video</Text>
              <TextInput
                style={styles.input}
                placeholder="Video Title"
                value={videoTitle}
                onChangeText={setVideoTitle}
              />
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Description"
                value={videoDescription}
                onChangeText={setVideoDescription}
                multiline
                numberOfLines={3}
              />
              <TextInput
                style={styles.input}
                placeholder="Duration (e.g., 15:30)"
                value={videoDuration}
                onChangeText={setVideoDuration}
              />
              <TouchableOpacity 
                style={styles.addButton}
                onPress={handleAddVideo}
                disabled={loading}
              >
                <Text style={styles.addButtonText}>
                  {loading ? 'Adding...' : 'Add Video'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Videos</Text>
              {videos.map((video) => (
                <View key={video.id} style={styles.listItem}>
                  <View style={styles.listItemInfo}>
                    <Text style={styles.listItemName}>{video.title}</Text>
                    <Text style={styles.listItemDetail}>{video.duration}</Text>
                    {video.is_live && (
                      <View style={styles.liveBadge}>
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="videocam" size={20} color="#EF4444" />
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'stats' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{products.length}</Text>
                <Text style={styles.statLabel}>Total Products</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{videos.length}</Text>
                <Text style={styles.statLabel}>Total Videos</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>15</Text>
                <Text style={styles.statLabel}>Categories</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  backButton: { padding: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111', flex: 1, marginLeft: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2D8B47' },
  tabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: '#2D8B47', fontWeight: '600' },
  content: { flex: 1 },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  input: { 
    borderWidth: 1, 
    borderColor: '#D1D5DB', 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 16,
    marginBottom: 12,
  },
  multilineInput: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  addButton: { 
    backgroundColor: '#2D8B47', 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 16, 
    backgroundColor: '#F9FAFB', 
    borderRadius: 12, 
    marginBottom: 12 
  },
  listItemInfo: { flex: 1 },
  listItemName: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  listItemDetail: { fontSize: 14, color: '#6B7280', marginBottom: 2 },
  listItemCategory: { fontSize: 12, color: '#9CA3AF' },
  liveBadge: { 
    backgroundColor: '#EF4444', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  liveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { 
    flex: 1, 
    backgroundColor: '#F9FAFB', 
    padding: 20, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: { fontSize: 32, fontWeight: 'bold', color: '#2D8B47', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
});
