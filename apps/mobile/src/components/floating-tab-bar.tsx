import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from 'nativewind';

import { useTheme } from '@/theme/ThemeContext';

type Tab = {
  readonly name: string;
  readonly segment: string;
  readonly href: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly iconActive: React.ComponentProps<typeof Ionicons>['name'];
};

const TABS: readonly Tab[] = [
  { name: 'Bazaar',   segment: 'bazaar',   href: '/(tabs)/bazaar',   icon: 'search-outline',        iconActive: 'search' },
  { name: 'Listings', segment: 'listings', href: '/(tabs)/listings',  icon: 'albums-outline',        iconActive: 'albums' },
  { name: 'Sell',     segment: 'sell',     href: '/(tabs)/sell',      icon: 'pricetag-outline',      iconActive: 'pricetag' },
  { name: 'Orders',   segment: 'orders',   href: '/(tabs)/orders',    icon: 'receipt-outline',       iconActive: 'receipt' },
  { name: 'Inbox',    segment: 'inbox',    href: '/(tabs)/inbox',     icon: 'notifications-outline', iconActive: 'notifications' },
];

// These are the native tab screens — they already have a tab bar from the Tabs navigator.
const TAB_PATHNAMES = new Set(['/bazaar', '/listings', '/sell', '/orders', '/inbox']);

export function FloatingTabBar() {
  const theme = useTheme();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (TAB_PATHNAMES.has(pathname)) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: Math.max(insets.bottom, 14),
        height: 64,
        borderRadius: 9999,
        overflow: 'hidden',
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 40,
        elevation: 12,
      }}>
      {/* Glassmorphic blur layer */}
      <BlurView
        intensity={60}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
      />
      {/* Tint overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0, right: 0, bottom: 0, left: 0,
          backgroundColor: colorScheme === 'dark'
            ? 'rgba(13,11,30,0.65)'
            : 'rgba(255,255,255,0.72)',
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: colorScheme === 'dark'
            ? theme.colors.surfaceHighest
            : 'rgba(204,195,214,0.40)',
        }}
      />
      {/* Tabs */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(`/${tab.segment}`);
          return (
            <Pressable
              key={tab.href}
              accessibilityLabel={tab.name}
              accessibilityRole="button"
              onPress={() => { router.navigate(tab.href as Parameters<typeof router.navigate>[0]); }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 4,
                opacity: pressed ? 0.6 : 1,
              })}>
              <Ionicons
                color={isActive ? theme.colors.brand : theme.colors.inkMuted}
                name={isActive ? tab.iconActive : tab.icon}
                size={22}
              />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  letterSpacing: 0,
                  marginTop: 2,
                  color: isActive ? theme.colors.brand : theme.colors.inkMuted,
                  fontFamily: theme.fontFamily.label,
                }}>
                {tab.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
