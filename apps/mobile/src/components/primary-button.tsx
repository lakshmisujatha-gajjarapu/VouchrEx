import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { InteractivePressable } from '@/components/interactive-pressable';
import { useTheme } from '@/theme/theme-context';

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
        : { bg: flatBrandBg, border: theme.colors.transparent, text: flatBrandText }; // brand | action flat

  // Gradient configs (sign-in / gradient variant only)
  const gradientColors: Record<string, readonly [string, string, ...string[]]> = {
    brand:  theme.gradients.brand,
    action: [theme.colors.actionBright, theme.colors.actionBright, theme.colors.action, theme.colors.action],
  };

  const useGradient = variant === 'gradient' && !disabled && (tone === 'brand' || tone === 'action');

  const cfg       = disabled ? disabledCfg : flatCfg;
  const textColor = disabled ? disabledCfg.text : cfg.text;

  const shadowColor = disabled
    ? theme.colors.transparent
    : tone === 'brand'
      ? theme.colors.brand
      : tone === 'action'
        ? theme.colors.action
        : tone === 'danger'
          ? theme.colors.danger
          : theme.colors.shadowStrong;

  const borderRadius = theme.radius.md;

  return (
    <InteractivePressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={{
        width: '100%',
        shadowColor,
        shadowOffset: { width: 0, height: disabled ? 0 : 6 },
        shadowOpacity: disabled ? 0 : tone === 'secondary' ? 0.12 : useGradient ? 0.20 : 0.22,
        shadowRadius: disabled ? 0 : tone === 'secondary' ? theme.spacing[4] : useGradient ? theme.spacing[7] : theme.spacing[3],
        elevation: disabled ? 0 : tone === 'secondary' ? 2 : 4,
        borderRadius,
        overflow: 'hidden',
      }}>
      {useGradient ? (
        <LinearGradient
          colors={gradientColors[tone] ?? theme.gradients.brand}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={{
            minHeight: 56,
            width: '100%',
            borderRadius,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing[4],
          }}>
          {/* Top sheen — glass highlight */}
          <LinearGradient
            colors={[theme.colors.glassBorder, theme.colors.transparent]}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
            start={{ x: 0.5, y: 0 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
              borderTopLeftRadius: borderRadius, borderTopRightRadius: borderRadius,
            }}
          />
          {loading
            ? <ActivityIndicator color={theme.colors.white} />
            : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                  {icon ? <Ionicons name={icon} size={20} color={theme.colors.white} /> : null}
                  <Text style={{ color: theme.colors.white, fontSize: 16, fontWeight: '700', fontFamily: theme.fontFamily.labelSemi, letterSpacing: 0.2 }}>
                    {label}
                  </Text>
                </View>
              )}
        </LinearGradient>
      ) : (
        <View
          style={{
            minHeight: 56,
            width: '100%',
            borderRadius,
            borderWidth: tone === 'secondary' || disabled ? 1.5 : 0,
            paddingHorizontal: theme.spacing[4],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: cfg.bg,
            borderColor: 'border' in cfg ? cfg.border : theme.colors.transparent,
          }}>
          {loading
            ? <ActivityIndicator color={textColor} />
            : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                  {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
                  <Text style={{ color: textColor, fontSize: 16, fontWeight: '700', fontFamily: theme.fontFamily.labelSemi, letterSpacing: 0.2 }}>
                    {label}
                  </Text>
                </View>
              )}
        </View>
      )}
    </InteractivePressable>
  );
}
