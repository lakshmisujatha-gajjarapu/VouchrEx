import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

export function LoadingScreen({ label }: { readonly label: string }) {
  const theme = useTheme();

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background dark:bg-background-dark">
      <ActivityIndicator color={theme.colors.brand} size="large" />
      <Text
        className="font-body text-body font-semibold"
        style={{ color: theme.colors.inkMuted }}>
        {label}
      </Text>
    </View>
  );
}
