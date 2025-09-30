import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';

export default function VideosScreen() {
  const [videos, setVideos] = useState<any[]>([]);
  const { addToCart } = useCartStore();

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await api.get('/videos');
      setVideos(response.data);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    }
  };

  const handleAddAllIngredients = async (video: any) => {
    try {
      for (const ingredient of video.ingredients) {
        if (ingredient.product_id) {
          await addToCart(ingredient.product_id, 1);
        }
      }
      Alert.alert('Success', 'All ingredients added to cart!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add ingredients');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>GrocerEase TV</Text>
        <Text style={styles.subtitle}>Cooking Shows & Recipes</Text>
      </View>

      <ScrollView style={styles.videoList}>
        {videos.map((video) => (
          <View key={video.id} style={styles.videoCard}>
            <View style={styles.videoThumbnail}>
              <Ionicons name="play-circle" size={48} color="#fff" />
              {video.is_live && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            <View style={styles.videoInfo}>
              <Text style={styles.videoTitle}>{video.title}</Text>
              <Text style={styles.videoDescription} numberOfLines={2}>{video.description}</Text>
              <Text style={styles.videoDuration}>{video.duration}</Text>
              
              {video.ingredients.length > 0 && (
                <TouchableOpacity 
                  style={styles.addIngredientsButton}
                  onPress={() => handleAddAllIngredients(video)}
                >
                  <Ionicons name="cart" size={16} color="#fff" />
                  <Text style={styles.addIngredientsText}>Add All Ingredients</Text>
                </TouchableOpacity>
              )}
            </View>
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
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  videoList: { flex: 1, padding: 16 },
  videoCard: { marginBottom: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB' },
  videoThumbnail: { width: '100%', height: 200, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  liveBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
  liveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  videoInfo: { padding: 16 },
  videoTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  videoDescription: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  videoDuration: { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },
  addIngredientsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  addIngredientsText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
});
