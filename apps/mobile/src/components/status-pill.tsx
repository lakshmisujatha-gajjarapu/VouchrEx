import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  readonly label: string;
  readonly tone?: 'neutral' | 'brand' | 'trust' | 'success' | 'danger' | 'warning' | 'glass';
}) {
  const theme = useTheme();

  const palette =
    tone === 'glass'
      ? {
          backgroundColor: theme.colors.glassSurface,
          borderColor: theme.colors.glassBorder,
          color: theme.colors.glassText,
        }
      : tone === 'brand' || tone === 'trust'
        ? {
            backgroundColor: theme.colors.brandSoft,
            borderColor: theme.colors.pillBrandBorder,
            color: theme.colors.brand,
          }
        : tone === 'success'
          ? {
              backgroundColor: theme.colors.successSoft,
              borderColor: theme.colors.pillSuccessBorder,
              color: theme.colors.success,
            }
          : tone === 'danger'
            ? {
                backgroundColor: theme.colors.dangerSoft,
                borderColor: theme.colors.pillDangerBorder,
                color: theme.colors.danger,
              }
            : tone === 'warning'
              ? {
                  backgroundColor: theme.colors.warningSoft,
                  borderColor: theme.colors.pillWarnBorder,
                  color: theme.colors.warning,
                }
              : {
                  backgroundColor: theme.colors.surfaceHigh,
                  borderColor: theme.colors.border,
                  color: theme.colors.inkMuted,
                };

  return (
    <View
      className="self-start rounded-pill border px-3 py-[5px]"
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
      }}>
      <Text
        className="font-label text-caption font-bold tracking-[0.2px]"
        style={{ color: palette.color }}>
        {label}
      </Text>
    </View>
  );
}
