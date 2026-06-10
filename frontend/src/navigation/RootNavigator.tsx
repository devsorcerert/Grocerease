import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import LoginScreen    from '../screens/LoginScreen';
import HomeScreen     from '../screens/HomeScreen';
import ProductsScreen from '../screens/ProductsScreen';
import CartScreen     from '../screens/CartScreen';
import OrdersScreen   from '../screens/OrdersScreen';
import ProfileScreen  from '../screens/ProfileScreen';

export type AuthStackParams = { Login: undefined };
export type AppStackParams  = {
  Home: undefined;
  Products: { categoryId?: string };
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const AppStack  = createNativeStackNavigator<AppStackParams>();

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

const AppNavigator = () => (
  <AppStack.Navigator screenOptions={{ headerShown: false }}>
    <AppStack.Screen name="Home"     component={HomeScreen} />
    <AppStack.Screen name="Products" component={ProductsScreen} />
    <AppStack.Screen name="Cart"     component={CartScreen} />
    <AppStack.Screen name="Orders"   component={OrdersScreen} />
    <AppStack.Screen name="Profile"  component={ProfileScreen} />
  </AppStack.Navigator>
);

const RootNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});
