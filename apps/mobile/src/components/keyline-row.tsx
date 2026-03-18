import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

export function KeylineRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  const theme = useTheme();

  return (
    <View
      className="flex-row items-center justify-between gap-3 border-t py-2"
      style={{ borderTopColor: theme.colors.border }}>
      <Text
        className="flex-1 font-ui text-caption font-extrabold uppercase tracking-[0.5px]"
        style={{ color: theme.colors.inkMuted }}>
        {label}
      </Text>
      <Text
        className="shrink font-ui text-body font-extrabold text-right"
        style={{ color: theme.colors.ink }}>
        {value}
      </Text>
    </View>
  );
}
