import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProducts = async (category?: string) => {
    try {
      const response = await api.get('/products', { params: category ? { category } : {} });
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    fetchProducts(categoryName);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryList}>
        <TouchableOpacity 
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => { setSelectedCategory(null); fetchProducts(); }}
        >
          <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity 
            key={cat.id} 
            style={[styles.categoryChip, selectedCategory === cat.name && styles.categoryChipActive]}
            onPress={() => handleCategorySelect(cat.name)}
          >
            <Text style={[styles.categoryChipText, selectedCategory === cat.name && styles.categoryChipTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.productList}>
        {products.map((product) => (
          <View key={product.id} style={styles.productItem}>
            <View style={styles.productImage}>
              <Ionicons name="bag-outline" size={40} color="#10B981" />
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productUnit}>{product.unit}</Text>
              <Text style={styles.productPrice}>₹{product.price}</Text>
            </View>
            <TouchableOpacity style={styles.addButton}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  categoryList: { padding: 16, maxHeight: 60 },
  categoryChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#10B981' },
  categoryChipText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff' },
  productList: { flex: 1, padding: 16 },
  productItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 12 },
  productImage: { width: 60, height: 60, backgroundColor: '#E5E7EB', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 16, fontWeight: '600', color: '#111' },
  productUnit: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  productPrice: { fontSize: 16, fontWeight: 'bold', color: '#10B981', marginTop: 4 },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
});
