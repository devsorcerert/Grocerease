import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface PaymentMethod {
  id: string;
  type: 'card' | 'upi';
  card_number?: string;
  card_holder?: string;
  expiry?: string;
  upi_id?: string;
  is_default: boolean;
}

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: '1',
      type: 'card',
      card_number: '**** **** **** 1234',
      card_holder: 'John Doe',
      expiry: '12/25',
      is_default: true,
    },
    {
      id: '2',
      type: 'upi',
      upi_id: 'john@paytm',
      is_default: false,
    },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'card' | 'upi'>('card');

  const handleAddCard = () => {
    setModalType('card');
    setShowModal(true);
  };

  const handleAddUPI = () => {
    setModalType('upi');
    setShowModal(true);
  };

  const handleDeleteMethod = (id: string) => {
    Alert.alert(
      'Delete Payment Method',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
            Alert.alert('Success', 'Payment method removed');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.addButtonsContainer}>
          <TouchableOpacity style={styles.addMethodButton} onPress={handleAddCard}>
            <Ionicons name="card-outline" size={24} color="#2D8B47" />
            <Text style={styles.addMethodText}>Add Card</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addMethodButton} onPress={handleAddUPI}>
            <Ionicons name="qr-code-outline" size={24} color="#2D8B47" />
            <Text style={styles.addMethodText}>Add UPI</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.methodsList}>
          {paymentMethods.map((method) => (
            <View key={method.id} style={styles.methodCard}>
              {method.type === 'card' ? (
                <>
                  <View style={styles.cardHeader}>
                    <Ionicons name="card" size={32} color="#2D8B47" />
                    {method.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardNumber}>{method.card_number}</Text>
                  <Text style={styles.cardHolder}>{method.card_holder}</Text>
                  <Text style={styles.cardExpiry}>Expires: {method.expiry}</Text>
                </>
              ) : (
                <>
                  <View style={styles.upiHeader}>
                    <Ionicons name="qr-code" size={32} color="#2D8B47" />
                    {method.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.upiId}>{method.upi_id}</Text>
                </>
              )}
              <View style={styles.methodActions}>
                {!method.is_default && (
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionText}>Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMethod(method.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={24} color="#2D8B47" />
          <Text style={styles.infoText}>
            Your payment information is encrypted and secure. We never store your full card details.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalType === 'card' ? 'Add Credit/Debit Card' : 'Add UPI ID'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.placeholderText}>
                Payment gateway integration will be completed with Razorpay API keys.
              </Text>
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
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  content: { flex: 1 },
  addButtonsContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  addMethodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#2D8B47',
  },
  addMethodText: { fontSize: 14, fontWeight: '600', color: '#2D8B47' },
  methodsList: { padding: 16, gap: 16 },
  methodCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  cardNumber: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 8 },
  cardHolder: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  cardExpiry: { fontSize: 12, color: '#9CA3AF' },
  upiHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  upiId: { fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 8 },
  defaultBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  defaultText: { fontSize: 12, fontWeight: '600', color: '#2D8B47' },
  methodActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionButton: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 8 },
  actionText: { fontSize: 13, color: '#2D8B47', fontWeight: '500' },
  deleteButton: { padding: 8 },
  infoBox: { flexDirection: 'row', gap: 12, padding: 16, margin: 16, backgroundColor: '#E8F5E9', borderRadius: 12 },
  infoText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  modalBody: { padding: 20 },
  placeholderText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});