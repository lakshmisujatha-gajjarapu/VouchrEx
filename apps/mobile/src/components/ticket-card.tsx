import React from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

export function TicketCard({
  eyebrow,
  title,
  subtitle,
  meta,
  tone = 'neutral',
  onPress,
  children,
  style,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly meta?: string;
  readonly tone?: 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'premium' | 'sand' | 'mint' | 'ink';
  readonly onPress?: () => void;
  readonly children?: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  const resolvedTone =
    tone === 'sand' ? 'neutral' :
    tone === 'mint' ? 'success' :
    tone === 'ink' ? 'brand' :
    tone;

  // Card background — semantic tones get a tinted bg; neutral/brand use white/surface
  const toneStyle =
    resolvedTone === 'danger'
      ? { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.pillDangerBorder }
      : resolvedTone === 'warning'
        ? { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.pillWarnBorder }
        : resolvedTone === 'success'
          ? { backgroundColor: theme.colors.successSoft, borderColor: theme.colors.pillSuccessBorder }
          : undefined;

  // Accent stripe colour — Stitch uses actionFixed (emerald) for brand/neutral, semantic for others
  const accentColor =
    resolvedTone === 'danger'  ? theme.colors.danger :
    resolvedTone === 'warning' ? theme.colors.warning :
    resolvedTone === 'success' ? theme.colors.success :
    resolvedTone === 'premium' ? theme.colors.gold :
    theme.colors.brand;

  // Eyebrow / meta label colour
  const eyebrowColor =
    resolvedTone === 'danger'  ? theme.colors.danger :
    resolvedTone === 'warning' ? theme.colors.warning :
    theme.colors.brand;

  const content = (
    <View className="flex-row">
      <View className="w-[6px] self-stretch" style={{ backgroundColor: accentColor }} />
      <View className="flex-1 gap-1 px-4 py-3">
        <View className="flex-row items-start justify-between gap-2">
          {eyebrow ? (
            <Text
              className="font-label text-caption font-extrabold tracking-[0.4px]"
              style={{ color: eyebrowColor }}>
              {eyebrow}
            </Text>
          ) : (
            <View />
          )}
          {meta ? (
            <Text
              className="shrink pt-px font-label text-caption font-bold tracking-[0.2px] text-right"
              style={{ color: theme.colors.inkMuted }}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Text
          className="font-headline text-heading font-bold leading-[22px]"
          style={{ color: theme.colors.ink }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-[14px] leading-5"
            style={{ color: theme.colors.inkMuted }}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );

  const baseStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: resolvedTone === 'premium' ? theme.colors.gold : theme.colors.transparent,
    shadowColor: theme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 1,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="overflow-hidden rounded-app-lg"
        style={({ pressed }) => [
          baseStyle,
          toneStyle,
          style,
          { opacity: pressed ? 0.92 : 1 },
        ]}>
        {content}
      </Pressable>
    );
  }

  return (
    <View
      className="overflow-hidden rounded-app-lg"
      style={[baseStyle, toneStyle, style]}>
      {content}
    </View>
  );
}
