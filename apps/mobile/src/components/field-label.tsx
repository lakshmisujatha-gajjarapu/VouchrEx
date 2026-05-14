import React from 'react';
import { Text } from 'react-native';

import { useTheme } from '@/theme/theme-context';

export function FieldLabel({ children }: { readonly children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{
      fontSize: 13,
      fontWeight: '600',
      fontFamily: theme.fontFamily.labelSemi,
      color: theme.colors.inkSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    }}>
      {children}
    </Text>
  );
}
