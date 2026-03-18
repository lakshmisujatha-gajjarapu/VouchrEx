import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeContext';

export default function TabsLayout() {
  const { status } = useAuth();
  const theme = useTheme();
  const tabBarStyle = {
    position: 'absolute' as const,
    left: 14,
    right: 14,
    bottom: 14,
    height: 62,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 0,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  };
  const tabBarLabelStyle = {
    fontWeight: '700' as const,
    fontSize: 11,
    letterSpacing: 0.1,
    fontFamily: theme.fontFamily.ui,
  };
  const tabBarItemStyle = { paddingVertical: 4 };

  if (status === 'loading') {
    return <LoadingScreen label="Loading your market..." />;
  }

  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      initialRouteName="bazaar"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle,
        tabBarLabelStyle,
        tabBarItemStyle,
      }}>
      <Tabs.Screen
        name="bazaar"
        options={{
          title: 'Bazaar',
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
