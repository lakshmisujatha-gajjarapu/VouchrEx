import { Ionicons } from '@expo/vector-icons';
import { type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeContext';

function TabBarButton({ children, onPress, onLongPress, accessibilityState }: BottomTabBarButtonProps) {
  const theme = useTheme();
  const focused = accessibilityState?.selected ?? false;
  return (
    <Pressable
      onLongPress={onLongPress}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={focused ? {
        backgroundColor: `${theme.colors.brand}28`,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 5,
        shadowColor: theme.colors.brand,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
      } : {
        paddingHorizontal: 14,
        paddingVertical: 5,
      }}>
        {children}
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { status } = useAuth();
  const theme = useTheme();
  const tabBarStyle = {
    position: 'absolute' as const,
    left: 14,
    right: 14,
    bottom: 14,
    height: 62,
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: 0,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  };
  const tabBarLabelStyle = {
    fontWeight: '700' as const,
    fontSize: 10,
    letterSpacing: 0.4,
    fontFamily: theme.fontFamily.labelSemi,
  };

  if (status === 'loading') {
    return <LoadingScreen label="Loading your market..." />;
  }

  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      initialRouteName="shop"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle,
        tabBarLabelStyle,
        tabBarButton: TabBarButton,
      }}>
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="search-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="albums-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Sell',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="pricetag-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="receipt-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="notifications-outline" size={size} />,
        }}
      />
    </Tabs>
  );
}
