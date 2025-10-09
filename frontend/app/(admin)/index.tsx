import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import * as XLSX from 'xlsx';

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Product form
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subcategory: '',
    price: '',
    original_price: '',
    unit: '',
    sku: '',
    barcode: '',
    brand: '',
    supplier: '',
    stock: '100',
    min_stock_level: '10',
    max_stock_level: '1000',
    discount_percentage: '0',
    description: '',
  });

  useEffect(() => {
    if (!user?.is_admin) {
      Alert.alert('Access Denied', 'You do not have admin privileges');
      router.replace('/(tabs)/home');
      return;
    }
    fetchProducts();
    fetchCategories();
    fetchAnalytics();
  }, [user]);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, selectedCategory, products]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
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

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/products/analytics');
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    setFilteredProducts(filtered);
    setCurrentPage(1);
  };

  const handleAddProduct = async () => {
    if (!formData.name || !formData.category || !formData.price || !formData.unit) {
      Alert.alert('Error', 'Please fill required fields (Name, Category, Price, Unit)');
      return;
    }

    setLoading(true);
    try {
      await api.post('/products', {
        ...formData,
        price: parseFloat(formData.price),
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        stock: parseInt(formData.stock),
        min_stock_level: parseInt(formData.min_stock_level),
        max_stock_level: parseInt(formData.max_stock_level),
        discount_percentage: parseFloat(formData.discount_percentage),
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        is_active: true,
        tags: [],
      });
      Alert.alert('Success', 'Product added successfully!');
      setFormData({
        name: '', category: '', subcategory: '', price: '', original_price: '', unit: '',
        sku: '', barcode: '', brand: '', supplier: '', stock: '100', min_stock_level: '10',
        max_stock_level: '1000', discount_percentage: '0', description: '',
      });
      fetchProducts();
      fetchAnalytics();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const handleExcelImport = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web file picker
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls,.csv';
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (file) {
            processExcelFile(file);
          }
        };
        input.click();
      } else {
        // Mobile file picker
        const result = await DocumentPicker.pick({
          type: [DocumentPicker.types.xlsx, DocumentPicker.types.xls],
        });
        // Process file for mobile
        Alert.alert('Info', 'Mobile Excel import will be implemented with file system');
      }
    } catch (error) {
      console.error('File picker error:', error);
    }
  };

  const processExcelFile = async (file: File) => {
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Transform Excel data to product format
        const productsToUpload = jsonData.map((row: any) => ({
          name: row.name || row.Name || row.product_name || row['Product Name'] || '',
          category: row.category || row.Category || '',
          subcategory: row.subcategory || row.Subcategory || row.category || '',
          price: parseFloat(row.price || row.Price || 0),
          original_price: row.original_price || row['Original Price'] ? parseFloat(row.original_price || row['Original Price']) : null,
          unit: row.unit || row.Unit || '1 pc',
          sku: row.sku || row.SKU || '',
          barcode: row.barcode || row.Barcode || '',
          brand: row.brand || row.Brand || '',
          supplier: row.supplier || row.Supplier || '',
          stock: parseInt(row.stock || row.Stock || 100),
          min_stock_level: parseInt(row.min_stock || row['Min Stock'] || 10),
          max_stock_level: parseInt(row.max_stock || row['Max Stock'] || 1000),
          discount_percentage: parseFloat(row.discount || row.Discount || 0),
          description: row.description || row.Description || '',
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          is_active: true,
          tags: [],
        }));

        // Bulk upload
        const response = await api.post('/products/bulk', {
          products: productsToUpload
        });

        Alert.alert('Success', `${response.data.count} products uploaded successfully!`);
        fetchProducts();
        fetchAnalytics();
      };
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to process Excel file');
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      {
        name: 'Sample Product',
        category: 'Fruits & Vegetables',
        subcategory: 'Vegetables',
        price: 50,
        original_price: 60,
        unit: '1 kg',
        sku: 'SKU001',
        barcode: '1234567890',
        brand: 'Fresh Farms',
        supplier: 'Local Supplier',
        stock: 100,
        min_stock: 10,
        max_stock: 1000,
        discount: 16.67,
        description: 'Fresh and organic'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'GrocerEase_Product_Template.xlsx');
  };

  const handleDeleteProduct = async (productId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/products/${productId}`);
              Alert.alert('Success', 'Product deleted');
              fetchProducts();
              fetchAnalytics();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete product');
            }
          }
        }
      ]
    );
  };

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity onPress={() => {
          logout();
          router.replace('/(auth)/welcome');
        }}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Ionicons name="stats-chart" size={18} color={activeTab === 'dashboard' ? '#2D8B47' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => setActiveTab('products')}
        >
          <Ionicons name="cube" size={18} color={activeTab === 'products' ? '#2D8B47' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'add' && styles.tabActive]}
          onPress={() => setActiveTab('add')}
        >
          <Ionicons name="add-circle" size={18} color={activeTab === 'add' ? '#2D8B47' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'add' && styles.tabTextActive]}>Add New</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'import' && styles.tabActive]}
          onPress={() => setActiveTab('import')}
        >
          <Ionicons name="cloud-upload" size={18} color={activeTab === 'import' ? '#2D8B47' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'import' && styles.tabTextActive]}>Import</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'dashboard' && analytics && (
          <View>
            <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Ionicons name="cube-outline" size={32} color="#2D8B47" />
                <Text style={styles.kpiValue}>{analytics.total_products}</Text>
                <Text style={styles.kpiLabel}>Total Products</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                <Text style={styles.kpiValue}>{analytics.active_products}</Text>
                <Text style={styles.kpiLabel}>Active</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="cash-outline" size={32} color="#F59E0B" />
                <Text style={styles.kpiValue}>₹{(analytics.total_stock_value / 1000).toFixed(1)}k</Text>
                <Text style={styles.kpiLabel}>Stock Value</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="warning-outline" size={32} color="#EF4444" />
                <Text style={styles.kpiValue}>{analytics.low_stock_items}</Text>
                <Text style={styles.kpiLabel}>Low Stock</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            <View style={styles.categoryBreakdown}>
              {Object.entries(analytics.categories || {}).map(([category, stats]: [string, any]) => (
                <View key={category} style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{category}</Text>
                    <Text style={styles.categoryStats}>{stats.count} products • ₹{stats.stock_value.toFixed(0)} value</Text>
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{stats.count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'products' && (
          <View>
            <View style={styles.searchSection}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, SKU, or barcode..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
                  onPress={() => setSelectedCategory('')}
                >
                  <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.filterChip, selectedCategory === cat.name && styles.filterChipActive]}
                    onPress={() => setSelectedCategory(cat.name)}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === cat.name && styles.filterChipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.resultsHeader}>
              <Text style={styles.resultsText}>{filteredProducts.length} products found</Text>
              <View style={styles.pagination}>
                <TouchableOpacity
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage(p => p - 1)}
                  style={styles.paginationButton}
                >
                  <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? '#D1D5DB' : '#2D8B47'} />
                </TouchableOpacity>
                <Text style={styles.paginationText}>{currentPage} / {totalPages || 1}</Text>
                <TouchableOpacity
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage(p => p + 1)}
                  style={styles.paginationButton}
                >
                  <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? '#D1D5DB' : '#2D8B47'} />
                </TouchableOpacity>
              </View>
            </View>

            {paginatedProducts.map((product) => (
              <View key={product.id} style={styles.productRow}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productDetails}>
                    {product.sku ? `SKU: ${product.sku} • ` : ''}{product.category} • ₹{product.price} • Stock: {product.stock}
                  </Text>
                  {product.brand && <Text style={styles.productBrand}>Brand: {product.brand}</Text>}
                </View>
                <TouchableOpacity onPress={() => handleDeleteProduct(product.id)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'add' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Add New Product</Text>
            <TextInput style={styles.input} placeholder="Product Name *" value={formData.name} onChangeText={(v) => setFormData({...formData, name: v})} />
            <TextInput style={styles.input} placeholder="Category *" value={formData.category} onChangeText={(v) => setFormData({...formData, category: v})} />
            <TextInput style={styles.input} placeholder="Subcategory" value={formData.subcategory} onChangeText={(v) => setFormData({...formData, subcategory: v})} />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Price (₹) *" value={formData.price} onChangeText={(v) => setFormData({...formData, price: v})} keyboardType="decimal-pad" />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Original Price" value={formData.original_price} onChangeText={(v) => setFormData({...formData, original_price: v})} keyboardType="decimal-pad" />
            </View>
            <TextInput style={styles.input} placeholder="Unit (e.g., 1 kg) *" value={formData.unit} onChangeText={(v) => setFormData({...formData, unit: v})} />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="SKU" value={formData.sku} onChangeText={(v) => setFormData({...formData, sku: v})} />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Barcode" value={formData.barcode} onChangeText={(v) => setFormData({...formData, barcode: v})} />
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Brand" value={formData.brand} onChangeText={(v) => setFormData({...formData, brand: v})} />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Supplier" value={formData.supplier} onChangeText={(v) => setFormData({...formData, supplier: v})} />
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.thirdInput]} placeholder="Stock" value={formData.stock} onChangeText={(v) => setFormData({...formData, stock: v})} keyboardType="number-pad" />
              <TextInput style={[styles.input, styles.thirdInput]} placeholder="Min Stock" value={formData.min_stock_level} onChangeText={(v) => setFormData({...formData, min_stock_level: v})} keyboardType="number-pad" />
              <TextInput style={[styles.input, styles.thirdInput]} placeholder="Max Stock" value={formData.max_stock_level} onChangeText={(v) => setFormData({...formData, max_stock_level: v})} keyboardType="number-pad" />
            </View>
            <TextInput style={[styles.input, styles.multilineInput]} placeholder="Description" value={formData.description} onChangeText={(v) => setFormData({...formData, description: v})} multiline numberOfLines={3} />
            <TouchableOpacity style={styles.addButton} onPress={handleAddProduct} disabled={loading}>
              <Text style={styles.addButtonText}>{loading ? 'Adding...' : 'Add Product'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'import' && (
          <View style={styles.importSection}>
            <Text style={styles.sectionTitle}>Bulk Import Products</Text>
            <View style={styles.importCard}>
              <Ionicons name="document-text-outline" size={48} color="#2D8B47" />
              <Text style={styles.importTitle}>Import from Excel</Text>
              <Text style={styles.importDescription}>Upload .xlsx or .csv file with product data</Text>
              <TouchableOpacity style={styles.importButton} onPress={handleExcelImport} disabled={loading}>
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <Text style={styles.importButtonText}>{loading ? 'Processing...' : 'Choose File'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.importCard}>
              <Ionicons name="download-outline" size={48} color="#FF8C42" />
              <Text style={styles.importTitle}>Download Template</Text>
              <Text style={styles.importDescription}>Get sample Excel file with required format</Text>
              <TouchableOpacity style={[styles.importButton, {backgroundColor: '#FF8C42'}]} onPress={downloadSampleExcel}>
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.importButtonText}>Download Template</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.importInfo}>
              <Text style={styles.importInfoTitle}>Required Excel Columns:</Text>
              <Text style={styles.importInfoText}>• name, category, price, unit (Required)</Text>
              <Text style={styles.importInfoText}>• sku, barcode, brand, supplier (Optional)</Text>
              <Text style={styles.importInfoText}>• stock, min_stock, max_stock (Optional)</Text>
              <Text style={styles.importInfoText}>• description, discount (Optional)</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2D8B47" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111', flex: 1, marginLeft: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2D8B47' },
  tabText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: '#2D8B47', fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  
  // KPI Cards
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  kpiCard: { width: '48%', backgroundColor: '#F9FAFB', padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  kpiValue: { fontSize: 28, fontWeight: 'bold', color: '#111', marginTop: 8 },
  kpiLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' },

  // Category Breakdown
  categoryBreakdown: { gap: 12 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12 },
  categoryInfo: { flex: 1 },
  categoryName: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  categoryStats: { fontSize: 12, color: '#6B7280' },
  categoryBadge: { backgroundColor: '#2D8B47', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  categoryBadgeText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Search & Filters
  searchSection: { marginBottom: 16 },
  searchInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 12 },
  filterChips: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8 },
  filterChipActive: { backgroundColor: '#2D8B47' },
  filterChipText: { fontSize: 14, color: '#6B7280' },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },

  // Results & Pagination
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  resultsText: { fontSize: 14, color: '#6B7280' },
  pagination: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paginationButton: { padding: 4 },
  paginationText: { fontSize: 14, fontWeight: '600', color: '#111' },

  // Product Rows
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 12 },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  productDetails: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  productBrand: { fontSize: 11, color: '#9CA3AF' },

  // Form
  form: { gap: 12 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16 },
  multilineInput: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  thirdInput: { flex: 1 },
  addButton: { backgroundColor: '#2D8B47', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Import Section
  importSection: { gap: 20 },
  importCard: { backgroundColor: '#F9FAFB', padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  importTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginTop: 12 },
  importDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 4, marginBottom: 16 },
  importButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2D8B47', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  importButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  importInfo: { backgroundColor: '#FFF7ED', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FF8C42' },
  importInfoTitle: { fontSize: 14, fontWeight: 'bold', color: '#111', marginBottom: 8 },
  importInfoText: { fontSize: 12, color: '#6B7280', marginVertical: 2 },

  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
});
