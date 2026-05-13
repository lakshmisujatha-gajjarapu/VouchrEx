import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View } from 'react-native';

import { useConfig } from '@/hooks/use-config';
import { useTheme } from '@/theme/theme-context';

/**
 * Inline, dismissible notice shown above forms that depend on marketplace-config
 * values (sell + edit-listing screens). Surfaces caps/fee changes without
 * stealing focus or auto-dismissing — the user can read it on their own pace.
 *
 * Design rationale (theme-token-driven, no hardcoded values):
 * - Eyebrow label + headline + body — proper text hierarchy, not a single line
 * - brandSoft background + brand accent stripe — on-brand without competing
 *   with the primary form's CTA color
 * - Subtle elevation via shadowStrong — premium feel, no gimmicky blur
 * - Slide+fade entrance (220ms, ease-out) — respects reduced-motion
 * - 44pt hit area on dismiss; accessibility label provided
 * - No emoji icons; Ionicons used consistently with the rest of the app
 */
export function ConfigChangeBanner() {
  const config = useConfig();
  const theme = useTheme();
  const banner = config.changeBanner;

  const translateY = useRef(new Animated.Value(-8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (active) reducedMotionRef.current = enabled; })
      .catch(() => { /* assume false */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!banner) return;
    if (reducedMotionRef.current) {
      translateY.setValue(0);
      opacity.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [banner, opacity, translateY]);

  if (!banner) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        marginHorizontal: theme.spacing[5],
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[1],
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.brandSoft,
        opacity,
        transform: [{ translateY }],
        // Soft elevation — premium without screaming for attention
        shadowColor: theme.colors.shadowStrong,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 16,
        ...(Platform.OS === 'android' ? { elevation: 2 } : {})
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          overflow: 'hidden',
          borderRadius: theme.radius.md
        }}
      >
        {/* Brand accent stripe — anchors the banner to the product's identity */}
        <View
          style={{
            width: 4,
            backgroundColor: theme.colors.brand
          }}
        />

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: theme.spacing[3],
            paddingVertical: theme.spacing[3],
            paddingHorizontal: theme.spacing[4]
          }}
        >
          {/* Icon — circular tinted disc, not a raw glyph */}
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1
            }}
          >
            <Ionicons name="sparkles" size={15} color={theme.colors.brand} />
          </View>

          <View style={{ flex: 1 }}>
            {/* Eyebrow — calls out *what kind* of update without shouting */}
            <Text
              accessibilityLabel="Marketplace update"
              style={{
                fontFamily: theme.fontFamily.labelSemi,
                fontSize: theme.fontSize.caption,
                color: theme.colors.brand,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: 2
              }}
            >
              What's new
            </Text>
            <Text
              style={{
                fontFamily: theme.fontFamily.headline,
                fontSize: theme.fontSize.body,
                color: theme.colors.ink,
                marginBottom: 2
              }}
              numberOfLines={2}
            >
              {banner.title}
            </Text>
            <Text
              style={{
                fontFamily: theme.fontFamily.body,
                fontSize: theme.fontSize.label,
                color: theme.colors.inkSecondary,
                lineHeight: 18
              }}
            >
              {banner.message}
            </Text>
          </View>

          {/* Dismiss — 44pt hit area, accessible label, subtle press feedback */}
          <Pressable
            onPress={() => { config.dismissChangeBanner(); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss update"
            style={({ pressed }) => ({
              width: 28,
              height: 28,
              borderRadius: theme.radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1
            })}
          >
            <Ionicons name="close" size={16} color={theme.colors.inkMuted} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
