import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

export default function OrderSuccessPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const total = params.total as string;
  const rewardUsed = params.rewardUsed as string;
  const cashbackEarned = params.cashbackEarned as string;
  const tier = params.tier as string;

  const { t } = useTranslation();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.checkmarkContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.checkmarkCircle}>
            <Ionicons name="checkmark" size={56} color="#fff" />
          </View>
        </Animated.View>

        <Animated.View style={[styles.details, { opacity: fadeAnim }]}>
          <Text style={styles.title}>{t('orderPlaced')}</Text>
          <Text style={styles.subtitle}>{t('orderPlacedSubtitle')}</Text>

          {orderId && (
            <View style={styles.orderIdContainer}>
              <Text style={styles.orderIdLabel}>{t('orderIdLabel')}</Text>
              <Text style={styles.orderIdValue}>#{orderId.slice(0, 8).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('amountPaid')}</Text>
              <Text style={styles.infoValue}>₹{total || '0'}</Text>
            </View>
            {rewardUsed && Number(rewardUsed) > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('rewardsUsed')}</Text>
                <Text style={[styles.infoValue, styles.rewardText]}>-₹{rewardUsed}</Text>
              </View>
            )}
            {cashbackEarned && Number(cashbackEarned) > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('cashbackEarned')}</Text>
                <Text style={[styles.infoValue, styles.cashbackText]}>+₹{cashbackEarned}</Text>
              </View>
            )}
            {tier && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('rewardTier')}</Text>
                <View style={styles.tierBadge}>
                  <Text style={styles.tierText}>{tier}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.deliveryInfo}>
            <Ionicons name="time-outline" size={20} color="#2D8B47" />
            <Text style={styles.deliveryText}>{t('estimatedDeliveryText')}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.trackButton}
              onPress={() => router.push(`/order-tracking/${orderId}`)}
            >
              <Ionicons name="location-outline" size={20} color="#fff" />
              <Text style={styles.trackButtonText}>{t('trackOrder')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.homeButton}
              onPress={() => router.replace('/(tabs)/home')}
            >
              <Ionicons name="home-outline" size={20} color="#2D8B47" />
              <Text style={styles.homeButtonText}>{t('continueShopping')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ordersButton}
              onPress={() => router.push('/orders')}
            >
              <Text style={styles.ordersButtonText}>{t('viewAllOrders')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  checkmarkContainer: {
    marginBottom: 24,
  },
  checkmarkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2D8B47',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D8B47',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  details: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
  },
  orderIdContainer: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D8B47',
  },
  orderIdLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  orderIdValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D8B47',
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  rewardText: { color: '#2D8B47' },
  cashbackText: { color: '#FF8C42' },
  tierBadge: {
    backgroundColor: '#FF8C42',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  deliveryText: {
    fontSize: 14,
    color: '#2D8B47',
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2D8B47',
    paddingVertical: 16,
    borderRadius: 12,
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2D8B47',
  },
  homeButtonText: {
    color: '#2D8B47',
    fontSize: 16,
    fontWeight: '600',
  },
  ordersButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  ordersButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
