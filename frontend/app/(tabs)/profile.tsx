import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../utils/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { t, language, changeLanguage } = useTranslation();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data.orders || response.data || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };


  const handleLogout = () => {
    Alert.alert(t('logout'), 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Info Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Account Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('personalInfo')}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{orders.length}</Text>
              <Text style={styles.statLabel}>{t('myOrders')}</Text>
            </View>
          </View>
        </View>


        {/* Language Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('languageSettings')}</Text>
          <View style={styles.langGrid}>
            <TouchableOpacity
              style={[styles.langPill, language === 'en' && styles.activeLangPill]}
              onPress={() => changeLanguage('en')}
            >
              <Text style={[styles.langPillText, language === 'en' && styles.activeLangPillText]}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langPill, language === 'hi' && styles.activeLangPill]}
              onPress={() => changeLanguage('hi')}
            >
              <Text style={[styles.langPillText, language === 'hi' && styles.activeLangPillText]}>हिन्दी (Hindi)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langPill, language === 'te' && styles.activeLangPill]}
              onPress={() => changeLanguage('te')}
            >
              <Text style={[styles.langPillText, language === 'te' && styles.activeLangPillText]}>తెలుగు (Telugu)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('myOrders')}</Text>
          {orders.length === 0 ? (
            <Text style={styles.emptyText}>No orders yet</Text>
          ) : (
            orders.slice(0, 2).map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
                  <Text style={styles.orderStatus}>{order.status}</Text>
                </View>
                <Text style={styles.orderTotal}>₹{order.total}</Text>
                <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
              </View>
            ))
          )}
        </View>

        {/* Actions Menu */}
        <View style={styles.section}>


          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/edit')}>
            <Ionicons name="person-outline" size={24} color="#374151" />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/orders')}>
            <Ionicons name="receipt-outline" size={24} color="#374151" />
            <Text style={styles.menuText}>Order History</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/wishlist' as any)}>
            <Ionicons name="heart-outline" size={24} color="#EF4444" />
            <Text style={styles.menuText}>My Wishlist</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications' as any)}>
            <Ionicons name="notifications-outline" size={24} color="#374151" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/addresses')}>
            <Ionicons name="location-outline" size={24} color="#374151" />
            <Text style={styles.menuText}>{t('addresses')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/cable-tv-settings')}>
            <Ionicons name="tv-outline" size={24} color="#374151" />
            <Text style={styles.menuText}>Cable TV Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/help-support')}>
            <Ionicons name="help-circle-outline" size={24} color="#374151" />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Admin Panel — visible to any user with is_admin: true (all platforms) */}
          {user?.is_admin === true && (
            <TouchableOpacity
              style={[styles.menuItem, styles.adminMenuItem]}
              onPress={() => router.push('/admin')}
            >
              <Ionicons name="shield-checkmark" size={24} color="#2D8B47" />
              <Text style={[styles.menuText, styles.adminMenuText]}>Admin Panel</Text>
              <Ionicons name="chevron-forward" size={20} color="#2D8B47" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            <Text style={[styles.menuText, styles.logoutText]}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFDFB',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2D8B47',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#2D8B47',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  langGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  langPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeLangPill: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2D8B47',
    borderWidth: 1.5,
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  activeLangPillText: {
    color: '#2D8B47',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  orderCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  orderStatus: {
    fontSize: 12,
    color: '#2D8B47',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  adminMenuItem: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  adminMenuText: {
    color: '#2D8B47',
    fontWeight: '600',
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
    fontWeight: '500',
  },
  logoutItem: {
    marginTop: 12,
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#EF4444',
  },
  rewardsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  rewardsContainer: { gap: 16 },
  rewardCard: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  rewardCardTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  rewardStatsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 12 },
  rewardStat: { alignItems: 'center', flex: 1 },
  rewardStatValue: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  rewardStatLabel: { fontSize: 10, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  rewardStatDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },
  progressBarContainer: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 8, marginTop: 4 },
  progressBar: { height: '100%', backgroundColor: '#2D8B47', borderRadius: 3 },
  nextTierText: { fontSize: 11, color: '#6B7280', textAlign: 'center' },
});
