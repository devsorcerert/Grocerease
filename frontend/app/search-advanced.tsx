import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';
import { useCartStore } from '../store/cartStore';

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function AdvancedSearchPage() {
  const router = useRouter();
  const { q } = useLocalSearchParams();
  const initialQuery = Array.isArray(q) ? q[0] : q || '';
  
  const { addToCart } = useCartStore();
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState<any>(null);
  
  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [inStock, setInStock] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<string>('popularity');
  
  // UI States
  const [showFilters, setShowFilters] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    if (debouncedSearch || selectedCategory || selectedBrand || sortBy) {
      searchProducts();
    }
  }, [debouncedSearch, selectedCategory, selectedBrand, priceRange, inStock, sortBy, page]);

  const fetchFilterOptions = async () => {
    try {
      const response = await api.get('/products/filters/options');
      setFilterOptions(response.data);
      if (response.data.price_range) {
        setPriceRange({
          min: response.data.price_range.min,
          max: response.data.price_range.max
        });
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const searchProducts = async () => {
    try {
      setLoading(true);
      const params: any = {
        skip: page * 20,
        limit: 20,
      };
      
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedBrand) params.brand = selectedBrand;
      if (priceRange) {
        params.min_price = priceRange.min;
        params.max_price = priceRange.max;
      }
      if (inStock !== null) params.in_stock = inStock;
      if (sortBy) params.sort_by = sortBy;
      
      const response = await api.get('/products', { params });
      
      if (page === 0) {
        setProducts(response.data.products || []);
      } else {
        setProducts(prev => [...prev, ...(response.data.products || [])]);
      }
      
      setHasMore(response.data.has_more || false);
      setTotalResults(response.data.total || 0);
    } catch (error) {
      console.error('Search error:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart(productId, 1);
      Alert.alert('Success', 'Product added to cart!');
    } catch (error) {
      console.error('Failed to add to cart:', error);
      Alert.alert('Error', 'Failed to add product to cart');
    }
  };

  const toggleCompareSelection = (productId: string) => {
    if (selectedForCompare.includes(productId)) {
      setSelectedForCompare(prev => prev.filter(id => id !== productId));
    } else {
      if (selectedForCompare.length >= 5) {
        Alert.alert('Limit Reached', 'You can compare up to 5 products at a time');
        return;
      }
      setSelectedForCompare(prev => [...prev, productId]);
    }
  };

  const handleCompare = async () => {
    if (selectedForCompare.length < 2) {
      Alert.alert('Select Products', 'Please select at least 2 products to compare');
      return;
    }

    try {
      const response = await api.post('/products/compare', selectedForCompare);
      // Navigate to comparison page (to be created)
      Alert.alert('Comparison', `Comparing ${response.data.products.length} products`);
      // TODO: Navigate to dedicated comparison page
    } catch (error) {
      console.error('Comparison error:', error);
      Alert.alert('Error', 'Failed to compare products');
    }
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedBrand(null);
    setInStock(null);
    if (filterOptions?.price_range) {
      setPriceRange({
        min: filterOptions.price_range.min,
        max: filterOptions.price_range.max
      });
    }
    setPage(0);
  };

  const activeFiltersCount = [
    selectedCategory,
    selectedBrand,
    inStock !== null
  ].filter(Boolean).length;

  const sortOptions = [
    { label: 'Popularity', value: 'popularity' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
    { label: 'Name: A-Z', value: 'name_asc' },
    { label: 'Name: Z-A', value: 'name_desc' },
    { label: 'Rating', value: 'rating' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={!initialQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity 
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter" size={18} color={activeFiltersCount > 0 ? "#2D8B47" : "#111"} />
          <Text style={[styles.filterButtonText, activeFiltersCount > 0 && styles.filterButtonTextActive]}>
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowSortModal(true)}
        >
          <Ionicons name="swap-vertical" size={18} color="#111" />
          <Text style={styles.filterButtonText}>Sort</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterButton, compareMode && styles.filterButtonActive]}
          onPress={() => {
            setCompareMode(!compareMode);
            setSelectedForCompare([]);
          }}
        >
          <Ionicons name="git-compare" size={18} color={compareMode ? "#2D8B47" : "#111"} />
          <Text style={[styles.filterButtonText, compareMode && styles.filterButtonTextActive]}>
            Compare
          </Text>
        </TouchableOpacity>

        <View style={styles.resultsCount}>
          <Text style={styles.resultsCountText}>{totalResults} items</Text>
        </View>
      </View>

      {/* Compare Bar */}
      {compareMode && selectedForCompare.length > 0 && (
        <View style={styles.compareBar}>
          <Text style={styles.compareText}>{selectedForCompare.length} selected</Text>
          <TouchableOpacity style={styles.compareButton} onPress={handleCompare}>
            <Text style={styles.compareButtonText}>Compare Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Products Grid */}
      <ScrollView style={styles.content}>
        {loading && page === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2D8B47" />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>Try adjusting your filters or search terms</Text>
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearFilters}
            >
              <Text style={styles.clearButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {products.map((product) => (
              <View key={product.id} style={styles.productCard}>
                {compareMode && (
                  <TouchableOpacity
                    style={styles.compareCheckbox}
                    onPress={() => toggleCompareSelection(product.id)}
                  >
                    <View style={[
                      styles.checkbox,
                      selectedForCompare.includes(product.id) && styles.checkboxSelected
                    ]}>
                      {selectedForCompare.includes(product.id) && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                )}

                {product.image ? (
                  <Image source={{ uri: product.image }} style={styles.productImage} />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Ionicons name="cube-outline" size={40} color="#D1D5DB" />
                  </View>
                )}
                
                {product.stock === 0 && (
                  <View style={styles.outOfStockBadge}>
                    <Text style={styles.outOfStockText}>Out of Stock</Text>
                  </View>
                )}
                
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.productBrand}>{product.brand || product.category}</Text>
                  
                  {product.rating && (
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={14} color="#FF8C42" />
                      <Text style={styles.ratingText}>{product.rating}</Text>
                    </View>
                  )}
                  
                  <View style={styles.productFooter}>
                    <View style={styles.priceContainer}>
                      <Text style={styles.productPrice}>₹{product.price}</Text>
                      {product.offerPrice && product.offerPrice < product.price && (
                        <Text style={styles.productOldPrice}>₹{product.offerPrice}</Text>
                      )}
                    </View>
                    
                    {product.stock > 0 && !compareMode && (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => handleAddToCart(product.id)}
                      >
                        <Ionicons name="add" size={20} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {hasMore && !loading && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setPage(p => p + 1)}
          >
            <Text style={styles.loadMoreText}>Load More</Text>
          </TouchableOpacity>
        )}

        {loading && page > 0 && (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color="#2D8B47" />
          </View>
        )}
      </ScrollView>

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Category Filter */}
              {filterOptions?.categories && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Category</Text>
                  <View style={styles.filterOptions}>
                    <TouchableOpacity
                      style={[styles.filterOption, !selectedCategory && styles.filterOptionActive]}
                      onPress={() => setSelectedCategory(null)}
                    >
                      <Text style={[styles.filterOptionText, !selectedCategory && styles.filterOptionTextActive]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {filterOptions.categories.map((cat: string) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.filterOption, selectedCategory === cat && styles.filterOptionActive]}
                        onPress={() => setSelectedCategory(cat)}
                      >
                        <Text style={[styles.filterOptionText, selectedCategory === cat && styles.filterOptionTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Brand Filter */}
              {filterOptions?.brands && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Brand</Text>
                  <View style={styles.filterOptions}>
                    <TouchableOpacity
                      style={[styles.filterOption, !selectedBrand && styles.filterOptionActive]}
                      onPress={() => setSelectedBrand(null)}
                    >
                      <Text style={[styles.filterOptionText, !selectedBrand && styles.filterOptionTextActive]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {filterOptions.brands.slice(0, 10).map((brand: string) => (
                      <TouchableOpacity
                        key={brand}
                        style={[styles.filterOption, selectedBrand === brand && styles.filterOptionActive]}
                        onPress={() => setSelectedBrand(brand)}
                      >
                        <Text style={[styles.filterOptionText, selectedBrand === brand && styles.filterOptionTextActive]}>
                          {brand}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Stock Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Availability</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[styles.filterOption, inStock === null && styles.filterOptionActive]}
                    onPress={() => setInStock(null)}
                  >
                    <Text style={[styles.filterOptionText, inStock === null && styles.filterOptionTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterOption, inStock === true && styles.filterOptionActive]}
                    onPress={() => setInStock(true)}
                  >
                    <Text style={[styles.filterOptionText, inStock === true && styles.filterOptionTextActive]}>
                      In Stock
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterOption, inStock === false && styles.filterOptionActive]}
                    onPress={() => setInStock(false)}
                  >
                    <Text style={[styles.filterOptionText, inStock === false && styles.filterOptionTextActive]}>
                      Out of Stock
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  clearFilters();
                  setShowFilters(false);
                }}
              >
                <Text style={styles.clearFiltersButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyFiltersButton}
                onPress={() => {
                  setPage(0);
                  setShowFilters(false);
                }}
              >
                <Text style={styles.applyFiltersButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSortModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sortModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort By</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.sortOptions}>
              {sortOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.sortOption}
                  onPress={() => {
                    setSortBy(option.value);
                    setPage(0);
                    setShowSortModal(false);
                  }}
                >
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === option.value && styles.sortOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                  {sortBy === option.value && (
                    <Ionicons name="checkmark" size={24} color="#2D8B47" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
  },
  
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2D8B47',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#111',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#2D8B47',
  },
  resultsCount: {
    flex: 1,
    alignItems: 'flex-end',
  },
  resultsCountText: {
    fontSize: 12,
    color: '#6B7280',
  },
  
  compareBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#2D8B47',
  },
  compareText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  compareButton: {
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  compareButtonText: {
    fontSize: 13,
    color: '#2D8B47',
    fontWeight: '600',
  },
  
  content: { flex: 1 },
  
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  clearButton: {
    marginTop: 24,
    backgroundColor: '#2D8B47',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  
  productCard: {
    width: '48%',
    margin: '1%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compareCheckbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2D8B47',
    borderColor: '#2D8B47',
  },
  productImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#F3F4F6',
  },
  productImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D8B47',
  },
  productOldPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#2D8B47',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadMoreButton: {
    margin: 16,
    padding: 12,
    backgroundColor: '#2D8B47',
    borderRadius: 8,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingMore: {
    padding: 16,
    alignItems: 'center',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  modalBody: {
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterOptionActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2D8B47',
  },
  filterOptionText: {
    fontSize: 13,
    color: '#111',
  },
  filterOptionTextActive: {
    color: '#2D8B47',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  clearFiltersButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  clearFiltersButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  applyFiltersButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#2D8B47',
    borderRadius: 8,
    alignItems: 'center',
  },
  applyFiltersButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Sort Modal
  sortModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sortOptions: {
    padding: 8,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sortOptionText: {
    fontSize: 15,
    color: '#111',
  },
  sortOptionTextActive: {
    color: '#2D8B47',
    fontWeight: '600',
  },
});
