import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-context';

interface ShimmerProps {
  readonly width?: DimensionValue;
  readonly height?: DimensionValue;
  readonly borderRadius?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * A reusable shimmer component for building skeleton loaders.
 * Supports Reduced Motion: Gradient stops moving and becomes a static muted background.
 */
export function Shimmer({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: ShimmerProps) {
  const theme = useTheme();
  const shimmerValue = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(shimmerValue);
      shimmerValue.value = 0;
    } else {
      shimmerValue.value = withRepeat(
        withTiming(1, { duration: 1500 }),
        -1,
        false
      );
    }
  }, [reducedMotion, shimmerValue]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) return {};
    
    return {
      transform: [
        {
          translateX: interpolate(shimmerValue.value, [0, 1], [-300, 600]),
        },
      ],
    };
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surfaceTray,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {!reducedMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              theme.colors.surfaceHigh,
              'transparent',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}
