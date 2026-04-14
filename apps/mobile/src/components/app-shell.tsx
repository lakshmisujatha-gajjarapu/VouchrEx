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

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeContext';

export function AppShell({
  eyebrow,
  title,
  subtitle,
  children,
  scroll = true,
  contentContainerStyle,
  footer,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
  readonly scroll?: boolean;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const initial = (user?.name ?? user?.phone ?? '?')[0].toUpperCase();

  const content = (
    <View style={[{ paddingHorizontal: theme.spacing[5], paddingBottom: footer ? theme.spacing[2] : 100, gap: theme.spacing[3], paddingTop: theme.spacing[1] }, contentContainerStyle]}>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Top bar ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing[5],
          paddingTop: theme.spacing[4],
          paddingBottom: 10,
        }}>
          <View style={{ flex: 1, gap: 2, paddingRight: 12 }}>
            {eyebrow ? (
              <Text style={{
                fontFamily: theme.fontFamily.labelSemi,
                fontSize: 11,
                color: theme.colors.brand,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}>
                {eyebrow}
              </Text>
            ) : null}
            <Text style={{
              fontFamily: theme.fontFamily.headlineExtra,
              fontSize: 26,
              fontWeight: '800',
              letterSpacing: -0.4,
              color: theme.colors.ink,
              lineHeight: 30,
            }}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{
                fontFamily: theme.fontFamily.body,
                fontSize: 13,
                color: theme.colors.inkMuted,
                lineHeight: 18,
              }}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Profile avatar */}
          <Pressable
            accessibilityLabel="Profile"
            accessibilityRole="button"
            onPress={() => { router.push('/profile'); }}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: `${theme.colors.brand}40`,
              opacity: pressed ? 0.7 : 1,
              marginTop: eyebrow ? 14 : 0,
            })}>
            <Text style={{
              fontFamily: theme.fontFamily.headlineExtra,
              fontSize: 16,
              fontWeight: '800',
              color: theme.colors.brand,
            }}>
              {initial}
            </Text>
          </Pressable>
        </View>

        {scroll
          ? <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
          : content}
      </SafeAreaView>

      {footer ? (
        <SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={{
            backgroundColor: theme.colors.surface,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}>
          <View style={{ paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[3] }}>
            {footer}
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}
