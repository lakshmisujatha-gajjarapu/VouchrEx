import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

type StatusBannerProps = {
  readonly tone: 'warning' | 'danger';
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly message: string;
};

export function StatusBanner({ tone, icon, message }: StatusBannerProps) {
  const theme = useTheme();

  const color = tone === 'warning' ? theme.colors.warning : theme.colors.danger;
  const backgroundColor = tone === 'warning' ? theme.colors.warningSoft : theme.colors.dangerSoft;

  return (
    <View style={{
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      backgroundColor,
      borderRadius: theme.radius.sm,
      padding: 14,
    }}>
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 1 }} />
      <Text style={{
        flex: 1,
        fontSize: 13,
        fontFamily: theme.fontFamily.body,
        color,
        lineHeight: 19,
      }}>
        {message}
      </Text>
    </View>
  );
}
