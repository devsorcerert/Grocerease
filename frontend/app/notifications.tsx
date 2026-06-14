import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'reward' | 'system' | 'promotion';
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    route?: string;
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/user/notifications');
        const formatted = (response.data.notifications || []).map((n: any) => ({
          ...n,
          timestamp: n.created_at || n.timestamp || new Date().toISOString()
        }));
        setNotifications(formatted);
      } catch (error) {
        console.warn('Could not load notifications:', error);
        setNotifications([]);
      }
    };
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order': return 'cube';
      case 'reward': return 'gift';
      case 'promotion': return 'megaphone';
      case 'system': return 'settings';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'order': return '#2D8B47';
      case 'reward': return '#FF8C42';
      case 'promotion': return '#EF4444';
      case 'system': return '#6B7280';
      default: return '#9CA3AF';
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      )
    );

    // Navigate if action exists
    if (notification.action?.route) {
      router.push(notification.action.route as any);
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const clearAllNotifications = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => setNotifications([])
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/home')} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Notifications {unreadCount > 0 && <Text style={styles.unreadBadge}>({unreadCount})</Text>}
          </Text>
          <TouchableOpacity onPress={markAllAsRead} style={styles.headerButton}>
            <Ionicons name="checkmark-done" size={24} color="#2D8B47" />
          </TouchableOpacity>
        </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptyText}>
            You&apos;re all caught up! Check back later for updates on your orders and rewards.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.content}>
            {notifications.map((notification) => (
              <View
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.unreadCard
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                  disabled={!!notification.action}
                >
                  <View style={styles.notificationHeader}>
                    <View style={[
                      styles.notificationIcon,
                      { backgroundColor: `${getNotificationColor(notification.type)}20` }
                    ]}>
                      <Ionicons 
                        name={getNotificationIcon(notification.type) as any} 
                        size={20} 
                        color={getNotificationColor(notification.type)} 
                      />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={[
                        styles.notificationTitle,
                        !notification.read && styles.unreadTitle
                      ]}>
                        {notification.title}
                      </Text>
                      <Text style={styles.notificationMessage}>
                        {notification.message}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {new Date(notification.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    {!notification.read && (
                      <View style={styles.unreadIndicator} />
                    )}
                  </View>
                </TouchableOpacity>
                
                {notification.action && (
                  <View style={styles.actionSection}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => {
                        // Mark as read
                        setNotifications(prev => 
                          prev.map(n => 
                            n.id === notification.id ? { ...n, read: true } : n
                          )
                        );
                        // Navigate to route
                        if (notification.action?.route) {
                          router.push(notification.action.route as any);
                        }
                      }}
                    >
                      <Text style={styles.actionButtonText}>
                        {notification.action.label}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#2D8B47" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={clearAllNotifications}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', flex: 1, textAlign: 'center' },
  unreadBadge: { color: '#EF4444', fontSize: 16 },
  
  content: { flex: 1, padding: 16 },
  
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  unreadCard: {
    borderColor: '#2D8B47',
    borderWidth: 1,
    backgroundColor: '#FAFFFE'
  },
  
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  
  notificationContent: { flex: 1 },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4
  },
  unreadTitle: {
    fontWeight: 'bold'
  },
  notificationMessage: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 8
  },
  notificationTime: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2D8B47',
    marginLeft: 8,
    marginTop: 4
  },
  
  actionSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D8B47'
  },
  
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff'
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444'
  },
  
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 16,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20
  }
});