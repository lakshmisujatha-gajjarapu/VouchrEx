import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

export function FilterChip({
  label,
  selected,
  onPress,
}: {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-pill border px-3 py-2"
      style={({ pressed }) => ({
        backgroundColor: selected ? theme.colors.brandSoft : theme.colors.surfaceHigh,
        borderColor: selected ? theme.colors.brandBright : theme.colors.border,
        opacity: pressed ? 0.8 : 1,
      })}>
      <View
        className="h-[7px] w-[7px] rounded-full"
        style={{ backgroundColor: selected ? theme.colors.brand : theme.colors.borderStrong }}
      />
      <Text
        className="font-label text-caption font-extrabold uppercase tracking-[0.3px]"
        style={{ color: selected ? theme.colors.brand : theme.colors.inkMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}
