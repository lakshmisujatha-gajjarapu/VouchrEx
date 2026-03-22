import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

const GRADIENT: readonly [string, string] = ['#A78BFA', '#D3BBFF'];
const FG = '#003B27';

export function RevealCodeButton({
  onPress,
  loading = false,
  disabled = false,
}: {
  readonly onPress: () => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
}) {
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
        shadowColor: '#A78BFA',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 4,
      })}>
      <LinearGradient
        colors={GRADIENT}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{
          height: 56,
          borderRadius: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
        {loading
          ? <ActivityIndicator color={FG} />
          : (
              <>
                <Ionicons color={FG} name="key" size={20} />
                <Text style={{ color: FG, fontSize: 16, fontWeight: '700', fontFamily: 'Manrope_700Bold', letterSpacing: 0.2 }}>
                  Reveal Code
                </Text>
              </>
            )}
      </LinearGradient>
    </Pressable>
  );
}
