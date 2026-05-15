import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { usePathname, useRouter, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from 'nativewind';

import { useTheme } from '@/theme/theme-context';

type Tab = {
  readonly name: string;
  readonly segment: string;
  readonly href: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly iconActive: React.ComponentProps<typeof Ionicons>['name'];
};

const TABS: readonly Tab[] = [
  { name: 'Shop',     segment: 'shop',     href: '/(tabs)/shop',     icon: 'search-outline',        iconActive: 'search' },
  { name: 'Listings', segment: 'listings', href: '/(tabs)/listings',  icon: 'albums-outline',        iconActive: 'albums' },
  { name: 'Sell',     segment: 'sell',     href: '/(tabs)/sell',      icon: 'pricetag-outline',      iconActive: 'pricetag' },
  { name: 'Orders',   segment: 'orders',   href: '/(tabs)/orders',    icon: 'receipt-outline',       iconActive: 'receipt' },
  { name: 'Inbox',    segment: 'inbox',    href: '/(tabs)/inbox',     icon: 'notifications-outline', iconActive: 'notifications' },
];

const TAB_PATHNAMES = new Set(['/shop', '/listings', '/sell', '/orders', '/inbox']);

export function FloatingTabBar() {
  const theme = useTheme();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useSharedValue(0);

  const activeIndex = TABS.findIndex((tab) => pathname.startsWith(`/${tab.segment}`));

  useEffect(() => {
    if (containerWidth > 0 && activeIndex !== -1) {
      const tabWidth = containerWidth / TABS.length;
      const targetX = activeIndex * tabWidth;

      translateX.value = reducedMotion
        ? targetX
        : withSpring(targetX, { damping: 20, stiffness: 150 });
    }
  }, [activeIndex, containerWidth, reducedMotion, translateX]);

  const animatedPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: containerWidth / TABS.length,
  }));

  if (!TAB_PATHNAMES.has(pathname)) return null;

  const onLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      onLayout={onLayout}
      style={{
        position: 'absolute',
        left: theme.spacing[3],
        right: theme.spacing[3],
        bottom: Math.max(insets.bottom, theme.spacing[3]),
        height: 64,
        borderRadius: theme.radius.pill,
        overflow: 'hidden',
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 40,
        elevation: 12,
      }}>
      {/* Glassmorphic blur layer */}
      <BlurView
        intensity={theme.blurIntensity.mid}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
      />
      {/* Tint overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0, right: 0, bottom: 0, left: 0,
          backgroundColor: theme.colors.glassSurface,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
        }}
      />

      {/* Sliding Background Pill */}
      {containerWidth > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: theme.spacing[2],
              bottom: theme.spacing[2],
              backgroundColor: theme.colors.brandSoft,
              borderRadius: theme.radius.pill,
            },
            animatedPillStyle,
          ]}
        />
      )}

      {/* Tabs */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {TABS.map((tab, index) => {
          const isActive = index === activeIndex;
          return (
            <Pressable
              key={tab.href}
              accessibilityLabel={tab.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => { router.navigate(tab.href as Href); }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}>
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing[2], gap: 2 }}>
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
                    color: isActive ? theme.colors.brand : theme.colors.inkMuted,
                    fontFamily: theme.fontFamily.label,
                  }}>
                  {tab.name}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
