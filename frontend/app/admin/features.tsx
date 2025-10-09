import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

export default function AdminFeatures() {
  const { user } = useAuth();
  const router = useRouter();
  const [features, setFeatures] = useState({
    cableTVIntegration: true,
    autoRewards: true,
    bulkIngredients: true,
    advancedAnalytics: false
  });
  const [stats, setStats] = useState({
    linkedTVUsers: 0,
    totalRewards: 0,
    ingredientAdditions: 0
  });

  useEffect(() => {
    if (!user?.is_admin) {
      Alert.alert('Access Denied', 'Admin privileges required');
      router.replace('/(tabs)/home');
      return;
    }
    fetchFeatureStats();
  }, [user]);

  const fetchFeatureStats = async () => {
    try {
      // Mock data for feature statistics
      setStats({
        linkedTVUsers: 12,
        totalRewards: 25630,
        ingredientAdditions: 89
      });
    } catch (error) {
      console.error('Failed to fetch feature stats:', error);
    }
  };

  const toggleFeature = (featureName: keyof typeof features) => {
    setFeatures(prev => ({
      ...prev,
      [featureName]: !prev[featureName]
    }));
    Alert.alert('Feature Updated', `${featureName} has been ${!features[featureName] ? 'enabled' : 'disabled'}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Feature Management</Text>
        <TouchableOpacity onPress={() => router.push('/admin')}>
          <Ionicons name="home-outline" size={24} color="#111" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Infrastructure Features</Text>
          <Text style={styles.sectionSubtitle}>Manage advanced platform capabilities</Text>
          
          <View style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <View style={styles.featureIcon}>
                <Ionicons name="tv" size={24} color="#2D8B47" />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureName}>Cable TV Integration</Text>
                <Text style={styles.featureDesc}>API-ready cable TV linking system</Text>
              </View>
              <Switch
                value={features.cableTVIntegration}
                onValueChange={() => toggleFeature('cableTVIntegration')}
                trackColor={{ false: '#E5E7EB', true: '#2D8B47' }}
                thumbColor={features.cableTVIntegration ? '#fff' : '#f4f3f4'}
              />
            </View>
            <View style={styles.featureStats}>
              <Text style={styles.statValue}>{stats.linkedTVUsers}</Text>
              <Text style={styles.statLabel}>Linked TV Users</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <View style={styles.featureIcon}>
                <Ionicons name="gift" size={24} color="#FF8C42" />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureName}>Auto-Rewards System</Text>
                <Text style={styles.featureDesc}>Tier-based automatic reward application</Text>
              </View>
              <Switch
                value={features.autoRewards}
                onValueChange={() => toggleFeature('autoRewards')}
                trackColor={{ false: '#E5E7EB', true: '#FF8C42' }}
                thumbColor={features.autoRewards ? '#fff' : '#f4f3f4'}
              />
            </View>
            <View style={styles.featureStats}>
              <Text style={styles.statValue}>₹{stats.totalRewards}</Text>
              <Text style={styles.statLabel}>Total Rewards Given</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <View style={styles.featureIcon}>
                <Ionicons name="restaurant" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureName}>Bulk Ingredients</Text>
                <Text style={styles.featureDesc}>One-click ingredient addition from videos</Text>
              </View>
              <Switch
                value={features.bulkIngredients}
                onValueChange={() => toggleFeature('bulkIngredients')}
                trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
                thumbColor={features.bulkIngredients ? '#fff' : '#f4f3f4'}
              />
            </View>
            <View style={styles.featureStats}>
              <Text style={styles.statValue}>{stats.ingredientAdditions}</Text>
              <Text style={styles.statLabel}>Ingredient Bulk Adds</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <View style={styles.featureIcon}>
                <Ionicons name="analytics" size={24} color="#10B981" />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureName}>Advanced Analytics</Text>
                <Text style={styles.featureDesc}>Deep insights and predictive analytics</Text>
              </View>
              <Switch
                value={features.advancedAnalytics}
                onValueChange={() => toggleFeature('advancedAnalytics')}
                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                thumbColor={features.advancedAnalytics ? '#fff' : '#f4f3f4'}
              />
            </View>
            <View style={styles.featureStats}>
              <Text style={styles.statValue}>Coming Soon</Text>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Integration Status</Text>
          
          <View style={styles.apiCard}>
            <View style={styles.apiHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.apiTitle}>Infrastructure Ready</Text>
            </View>
            <Text style={styles.apiDesc}>All features have mock infrastructure in place and are ready for real API integration when keys are provided.</Text>
          </View>

          <View style={styles.apiCard}>
            <View style={styles.apiHeader}>
              <Ionicons name="settings-outline" size={20} color="#6B7280" />
              <Text style={styles.apiTitle}>Pending Integration</Text>
            </View>
            <Text style={styles.apiDesc}>• Cable TV Provider APIs\n• Advanced Reward Algorithms\n• Real-time Ingredient Mapping</Text>
          </View>
        </View>
      </ScrollView>
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
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111', flex: 1, textAlign: 'center' },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  
  featureCard: { 
    backgroundColor: '#F9FAFB', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  featureHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 12
  },
  featureInfo: { flex: 1 },
  featureName: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 2 },
  featureDesc: { fontSize: 13, color: '#6B7280' },
  featureStats: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  
  apiCard: { 
    backgroundColor: '#ECFDF5', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5'
  },
  apiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  apiTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginLeft: 8 },
  apiDesc: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
});