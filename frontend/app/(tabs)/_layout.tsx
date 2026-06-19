import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/cartStore';
import { useTranslation } from '../../context/LanguageContext';
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TabsLayout() {
  const { items, fetchCart } = useCartStore();
  const { t } = useTranslation();

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const cartCount = (items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2D8B47',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          paddingBottom: 4,
          paddingTop: 4,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: -2,
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: t('tabCategories'),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: t('tabTV'),
          tabBarIcon: ({ color, size }) => <Ionicons name="tv" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabCart'),
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="cart" size={size} color={color} />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -6,
    top: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
