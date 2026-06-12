import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function CableTVSettingsScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    if (!user?.cable_tv_linked) return;
    
    try {
      const response = await api.get('/cable-tv/sync-status');
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  const handleForceSync = async () => {
    setLoading(true);
    try {
      const response = await api.post('/cable-tv/force-sync');
      Alert.alert('Sync Complete', 'Your cable TV data has been synchronized successfully.');
      fetchSyncStatus();
    } catch (error) {
      Alert.alert('Sync Failed', 'Unable to sync data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = () => {
    Alert.alert(
      'Unlink Cable TV',
      'Are you sure you want to unlink your cable TV? This will stop spending tracking and reward calculations.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              // Add unlink API call here when available
              Alert.alert('Success', 'Cable TV has been unlinked.');
              refreshUser();
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to unlink cable TV.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cable TV Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {!user?.cable_tv_linked ? (
          <View style={styles.notLinkedCard}>
            <Ionicons name="tv-outline" size={64} color="#9CA3AF" />
            <Text style={styles.notLinkedTitle}>Cable TV Not Linked</Text>
            <Text style={styles.notLinkedText}>
              Link your cable TV to track spending and unlock exclusive grocery rewards.
            </Text>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/(tabs)/home')}
            >
              <Text style={styles.linkButtonText}>Go to Home to Link</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Connection Status */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.statusIndicator}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.cardTitle}>Connected</Text>
                </View>
                <Text style={styles.providerText}>
                  {user.cable_tv_details?.service_provider || 'Cable TV Provider'}
                </Text>
              </View>
              
              <View style={styles.connectionDetails}>
                <Text style={styles.detailLabel}>User ID/NUID:</Text>
                <Text style={styles.detailValue}>
                  {user.cable_tv_details?.user_id_nuid || 'Not available'}
                </Text>
              </View>
              
              <View style={styles.connectionDetails}>
                <Text style={styles.detailLabel}>Last Sync:</Text>
                <Text style={styles.detailValue}>
                  {syncStatus?.last_sync ? new Date(syncStatus.last_sync).toLocaleString() : 'Never'}
                </Text>
              </View>
            </View>

            {/* Sync Settings */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sync Settings</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Auto Sync</Text>
                  <Text style={styles.settingDesc}>Automatically sync spending data</Text>
                </View>
                <Switch
                  value={autoSync}
                  onValueChange={setAutoSync}
                  trackColor={{ false: '#E5E7EB', true: '#2D8B47' }}
                  thumbColor={autoSync ? '#fff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Sync Notifications</Text>
                  <Text style={styles.settingDesc}>Get notified when data is synced</Text>
                </View>
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: '#E5E7EB', true: '#2D8B47' }}
                  thumbColor={notifications ? '#fff' : '#f4f3f4'}
                />
              </View>
              
              <TouchableOpacity
                style={[styles.syncButton, loading && styles.syncButtonDisabled]}
                onPress={handleForceSync}
                disabled={loading}
              >
                <Ionicons name="refresh" size={20} color="#2D8B47" />
                <Text style={styles.syncButtonText}>
                  {loading ? 'Syncing...' : 'Force Sync Now'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Infrastructure Info */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>API Integration Status</Text>
              <View style={styles.infrastructureInfo}>
                <Ionicons name="settings-outline" size={20} color="#6B7280" />
                <Text style={styles.infrastructureText}>
                  Infrastructure ready for real cable TV provider API integration.
                  Currently using mock data for demonstration.
                </Text>
              </View>
            </View>

            {/* Danger Zone */}
            <View style={styles.card}>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              <TouchableOpacity style={styles.unlinkButton} onPress={handleUnlink}>
                <Ionicons name="unlink" size={20} color="#EF4444" />
                <Text style={styles.unlinkButtonText}>Unlink Cable TV</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  content: { flex: 1, padding: 16 },
  
  // Not linked state
  notLinkedCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center'
  },
  notLinkedTitle: { fontSize: 20, fontWeight: 'bold', color: '#111', marginTop: 16 },
  notLinkedText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20
  },
  linkButton: {
    backgroundColor: '#2D8B47',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12
  },
  linkButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16
  },
  cardHeader: { marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  dangerTitle: { fontSize: 16, fontWeight: 'bold', color: '#EF4444', marginBottom: 16 },
  
  // Status
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  providerText: { fontSize: 14, color: '#6B7280' },
  
  // Connection details
  connectionDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14, color: '#6B7280' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  
  // Settings
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
  settingDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  
  // Sync button
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2D8B47',
    borderRadius: 12,
    padding: 12,
    marginTop: 8
  },
  syncButtonDisabled: { opacity: 0.5 },
  syncButtonText: { fontSize: 14, fontWeight: '600', color: '#2D8B47' },
  
  // Infrastructure
  infrastructureInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8
  },
  infrastructureText: { fontSize: 12, color: '#6B7280', flex: 1, lineHeight: 16 },
  
  // Unlink
  unlinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 12
  },
  unlinkButtonText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
});