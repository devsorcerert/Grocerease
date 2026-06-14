import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'reward' | 'system' | 'promotion';
  created_at: string;
  read: boolean;
  action_route?: string;
}

const BRAND = '#2D8B47';

function getIcon(type: string) {
  switch (type) {
    case 'order': return 'cube';
    case 'reward': return 'gift';
    case 'promotion': return 'megaphone';
    default: return 'notifications';
  }
}

function getColor(type: string) {
  switch (type) {
    case 'order': return BRAND;
    case 'reward': return '#FF8C42';
    case 'promotion': return '#EF4444';
    default: return '#6B7280';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchNotifications(); }, []);

  const handlePress = async (n: Notification) => {
    if (!n.read) {
      try {
        await api.post(`/notifications/${n.id}/read`);
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      } catch {}
    }
    if (n.action_route) router.push(n.action_route as any);
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllRead} style={styles.headerButton}>
              <Ionicons name="checkmark-done" size={24} color={BRAND} />
            </TouchableOpacity>
          ) : <View style={styles.headerButton} />}
        </View>

        {notifications.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="notifications-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No notifications yet. Order something to get started.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(true); }} colors={[BRAND]} />}
          >
            {notifications.map(n => (
              <TouchableOpacity key={n.id} style={[styles.card, !n.read && styles.cardUnread]} onPress={() => handlePress(n)} activeOpacity={0.75}>
                <View style={[styles.iconWrap, { backgroundColor: `${getColor(n.type)}18` }]}>
                  <Ionicons name={getIcon(n.type) as any} size={22} color={getColor(n.type)} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardTitle, !n.read && styles.cardTitleBold]} numberOfLines={1}>{n.title}</Text>
                    <Text style={styles.cardTime}>{timeAgo(n.created_at)}</Text>
                  </View>
                  <Text style={styles.cardMsg} numberOfLines={2}>{n.message}</Text>
                  {n.action_route && (
                    <View style={styles.actionRow}>
                      <Text style={styles.actionText}>View details</Text>
                      <Ionicons name="chevron-forward" size={14} color={BRAND} />
                    </View>
                  )}
                </View>
                {!n.read && <View style={styles.dot} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', flex: 1, textAlign: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#374151' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  list: { flex: 1, padding: 16 },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6', gap: 12 },
  cardUnread: { borderColor: BRAND, backgroundColor: '#FAFFFE' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '500', color: '#111', flex: 1 },
  cardTitleBold: { fontWeight: '700' },
  cardTime: { fontSize: 11, color: '#9CA3AF', marginLeft: 8 },
  cardMsg: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 2 },
  actionText: { fontSize: 12, fontWeight: '600', color: BRAND },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND, marginTop: 6 },
});
