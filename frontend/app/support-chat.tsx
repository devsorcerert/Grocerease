import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support';
  timestamp: Date;
}

const QUICK_REPLIES = [
  'Where is my order?',
  'I want to cancel my order',
  'I have a payment issue',
  'Product quality issue',
  'Refund status',
  'Other issue',
];

const AUTO_RESPONSES: Record<string, string> = {
  'Where is my order?': 'You can track your order from the Orders section. Go to Orders > Tap on your order > Track Order. If you have any specific concerns, please share your order ID.',
  'I want to cancel my order': 'You can cancel your order from the Order Tracking page if it has not been picked up yet. Go to Orders > Track Order > Cancel Order. For orders already in transit, please contact us.',
  'I have a payment issue': 'We are sorry for the inconvenience. Please share your order ID and the issue you are facing. Common issues include double charges, failed payments, or pending refunds.',
  'Product quality issue': 'We take quality seriously. Please share the order ID and a description of the issue. We will arrange a replacement or refund within 24 hours.',
  'Refund status': 'Refunds are typically processed within 5-7 business days. If your refund is pending beyond this period, please share your order ID for us to investigate.',
  'Other issue': 'Please describe your issue and we will do our best to help. Our support team typically responds within 2 hours during business hours (9 AM - 9 PM).',
};

export default function SupportChatPage() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      text: 'Hello! Welcome to GrocerEase support. How can we help you today? You can tap a quick reply below or type your message.',
      sender: 'support',
      timestamp: new Date(),
    }
  ]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setSending(true);

    // Try to send to backend, fallback to auto-response
    try {
      const response = await api.post('/support/messages', { message: text.trim() });
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data.reply || getAutoResponse(text),
        sender: 'support',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, reply]);
    } catch {
      // Fallback to auto-response
      setTimeout(() => {
        const reply: Message = {
          id: (Date.now() + 1).toString(),
          text: getAutoResponse(text),
          sender: 'support',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, reply]);
      }, 800);
    }
    
    setSending(false);
  };

  const getAutoResponse = (userText: string) => {
    // Check if it matches a quick reply
    const matched = Object.keys(AUTO_RESPONSES).find(
      key => userText.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(userText.toLowerCase())
    );
    
    if (matched) return AUTO_RESPONSES[matched];
    
    // Keyword matching
    const lowerText = userText.toLowerCase();
    if (lowerText.includes('order') && (lowerText.includes('track') || lowerText.includes('where'))) {
      return AUTO_RESPONSES['Where is my order?'];
    }
    if (lowerText.includes('cancel')) {
      return AUTO_RESPONSES['I want to cancel my order'];
    }
    if (lowerText.includes('payment') || lowerText.includes('pay') || lowerText.includes('charge')) {
      return AUTO_RESPONSES['I have a payment issue'];
    }
    if (lowerText.includes('refund') || lowerText.includes('money back')) {
      return AUTO_RESPONSES['Refund status'];
    }
    if (lowerText.includes('quality') || lowerText.includes('damaged') || lowerText.includes('bad')) {
      return AUTO_RESPONSES['Product quality issue'];
    }
    
    return 'Thank you for reaching out. Our support team will review your message and respond shortly. In the meantime, you can check our Help & Support section for common solutions. Our support hours are 9 AM - 9 PM IST.';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.supportAvatar}>
            <Ionicons name="headset" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Support Chat</Text>
            <View style={styles.onlineStatus}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile/help-support')}>
          <Ionicons name="help-circle-outline" size={24} color="#111" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView 
          ref={scrollRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.sender === 'user' ? styles.userBubble : styles.supportBubble,
              ]}
            >
              {msg.sender === 'support' && (
                <View style={styles.supportIcon}>
                  <Ionicons name="headset" size={14} color="#2D8B47" />
                </View>
              )}
              <View style={[
                styles.bubbleContent,
                msg.sender === 'user' ? styles.userBubbleContent : styles.supportBubbleContent,
              ]}>
                <Text style={[
                  styles.messageText,
                  msg.sender === 'user' ? styles.userMessageText : styles.supportMessageText,
                ]}>
                  {msg.text}
                </Text>
                <Text style={[
                  styles.messageTime,
                  msg.sender === 'user' ? styles.userMessageTime : styles.supportMessageTime,
                ]}>
                  {formatTime(msg.timestamp)}
                </Text>
              </View>
            </View>
          ))}
          
          {sending && (
            <View style={[styles.messageBubble, styles.supportBubble]}>
              <View style={styles.supportIcon}>
                <Ionicons name="headset" size={14} color="#2D8B47" />
              </View>
              <View style={[styles.bubbleContent, styles.supportBubbleContent]}>
                <Text style={styles.typingText}>Typing...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Replies */}
        {messages.length <= 2 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.quickReplies}
            contentContainerStyle={styles.quickRepliesContent}
          >
            {QUICK_REPLIES.map((reply, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickReplyButton}
                onPress={() => sendMessage(reply)}
              >
                <Text style={styles.quickReplyText}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            onPress={() => sendMessage(message)}
            disabled={!message.trim() || sending}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  supportAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2D8B47',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  onlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  onlineText: { fontSize: 11, color: '#22C55E' },
  
  messagesList: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
  },
  userBubble: { alignSelf: 'flex-end' },
  supportBubble: { alignSelf: 'flex-start' },
  supportIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  bubbleContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: '100%',
    flexShrink: 1,
  },
  userBubbleContent: {
    backgroundColor: '#2D8B47',
    borderBottomRightRadius: 4,
  },
  supportBubbleContent: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: { fontSize: 14, lineHeight: 20 },
  userMessageText: { color: '#fff' },
  supportMessageText: { color: '#111' },
  messageTime: { fontSize: 10, marginTop: 4 },
  userMessageTime: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  supportMessageTime: { color: '#9CA3AF' },
  typingText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  
  quickReplies: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    maxHeight: 56,
  },
  quickRepliesContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  quickReplyButton: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D8B47',
  },
  quickReplyText: { fontSize: 13, color: '#2D8B47', fontWeight: '500' },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
    maxHeight: 100,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2D8B47',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#9CA3AF' },
});
