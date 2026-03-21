import { LinearGradient } from 'expo-linear-gradient';
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

  const disabledCfg = {
    bg: theme.colors.surfaceTray,
    border: theme.colors.border,
    text: theme.colors.inkMuted,
  };

  // Gradient configs for brand/action tones
  const gradientColors: Record<string, readonly [string, string]> = {
    brand: [theme.colors.brandBright, theme.colors.brand],
    action: [theme.colors.actionBright, theme.colors.action],
  };

  const flatCfg =
    tone === 'secondary'
      ? { bg: theme.colors.brandSoft, border: theme.colors.brandBright, text: theme.colors.brand }
      : tone === 'danger'
        ? { bg: theme.colors.danger, border: theme.colors.danger, text: theme.colors.white }
        : null; // brand/action use gradient

  const cfg = disabled ? disabledCfg : flatCfg;
  const useGradient = !disabled && (tone === 'brand' || tone === 'action');

  const textColor = disabled
    ? disabledCfg.text
    : tone === 'secondary'
      ? theme.colors.brand
      : tone === 'danger'
        ? theme.colors.white
        : theme.colors.white;

  const shadowColor = disabled
    ? 'transparent'
    : tone === 'brand'
      ? theme.colors.brand
      : tone === 'action'
        ? theme.colors.action
        : tone === 'danger'
          ? theme.colors.danger
          : theme.colors.shadowStrong;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        shadowColor,
        shadowOffset: { width: 0, height: disabled ? 0 : 10 },
        shadowOpacity: disabled ? 0 : tone === 'secondary' ? 0.12 : 0.28,
        shadowRadius: disabled ? 0 : tone === 'secondary' ? 16 : 20,
        elevation: disabled ? 0 : tone === 'secondary' ? 2 : 5,
        opacity: loading ? 0.6 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed && !disabled && !loading ? 0.985 : 1 }],
        borderRadius: 16,
        overflow: 'hidden',
      })}>
      {useGradient ? (
        <LinearGradient
          colors={gradientColors[tone] ?? [theme.colors.brandBright, theme.colors.brand]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={{
            minHeight: 56,
            width: '100%',
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
          }}>
          {loading
            ? <ActivityIndicator color={theme.colors.white} />
            : (
                <Text style={{ color: theme.colors.white, fontSize: 16, fontWeight: '700', fontFamily: 'WorkSans_600SemiBold', letterSpacing: 0.1 }}>
                  {label}
                </Text>
              )}
        </LinearGradient>
      ) : (
        <View
          style={{
            minHeight: 56,
            width: '100%',
            borderRadius: 16,
            borderWidth: 1.5,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: cfg?.bg ?? theme.colors.surfaceTray,
            borderColor: cfg?.border ?? theme.colors.border,
          }}>
          {loading
            ? <ActivityIndicator color={textColor} />
            : (
                <Text style={{ color: textColor, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 }}>
                  {label}
                </Text>
              )}
        </View>
      )}
    </Pressable>
  );
}
