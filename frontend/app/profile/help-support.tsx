import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function HelpSupportScreen() {
  const router = useRouter();

  const helpItems = [
    {
      icon: 'help-circle-outline',
      title: 'Frequently Asked Questions',
      description: 'Find answers to common questions',
      action: () => Alert.alert('FAQs', 'FAQ section coming soon!')
    },
    {
      icon: 'chatbubble-outline',
      title: 'Live Chat Support',
      description: 'Chat with our customer service team',
      action: () => router.push('/support-chat')
    },
    {
      icon: 'call-outline',
      title: 'Call Support',
      description: 'Speak directly with our support team',
      action: () => {
        Alert.alert(
          'Call Support',
          'Would you like to call our support team at +91 98765 43210?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Call Now',
              onPress: () => Linking.openURL('tel:+919876543210')
            }
          ]
        );
      }
    },
    {
      icon: 'mail-outline',
      title: 'Email Support',
      description: 'Send us an email with your queries',
      action: () => {
        Linking.openURL('mailto:support@grocereasetv.com?subject=Support Request&body=Please describe your issue:');
      }
    },
    {
      icon: 'document-text-outline',
      title: 'User Manual',
      description: 'Complete guide to using GrocerEase',
      action: () => Alert.alert('User Manual', 'User manual coming soon!')
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy Policy',
      description: 'Learn how we protect your data',
      action: () => Alert.alert('Privacy Policy', 'Privacy policy coming soon!')
    },
    {
      icon: 'document-outline',
      title: 'Terms of Service',
      description: 'Read our terms and conditions',
      action: () => Alert.alert('Terms of Service', 'Terms of service coming soon!')
    },
    {
      icon: 'star-outline',
      title: 'Rate Our App',
      description: 'Help us improve by rating the app',
      action: () => Alert.alert('Rate App', 'Thank you for considering to rate our app!')
    }
  ];

  const contactInfo = [
    {
      label: 'Email',
      value: 'support@grocereasetv.com',
      icon: 'mail',
      action: () => Linking.openURL('mailto:support@grocereasetv.com')
    },
    {
      label: 'Phone',
      value: '+91 98765 43210',
      icon: 'call',
      action: () => Linking.openURL('tel:+919876543210')
    },
    {
      label: 'Website',
      value: 'www.grocereasetv.com',
      icon: 'globe',
      action: () => Linking.openURL('https://www.grocereasetv.com')
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Welcome Message */}
        <View style={styles.welcomeCard}>
          <Ionicons name="heart" size={32} color="#2D8B47" />
          <Text style={styles.welcomeTitle}>We're here to help!</Text>
          <Text style={styles.welcomeText}>
            Our support team is available 24/7 to assist you with any questions or issues you might have.
          </Text>
        </View>

        {/* Help Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How can we help you?</Text>
          
          {helpItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.helpItem} onPress={item.action}>
              <View style={styles.helpItemIcon}>
                <Ionicons name={item.icon as any} size={24} color="#2D8B47" />
              </View>
              <View style={styles.helpItemContent}>
                <Text style={styles.helpItemTitle}>{item.title}</Text>
                <Text style={styles.helpItemDesc}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <View style={styles.contactCard}>
            {contactInfo.map((contact, index) => (
              <TouchableOpacity key={index} style={styles.contactItem} onPress={contact.action}>
                <View style={styles.contactIcon}>
                  <Ionicons name={contact.icon as any} size={20} color="#2D8B47" />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactLabel}>{contact.label}</Text>
                  <Text style={styles.contactValue}>{contact.value}</Text>
                </View>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Build</Text>
              <Text style={styles.infoValue}>2025.01.001</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>React Native</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>GrocerEase - Your Smart Grocery Partner</Text>
          <Text style={styles.footerSubtext}>© 2025 GrocerEase TV. All rights reserved.</Text>
        </View>
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
  
  // Welcome card
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 12,
    marginBottom: 8
  },
  welcomeText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20
  },
  
  // Sections
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16
  },
  
  // Help items
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8
  },
  helpItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  helpItemContent: { flex: 1 },
  helpItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2
  },
  helpItemDesc: {
    fontSize: 12,
    color: '#6B7280'
  },
  
  // Contact
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  contactContent: { flex: 1 },
  contactLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111'
  },
  
  // Info
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280'
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111'
  },
  
  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 24
  },
  footerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D8B47',
    marginBottom: 4
  },
  footerSubtext: {
    fontSize: 12,
    color: '#9CA3AF'
  }
});