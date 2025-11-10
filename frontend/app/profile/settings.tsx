import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  // Notification preferences
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(true);
  const [newArrivals, setNewArrivals] = useState(false);
  const [priceDrops, setPriceDrops] = useState(true);
  
  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Password change
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      await api.post('/auth/change-password', {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      });
      
      Alert.alert('Success', 'Password changed successfully!');
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to change password');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/auth/delete-account');
      Alert.alert('Account Deleted', 'Your account has been deleted successfully', [
        { text: 'OK', onPress: () => logout() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    }
  };

  const handleSaveNotificationPreferences = async () => {
    try {
      await api.post('/user/notification-preferences', {
        order_updates: orderUpdates,
        promotions: promotions,
        new_arrivals: newArrivals,
        price_drops: priceDrops,
      });
      Alert.alert('Success', 'Notification preferences saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save preferences');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/profile/edit')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="person-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/profile/addresses')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="location-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Manage Addresses</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/profile/payment-methods')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="card-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Payment Methods</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setShowPasswordModal(true)}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="lock-closed-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Order Updates</Text>
            </View>
            <Switch
              value={orderUpdates}
              onValueChange={setOrderUpdates}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={orderUpdates ? '#2D8B47' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="pricetag-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Promotions & Offers</Text>
            </View>
            <Switch
              value={promotions}
              onValueChange={setPromotions}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={promotions ? '#2D8B47' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="sparkles-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>New Arrivals</Text>
            </View>
            <Switch
              value={newArrivals}
              onValueChange={setNewArrivals}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={newArrivals ? '#2D8B47' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="trending-down-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Price Drops</Text>
            </View>
            <Switch
              value={priceDrops}
              onValueChange={setPriceDrops}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={priceDrops ? '#2D8B47' : '#f4f3f4'}
            />
          </View>

          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSaveNotificationPreferences}
          >
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          </TouchableOpacity>
        </View>

        {/* Orders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orders</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/orders')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="receipt-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Order History</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Privacy & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/profile/privacy-policy')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/profile/terms')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="document-text-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/profile/help-support')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle-outline" size={22} color="#2D8B47" />
              <Text style={styles.settingText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          
          <TouchableOpacity 
            style={[styles.settingItem, styles.dangerItem]}
            onPress={() => setShowDeleteModal(true)}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="trash-outline" size={22} color="#DC2626" />
              <Text style={[styles.settingText, styles.dangerText]}>Delete Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Password Change Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.currentPassword}
                  onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
                  secureTextEntry
                  placeholder="Enter current password"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.newPassword}
                  onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
                  secureTextEntry
                  placeholder="Enter new password"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.confirmPassword}
                  onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                  secureTextEntry
                  placeholder="Confirm new password"
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPasswordModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handlePasswordChange}
              >
                <Text style={styles.modalConfirmText}>Change Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Ionicons name="warning" size={48} color="#DC2626" />
            <Text style={styles.alertTitle}>Delete Account?</Text>
            <Text style={styles.alertText}>
              This action cannot be undone. All your data will be permanently deleted.
            </Text>
            
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={styles.alertCancelButton}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.alertCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertDeleteButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  handleDeleteAccount();
                }}
              >
                <Text style={styles.alertDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  
  content: {
    flex: 1,
  },
  
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 15,
    color: '#111',
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#DC2626',
  },
  
  saveButton: {
    margin: 16,
    backgroundColor: '#2D8B47',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#F9FAFB',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#2D8B47',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Alert Modal
  alertModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 16,
  },
  alertText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  alertCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  alertCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  alertDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  alertDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
