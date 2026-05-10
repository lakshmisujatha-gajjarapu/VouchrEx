import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-context';

export function SectionPanel({
  eyebrow,
  title,
  description,
  children,
  style,
}: {
  readonly eyebrow?: string;
  readonly title?: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <View
      className="overflow-hidden rounded-app-xl border"
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadowStrong,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
          elevation: 1,
        },
        style,
      ]}>
      {(eyebrow ?? title ?? description) ? (
        <View
          className="gap-1 border-b px-4 pb-2 pt-3"
          style={{ borderBottomColor: theme.colors.border }}>
          {eyebrow ? (
            <Text className="font-label text-caption font-extrabold uppercase tracking-[0.5px]" style={{ color: theme.colors.brand }}>
              {eyebrow}
            </Text>
          ) : null}
          {title ? (
            <Text
              className="font-label text-[16px] font-bold"
              style={{ color: theme.colors.ink }}>
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text
              className="text-[14px] leading-[19px]"
              style={{ color: theme.colors.inkMuted }}>
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View className="gap-2 p-4">{children}</View>
    </View>
  );
}
