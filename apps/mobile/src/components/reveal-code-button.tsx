import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

export function RevealCodeButton({
  onPress,
  loading = false,
  disabled = false,
}: {
  readonly onPress: () => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
}) {
  const theme = useTheme();
  const FG = theme.colors.surface;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        opacity: loading ? 0.7 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed && !disabled && !loading ? 0.982 : 1 }],
        shadowColor: theme.colors.brand,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 4,
      })}>
      <LinearGradient
        colors={theme.gradients.brand}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{
          height: 56,
          borderRadius: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing[2],
        }}>
        {loading
          ? <ActivityIndicator color={FG} />
          : (
              <>
                <Ionicons color={FG} name="key" size={20} />
                <Text style={{ color: FG, fontSize: theme.fontSize.mono, fontWeight: '700', fontFamily: theme.fontFamily.headline, letterSpacing: 0.2 }}>
                  Reveal Code
                </Text>
              </>
            )}
      </LinearGradient>
    </Pressable>
  );
}
