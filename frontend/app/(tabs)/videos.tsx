import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  Modal, FlatList, Image, Dimensions, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';

const BRAND = '#2D8B47';

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getYouTubeThumbnail(url: string): string {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  stream_url?: string;
  duration: string;
  ingredients: { product_id: string; name: string; quantity: number }[];
  is_live: boolean;
}

export default function VideosScreen() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [addingCart, setAddingCart] = useState(false);
  const { fetchCart } = useCartStore();

  useEffect(() => { fetchVideos(); }, []);

  // Render free-tier cold start can exceed the first request's window, so the
  // first call may time out even though the endpoint is healthy. Retry once
  // (by which point the instance is warm) before showing an error, and never
  // swallow the failure silently — a real error must be visible, not disguised
  // as an empty "No videos yet".
  const fetchVideos = async (attempt = 1) => {
    try {
      const res = await api.get('/videos');
      setVideos(Array.isArray(res.data) ? res.data : []);
      setError(false);
      setLoading(false);
    } catch (e: any) {
      console.error(
        `[videos] fetch attempt ${attempt} failed:`,
        e?.message || e, e?.code, e?.response?.status,
      );
      if (attempt < 2) {
        setTimeout(() => fetchVideos(attempt + 1), 3000);
      } else {
        setError(true);
        setLoading(false);
      }
    }
  };

  const retryVideos = () => {
    setLoading(true);
    setError(false);
    fetchVideos();
  };

  const handleAddAllIngredients = async (video: Video) => {
    if (!video.ingredients?.length) {
      Alert.alert('No Ingredients', 'This recipe has no mapped ingredients yet.');
      return;
    }
    setAddingCart(true);
    try {
      const res = await api.post('/cart/add-bulk', {
        ingredient_list: video.ingredients.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity || 1,
          name: i.name || 'Ingredient',
        })),
      });
      fetchCart();
      const { added_count, failed_ingredients } = res.data;
      if (added_count > 0) {
        Alert.alert(
          'Added to Cart! 🛒',
          failed_ingredients?.length
            ? `${added_count} items added. ${failed_ingredients.length} need product mapping.`
            : `All ${added_count} ingredients added!`,
        );
      } else {
        Alert.alert('Nothing Added', 'Ingredients need product mapping. Contact support.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to add ingredients.');
    } finally { setAddingCart(false); }
  };

  const getEmbedUrl = (video: Video): string => {
    if (!video.stream_url) return '';
    const ytId = getYouTubeId(video.stream_url);
    if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0`;
    return video.stream_url;
  };

  const getThumbnail = (video: Video): string => {
    if (video.thumbnail?.startsWith('http')) return video.thumbnail;
    if (video.stream_url) {
      const t = getYouTubeThumbnail(video.stream_url);
      if (t) return t;
    }
    return '';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>GrocerEase TV</Text>
          <Text style={styles.subtitle}>Watch & cook — add ingredients instantly</Text>
        </View>
        <Ionicons name="tv" size={28} color={BRAND} />
      </View>

      {videos.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name={error ? 'cloud-offline-outline' : 'videocam-off-outline'} size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>{error ? "Couldn't load videos" : 'No videos yet'}</Text>
          <Text style={styles.emptySubtext}>
            {error ? 'Check your connection and try again.' : 'Check back soon for cooking shows!'}
          </Text>
          {error && (
            <TouchableOpacity style={styles.retryBtn} onPress={retryVideos}>
              <Ionicons name="refresh" size={16} color={BRAND} />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {videos.map(video => {
            const thumb = getThumbnail(video);
            const hasStream = !!video.stream_url;
            return (
              <View key={video.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.thumbnailContainer}
                  onPress={() => hasStream && (setActiveVideo(video), setShowPlayer(true))}
                  activeOpacity={hasStream ? 0.8 : 1}
                >
                  {thumb
                    ? <Image source={{ uri: thumb }} style={styles.thumbnail} resizeMode="cover" />
                    : <View style={styles.thumbnailPlaceholder} />
                  }
                  <View style={styles.thumbnailOverlay}>
                    {hasStream
                      ? <View style={styles.playButton}><Ionicons name="play" size={28} color="#fff" /></View>
                      : <View style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>Coming Soon</Text></View>
                    }
                  </View>
                  {video.is_live && (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                  )}
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{video.duration}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.cardBody}>
                  <Text style={styles.videoTitle}>{video.title}</Text>
                  <Text style={styles.videoDesc} numberOfLines={2}>{video.description}</Text>
                  <View style={styles.cardActions}>
                    {hasStream && (
                      <TouchableOpacity style={styles.watchBtn} onPress={() => { setActiveVideo(video); setShowPlayer(true); }}>
                        <Ionicons name="play-circle-outline" size={16} color={BRAND} />
                        <Text style={styles.watchBtnText}>Watch</Text>
                      </TouchableOpacity>
                    )}
                    {video.ingredients.length > 0 && (
                      <>
                        <TouchableOpacity style={styles.ingredientsBtn} onPress={() => { setActiveVideo(video); setShowIngredients(true); }}>
                          <Ionicons name="list-outline" size={16} color="#6B7280" />
                          <Text style={styles.ingredientsBtnText}>{video.ingredients.length} ingredients</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.addCartBtn, addingCart && { opacity: 0.6 }]} onPress={() => handleAddAllIngredients(video)} disabled={addingCart}>
                          <Ionicons name="cart" size={16} color="#fff" />
                          <Text style={styles.addCartBtnText}>{addingCart ? 'Adding…' : 'Add All'}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Video Player Modal */}
      <Modal visible={showPlayer} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowPlayer(false)}>
        <SafeAreaView style={styles.playerModal}>
          <View style={styles.playerHeader}>
            <TouchableOpacity onPress={() => setShowPlayer(false)} style={styles.closeBtn}>
              <Ionicons name="chevron-down" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.playerTitle} numberOfLines={1}>{activeVideo?.title}</Text>
            {activeVideo && activeVideo.ingredients.length > 0 && (
              <TouchableOpacity style={styles.ingrHeaderBtn} onPress={() => { setShowPlayer(false); setShowIngredients(true); }}>
                <Ionicons name="cart-outline" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          {activeVideo && (
            <WebView
              source={{ uri: getEmbedUrl(activeVideo) }}
              style={styles.webview}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
            />
          )}
          {activeVideo && activeVideo.ingredients.length > 0 && (
            <View style={styles.playerBottom}>
              <TouchableOpacity style={[styles.playerAddBtn, addingCart && { opacity: 0.6 }]} onPress={() => handleAddAllIngredients(activeVideo)} disabled={addingCart}>
                <Ionicons name="cart" size={20} color="#fff" />
                <Text style={styles.playerAddBtnText}>{addingCart ? 'Adding…' : `Add ${activeVideo.ingredients.length} Ingredients to Cart`}</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Ingredients Bottom Sheet */}
      <Modal visible={showIngredients} animationType="slide" transparent onRequestClose={() => setShowIngredients(false)}>
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Ingredients</Text>
              <TouchableOpacity onPress={() => setShowIngredients(false)}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>
            <Text style={styles.bottomSheetRecipe}>{activeVideo?.title}</Text>
            <FlatList
              data={activeVideo?.ingredients || []}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <View style={styles.ingredientRow}>
                  <View style={styles.ingredientDot} />
                  <Text style={styles.ingredientName}>{item.name}</Text>
                  <Text style={styles.ingredientQty}>×{item.quantity || 1}</Text>
                </View>
              )}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={[styles.addAllBtn, addingCart && { opacity: 0.6 }]} onPress={() => { setShowIngredients(false); if (activeVideo) handleAddAllIngredients(activeVideo); }} disabled={addingCart}>
              <Ionicons name="cart" size={20} color="#fff" />
              <Text style={styles.addAllBtnText}>{addingCart ? 'Adding…' : 'Add All Ingredients to Cart'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#6B7280' },
  emptySubtext: { fontSize: 13, color: '#9CA3AF' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: BRAND },
  retryBtnText: { color: BRAND, fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  thumbnailContainer: { position: 'relative', width: '100%', height: 200 },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1F2937' },
  thumbnailOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  playButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  comingSoonBadge: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  comingSoonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  liveBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  durationBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardBody: { padding: 14 },
  videoTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 4 },
  videoDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  watchBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: BRAND },
  watchBtnText: { color: BRAND, fontSize: 13, fontWeight: '600' },
  ingredientsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  ingredientsBtnText: { color: '#6B7280', fontSize: 13 },
  addCartBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: BRAND },
  addCartBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  playerModal: { flex: 1, backgroundColor: '#000' },
  playerHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  closeBtn: { padding: 4 },
  playerTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  ingrHeaderBtn: { padding: 4 },
  webview: { flex: 1 },
  playerBottom: { padding: 12 },
  playerAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, paddingVertical: 14, borderRadius: 12 },
  playerAddBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  bottomSheet: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheetContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  bottomSheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  bottomSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bottomSheetTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  bottomSheetRecipe: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', gap: 10 },
  ingredientDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND },
  ingredientName: { flex: 1, fontSize: 15, color: '#111' },
  ingredientQty: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  addAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, paddingVertical: 14, borderRadius: 12, marginTop: 16 },
  addAllBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
