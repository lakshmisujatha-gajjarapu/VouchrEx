import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';

import { useTheme } from '@/theme/theme-context';

type IconName = keyof typeof Ionicons.glyphMap;

type ToastVariant = {
  readonly icon: IconName;
  readonly getAccentColor: (theme: ReturnType<typeof useTheme>) => string;
  readonly getSoftColor: (theme: ReturnType<typeof useTheme>) => string;
};

const VARIANTS: Record<string, ToastVariant> = {
  info: {
    icon: 'notifications',
    getAccentColor: (t) => t.colors.brand,
    getSoftColor: (t) => t.colors.brandSoft,
  },
  success: {
    icon: 'checkmark-circle',
    getAccentColor: (t) => t.colors.action,
    getSoftColor: (t) => t.colors.actionSoft,
  },
  error: {
    icon: 'alert-circle',
    getAccentColor: (t) => t.colors.danger,
    getSoftColor: (t) => t.colors.dangerSoft,
  },
};

function GlassToast({ text1, text2, onPress, type }: ToastConfigParams<unknown>) {
  const theme = useTheme();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const variant = VARIANTS[type] ?? VARIANTS.info;

  const accentColor = variant.getAccentColor(theme);
  const softColor = variant.getSoftColor(theme);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrapper, { opacity: pressed ? 0.88 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={[text1, text2].filter(Boolean).join('. ')}
    >
      <BlurView
        intensity={theme.blurIntensity.mid}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.container,
          {
            borderColor: isDark ? theme.colors.glassBorder : theme.colors.border,
            shadowColor: theme.colors.shadowStrong,
          },
        ]}
      >
        {/* Left accent stripe */}
        <View style={[styles.stripe, { backgroundColor: accentColor }]} />

        {/* Icon badge */}
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: softColor },
          ]}
        >
          <Ionicons name={variant.icon} size={18} color={accentColor} />
        </View>

        {/* Text content */}
        <View style={styles.textBlock}>
          {!!text1 && (
            <Text
              style={[styles.title, { fontFamily: theme.fontFamily.labelSemi, color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {text1}
            </Text>
          )}
          {!!text2 && (
            <Text
              style={[styles.message, { fontFamily: theme.fontFamily.body, color: theme.colors.inkSecondary }]}
              numberOfLines={2}
            >
              {text2}
            </Text>
          )}
        </View>

        <Ionicons
          name="chevron-forward"
          size={14}
          color={theme.colors.inkMuted}
          style={styles.chevron}
        />
      </BlurView>
    </Pressable>
  );
}

export const toastConfig: ToastConfig = {
  info: (props) => <GlassToast {...props} type="info" />,
  success: (props) => <GlassToast {...props} type="success" />,
  error: (props) => <GlassToast {...props} type="error" />,
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    // iOS shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    // Android shadow
    elevation: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden',
    paddingRight: 14,
    paddingVertical: 10,
    gap: 10,
  },
  stripe: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginLeft: 4,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    flexShrink: 0,
  },
});
