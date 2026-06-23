import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import LoginScreen from './src/screens/LoginScreen';
import POSScreen from './src/screens/POSScreen';
import CartScreen from './src/screens/CartScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import ReceiptScreen from './src/screens/ReceiptScreen';
import WaiterScreen from './src/screens/WaiterScreen';
import OrderScreen from './src/screens/OrderScreen';
import ShiftScreen from './src/screens/ShiftScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BarcodeScannerScreen from './src/screens/BarcodeScannerScreen';

import { getUserData } from './src/services/storage';
import { COLORS } from './src/utils/constants';

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  Cart: undefined;
  Payment: { method: 'Cash' | 'Card'; total: number; cart: any[] };
  Receipt: { transaction: any };
  BarcodeScanner: undefined;
  Order: { table?: any };
};

export type TabParamList = {
  POS: undefined;
  Waiter: undefined;
  Shift: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 0.5,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.5,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'grid';
          if (route.name === 'POS') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Waiter')
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          else if (route.name === 'Shift')
            iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Settings')
            iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="POS" component={POSScreen} options={{ title: 'Sales' }} />
      <Tab.Screen name="Waiter" component={WaiterScreen} options={{ title: 'Tables' }} />
      <Tab.Screen name="Shift" component={ShiftScreen} options={{ title: 'Shift' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await getUserData();
      setIsLoggedIn(!!user);
    } catch {
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: COLORS.primary,
            background: COLORS.background,
            card: COLORS.surface,
            text: COLORS.text,
            border: COLORS.border,
            notification: COLORS.danger,
          },
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
            animation: 'slide_from_right',
          }}
          initialRouteName={isLoggedIn ? 'MainTabs' : 'Login'}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Cart" component={CartScreen} />
          <Stack.Screen
            name="Payment"
            component={PaymentScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="Receipt"
            component={ReceiptScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen
            name="BarcodeScanner"
            component={BarcodeScannerScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Order" component={OrderScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <Toast />
    </>
  );
}
