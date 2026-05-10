import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/theme-context';

export function ProfileAvatar({ marginTop = 0 }: { readonly marginTop?: number }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const initial = (user?.name ?? user?.phone ?? '?')[0].toUpperCase();

  return (
    <Pressable
      accessibilityLabel="Profile"
      accessibilityRole="button"
      onPress={() => { router.push('/profile'); }}
      style={({ pressed }) => ({
        marginTop,
        opacity: pressed ? 0.75 : 1,
        borderRadius: 20,
        shadowColor: theme.colors.brand,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 4,
      })}>
      <LinearGradient
        colors={theme.gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        <Text style={{
          fontFamily: theme.fontFamily.headlineExtra,
          fontSize: 15,
          color: theme.colors.white,
        }}>
          {initial}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
