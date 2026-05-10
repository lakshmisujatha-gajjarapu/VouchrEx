import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

type TrustTier = 'gold' | 'silver' | 'bronze';

export function TrustBadge({ tier }: { readonly tier: TrustTier }) {
  const theme = useTheme();
  const bg =
    tier === 'gold' ? theme.colors.gold :
    tier === 'silver' ? theme.colors.silver :
    theme.colors.bronze;

  return (
    <View
      className="self-start rounded-pill px-2 py-[3px]"
      style={{ backgroundColor: bg }}>
      <Text
        className="font-label text-[10px] font-extrabold uppercase tracking-[0.4px]"
        style={{ color: theme.colors.white }}>
        {tier}
      </Text>
    </View>
  );
}
