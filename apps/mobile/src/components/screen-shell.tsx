import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';

export function ScreenShell({
  eyebrow,
  title,
  subtitle,
  children,
  scroll = true,
  contentContainerStyle,
  footer,
  showClose = false,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
  readonly scroll?: boolean;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly footer?: React.ReactNode;
  readonly showClose?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();

  const content = (
    <View className="gap-3 px-5 pt-2" style={[{ paddingBottom: footer ? 8 : 100 }, contentContainerStyle]}>
      <View className="gap-1">
        {showClose ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 4 }}>
              {eyebrow ? (
                <Text
                  className="font-label text-caption font-extrabold uppercase tracking-[0.6px]"
                  style={{ color: theme.colors.brand }}>
                  {eyebrow}
                </Text>
              ) : null}
              <Text
                className="font-headline text-[26px] font-bold leading-[30px]"
                style={{ color: theme.colors.ink }}>
                {title}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={() => { router.back(); }}
              style={({ pressed }) => ({
                marginLeft: 12,
                marginTop: 2,
                opacity: pressed ? 0.5 : 1,
              })}>
              <Ionicons name="close" size={26} color={theme.colors.inkMuted} />
            </Pressable>
          </View>
        ) : (
          <>
            {eyebrow ? (
              <Text
                className="font-label text-caption font-extrabold uppercase tracking-[0.6px]"
                style={{ color: theme.colors.brand }}>
                {eyebrow}
              </Text>
            ) : null}
            <Text
              className="font-headline text-[26px] font-bold leading-[30px]"
              style={{ color: theme.colors.ink }}>
              {title}
            </Text>
          </>
        )}
        {subtitle ? (
          <Text
            className="text-[13px] leading-[18px]"
            style={{ color: theme.colors.inkMuted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {scroll
          ? <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
          : content}
      </SafeAreaView>
      {footer ? (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
          <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            {footer}
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}
