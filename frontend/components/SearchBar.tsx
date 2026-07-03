import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, FlatList, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../utils/api';

interface SearchBarProps {
  placeholder?: string;
}

export default function SearchBar({ placeholder = 'Search products...' }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Debounce search
    const timer = setTimeout(() => {
      searchProducts(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const searchProducts = async (searchQuery: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/products?search=${encodeURIComponent(searchQuery)}`);
      setResults(response.data.products?.slice(0, 5) || []);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = (product: any) => {
    setQuery('');
    setShowResults(false);
    // Open the selected product's detail page (was wrongly routing to the
    // category-filtered listing).
    router.push({ pathname: '/product/[productId]', params: { productId: product.id } });
  };

  const handleSearchSubmit = () => {
    if (query.trim().length > 0) {
      setShowResults(false);
      router.push(`/search-advanced?q=${encodeURIComponent(query)}`);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {showResults && results.length > 0 && (
        <View style={styles.resultsDropdown}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => handleSelectResult(item)}
              >
                <Ionicons name="cube-outline" size={18} color="#6B7280" />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultCategory}>{item.category}</Text>
                </View>
                <Text style={styles.resultPrice}>₹{item.price}</Text>
              </TouchableOpacity>
            )}
            ListFooterComponent={
              query.length >= 2 ? (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={handleSearchSubmit}
                >
                  <Text style={styles.viewAllText}>View all results for &quot;{query}&quot;</Text>
                  <Ionicons name="arrow-forward" size={16} color="#2D8B47" />
                </TouchableOpacity>
              ) : null
            }
          />
        </View>
      )}

      {showResults && results.length === 0 && !loading && query.length >= 2 && (
        <View style={styles.resultsDropdown}>
          <View style={styles.noResults}>
            <Ionicons name="search-outline" size={32} color="#D1D5DB" />
            <Text style={styles.noResultsText}>No products found</Text>
          </View>
        </View>
      )}

      {loading && (
        <View style={styles.resultsDropdown}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111',
  },
  clearButton: {
    padding: 4,
  },
  resultsDropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 300,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  resultCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D8B47',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: '#2D8B47',
    fontWeight: '500',
  },
  noResults: {
    padding: 32,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
