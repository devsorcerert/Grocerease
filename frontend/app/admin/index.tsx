import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AdminIndex() {
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!user?.is_admin) {
      Alert.alert('Access Denied', 'You do not have admin privileges', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
      ]);
      return;
    }
  }, [user]);

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="shield-outline" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>You need admin privileges to access this panel.</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Text style={styles.backButtonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity 
          onPress={() => router.push('/(tabs)/profile')} 
          style={styles.headerButton}
        >
          <Ionicons name="person-circle-outline" size={24} color="#111" />
        </TouchableOpacity>
      </View>

      <View style={styles.welcomeSection}>
        <View style={styles.welcomeCard}>
          <Ionicons name="shield-checkmark" size={48} color="#2D8B47" />
          <Text style={styles.welcomeTitle}>Welcome, Admin!</Text>
          <Text style={styles.welcomeText}>
            Manage your GrocerEase platform with comprehensive admin tools
          </Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => router.push('/admin/dashboard')}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="stats-chart" size={28} color="#2D8B47" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Dashboard & Analytics</Text>
            <Text style={styles.actionDesc}>View KPIs, product analytics, and performance metrics</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#2D8B47" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => router.push('/admin/products')}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="cube" size={28} color="#FF8C42" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Product Management</Text>
            <Text style={styles.actionDesc}>Add, edit, and manage your product catalog</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FF8C42" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => router.push('/admin/import')}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="cloud-upload" size={28} color="#8B5CF6" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Bulk Import</Text>
            <Text style={styles.actionDesc}>Upload products via Excel, manage bulk operations</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => router.push('/admin/features')}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="settings" size={28} color="#10B981" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Feature Management</Text>
            <Text style={styles.actionDesc}>Manage TV linking, rewards system, and advanced features</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#10B981" />
        </TouchableOpacity>
      </View>

      <View style={styles.adminInfo}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Admin Panel URL: <Text style={styles.infoUrl}>/admin</Text>
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="shield-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Logged in as: <Text style={styles.infoHighlight}>{user?.email}</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  headerButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111', flex: 1, textAlign: 'center' },
  
  welcomeSection: { padding: 20 },
  welcomeCard: { 
    backgroundColor: '#ECFDF5', 
    padding: 24, 
    borderRadius: 16, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D8B47'
  },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: '#111', marginTop: 16 },
  welcomeText: { 
    fontSize: 14, 
    color: '#6B7280', 
    textAlign: 'center', 
    marginTop: 8, 
    lineHeight: 20 
  },
  
  quickActions: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 16 },
  
  actionCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F9FAFB', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  actionIcon: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 16
  },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  actionDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  
  adminInfo: { padding: 20, marginTop: 20 },
  infoCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F3F4F6', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8 
  },
  infoText: { fontSize: 13, color: '#6B7280', marginLeft: 8 },
  infoUrl: { fontFamily: 'monospace', color: '#2D8B47', fontWeight: '600' },
  infoHighlight: { color: '#111', fontWeight: '600' },
  
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 24, fontWeight: 'bold', color: '#111', marginTop: 16 },
  errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  backButton: { backgroundColor: '#2D8B47', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});