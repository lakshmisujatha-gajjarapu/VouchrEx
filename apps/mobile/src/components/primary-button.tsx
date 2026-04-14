import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

/**
 * variant='flat'     (default) — solid brand bg + dark text. Used for all in-app CTAs.
 * variant='gradient' — deep-purple gradient + white text. Used on sign-in / onboarding only.
 */
export function PrimaryButton({
  label,
  onPress,
  tone = 'action',
  variant = 'flat',
  disabled = false,
  loading = false,
  icon,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: 'action' | 'brand' | 'secondary' | 'danger';
  readonly variant?: 'flat' | 'gradient';
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();

  const disabledCfg = {
    bg: theme.colors.surfaceTray,
    border: theme.colors.border,
    text: theme.colors.inkMuted,
  };

  // Flat configs per tone — brand/action use theme colors, secondary/danger have their own style
  const flatBrandBg   = tone === 'action' ? theme.colors.action : theme.colors.brand;
  // text on brand/action flat: use surface (dark in dark-mode, white in light-mode) for contrast
  const flatBrandText = theme.colors.surface;

  const flatCfg =
    tone === 'secondary'
      ? { bg: theme.colors.brandSoft, border: theme.colors.brandBright, text: theme.colors.brand }
      : tone === 'danger'
        ? { bg: theme.colors.danger, border: theme.colors.danger, text: theme.colors.white }
        : { bg: flatBrandBg, border: 'transparent', text: flatBrandText }; // brand | action flat

  // Gradient configs (sign-in / gradient variant only)
  // spec: sign_in_dark → from-secondary-container(#7c3aed) to-secondary(#A78BFA), direction br
  const gradientColors: Record<string, readonly [string, string, string, string]> = {
    brand:  ['#7C3AED', '#8B5CF6', '#9D77F5', '#A78BFA'],
    action: [theme.colors.actionBright, theme.colors.actionBright, theme.colors.action, theme.colors.action],
  };

  const useGradient = variant === 'gradient' && !disabled && (tone === 'brand' || tone === 'action');

  const cfg       = disabled ? disabledCfg : flatCfg;
  const textColor = disabled ? disabledCfg.text : cfg.text;

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
        shadowOffset: { width: 0, height: disabled ? 0 : 6 },
        shadowOpacity: disabled ? 0 : tone === 'secondary' ? 0.12 : useGradient ? 0.20 : 0.22,
        shadowRadius: disabled ? 0 : tone === 'secondary' ? 16 : useGradient ? 28 : 14,
        elevation: disabled ? 0 : tone === 'secondary' ? 2 : 4,
        opacity: loading ? 0.7 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed && !disabled && !loading ? 0.982 : 1 }],
        borderRadius: 16,
        overflow: 'hidden',
      })}>
      {useGradient ? (
        <LinearGradient
          colors={gradientColors[tone] ?? ['#7C3AED', '#8B5CF6', '#9D77F5', '#A78BFA']}
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
          {/* Top sheen — glass highlight */}
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
            start={{ x: 0.5, y: 0 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
              borderTopLeftRadius: 16, borderTopRightRadius: 16,
            }}
          />
          {loading
            ? <ActivityIndicator color={theme.colors.white} />
            : (
                <Text style={{ color: theme.colors.white, fontSize: 16, fontWeight: '700', fontFamily: 'WorkSans_600SemiBold', letterSpacing: 0.2 }}>
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
            borderWidth: tone === 'secondary' || disabled ? 1.5 : 0,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: cfg.bg,
            borderColor: 'border' in cfg ? cfg.border : 'transparent',
          }}>
          {loading
            ? <ActivityIndicator color={textColor} />
            : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
                  <Text style={{ color: textColor, fontSize: 16, fontWeight: '700', fontFamily: 'WorkSans_600SemiBold', letterSpacing: 0.2 }}>
                    {label}
                  </Text>
                </View>
              )}
        </View>
      )}
    </Pressable>
  );
}
