import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support';
  timestamp: Date;
}

export default function SupportChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! Welcome to GrocerEase support. How can I help you today?',
      sender: 'support',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [typing, setTyping] = useState(false);

  const quickReplies = [
    'Track my order',
    'Refund status',
    'Change delivery address',
    'Product quality issue',
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    setTyping(true);

    setTimeout(() => {
      const supportResponse = generateSupportResponse(messageText);
      const supportMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: supportResponse,
        sender: 'support',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, supportMessage]);
      setTyping(false);
    }, 1500);
  };

  const generateSupportResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();
    
    if (msg.includes('track') || msg.includes('order')) {
      return 'I can help you track your order! Please share your Order ID.';
    } else if (msg.includes('refund') || msg.includes('cancel')) {
      return 'Refunds are processed within 5-7 business days. Please share your Order ID.';
    } else if (msg.includes('address') || msg.includes('delivery')) {
      return 'To change your delivery address, please go to your order details.';
    } else if (msg.includes('quality') || msg.includes('damaged')) {
      return 'I am sorry about the quality issue. Please share your Order ID and photos.';
    } else {
      return 'Thank you! A support agent will get back to you shortly.';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Support Chat</Text>
          <View style={styles.onlineIndicator}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Call Support', 'Call: 1800-XXX-XXXX')}>
          <Ionicons name="call-outline" size={24} color="#2D8B47" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.messagesContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.sender === 'user' ? styles.userBubble : styles.supportBubble,
              ]}
            >
              {message.sender === 'support' && (
                <View style={styles.supportAvatar}>
                  <Ionicons name="headset" size={16} color="#fff" />
                </View>
              )}
              <View
                style={[
                  styles.messageContent,
                  message.sender === 'user' ? styles.userContent : styles.supportContent,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.sender === 'user' ? styles.userText : styles.supportText,
                  ]}
                >
                  {message.text}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    message.sender === 'user' ? styles.userTime : styles.supportTime,
                  ]}
                >
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}

          {typing && (
            <View style={[styles.messageBubble, styles.supportBubble]}>
              <View style={styles.supportAvatar}>
                <Ionicons name="headset" size={16} color="#fff" />
              </View>
              <View style={[styles.messageContent, styles.supportContent]}>
                <Text style={styles.typingText}>typing...</Text>
              </View>
            </View>
          )}

          {messages.length === 1 && (
            <View style={styles.quickRepliesContainer}>
              <Text style={styles.quickRepliesTitle}>Quick replies:</Text>
              <View style={styles.quickRepliesButtons}>
                {quickReplies.map((reply, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickReplyButton}
                    onPress={() => sendMessage(reply)}
                  >
                    <Text style={styles.quickReplyText}>{reply}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="attach" size={24} color="#6B7280" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <View style={styles.helpBanner}>
        <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
        <Text style={styles.helpText}>Average response time: 2-3 minutes</Text>
      </View>
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
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  onlineIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  onlineText: { fontSize: 12, color: '#10B981' },
  messagesContainer: { flex: 1 },
  messagesList: { flex: 1 },
  messagesContent: { padding: 16 },
  messageBubble: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  userBubble: { justifyContent: 'flex-end', marginLeft: 48 },
  supportBubble: { marginRight: 48 },
  supportAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2D8B47',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageContent: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  userContent: { backgroundColor: '#2D8B47', borderBottomRightRadius: 4 },
  supportContent: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  messageText: { fontSize: 15, lineHeight: 20, marginBottom: 4 },
  userText: { color: '#fff' },
  supportText: { color: '#111' },
  messageTime: { fontSize: 11 },
  userTime: { color: 'rgba(255,255,255,0.8)', textAlign: 'right' },
  supportTime: { color: '#9CA3AF' },
  typingText: { fontSize: 14, color: '#6B7280', fontStyle: 'italic' },
  quickRepliesContainer: { marginTop: 16 },
  quickRepliesTitle: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  quickRepliesButtons: { gap: 8 },
  quickReplyButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  quickReplyText: { fontSize: 14, color: '#2D8B47', fontWeight: '500' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  attachButton: { padding: 8 },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#2D8B47',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#D1D5DB' },
  helpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  helpText: { fontSize: 12, color: '#6B7280' },
});
