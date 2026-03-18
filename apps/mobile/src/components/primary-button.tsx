import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

export function PrimaryButton({
  label,
  onPress,
  tone = 'action',
  disabled = false,
  loading = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: 'action' | 'brand' | 'secondary' | 'danger';
  readonly disabled?: boolean;
  readonly loading?: boolean;
}) {
  const theme = useTheme();

  const enabledCfg =
    tone === 'secondary'
      ? { bg: theme.colors.brandSoft, border: theme.colors.brandBright, text: theme.colors.brand, shadow: theme.colors.shadowStrong }
      : tone === 'danger'
        ? { bg: theme.colors.danger, border: theme.colors.danger, text: theme.colors.white, shadow: theme.colors.danger }
        : tone === 'brand'
          ? { bg: theme.colors.brandBright, border: theme.colors.brandBright, text: theme.colors.white, shadow: theme.colors.brandBright }
          : { bg: theme.colors.actionBright, border: theme.colors.actionBright, text: theme.colors.white, shadow: theme.colors.actionBright };

  const disabledCfg = {
    bg: theme.colors.surfaceTray,
    border: theme.colors.border,
    text: theme.colors.inkMuted,
    shadow: 'transparent',
  };

  const cfg = disabled ? disabledCfg : enabledCfg;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        shadowColor: cfg.shadow,
        shadowOffset: { width: 0, height: disabled ? 0 : 10 },
        shadowOpacity: disabled ? 0 : tone === 'secondary' ? 0.12 : 0.28,
        shadowRadius: disabled ? 0 : tone === 'secondary' ? 16 : 20,
        elevation: disabled ? 0 : tone === 'secondary' ? 2 : 5,
        opacity: loading ? 0.6 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed && !disabled && !loading ? 0.985 : 1 }],
      })}>
      {({ pressed }) => (
        <View
          style={{
            minHeight: 56,
            width: '100%',
            borderRadius: 16,
            borderWidth: 1.5,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              disabled
                ? disabledCfg.bg
                : pressed && tone === 'brand'
                  ? theme.colors.brand
                  : pressed && tone === 'action'
                    ? theme.colors.action
                    : pressed && tone === 'danger'
                      ? '#dc2626'
                      : pressed && tone === 'secondary'
                        ? theme.colors.surfaceRaised
                        : cfg.bg,
            borderColor: cfg.border,
          }}>
          {loading
            ? <ActivityIndicator color={cfg.text} />
            : (
                <Text
                  style={{ color: cfg.text, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 }}>
                  {label}
                </Text>
              )}
        </View>
      )}
    </Pressable>
  );
}
