import React, { useEffect } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface InteractivePressableProps extends PressableProps {
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly scaleTo?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A highly interactive Pressable that scales down slightly on press using Reanimated springs.
 * Supports Reduced Motion: Skips the scale animation and falls back to a simple opacity change.
 */
export function InteractivePressable({
  children,
  style,
  scaleTo = 0.96,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: InteractivePressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  // Reset animations if disabled flips to true while pressed/animating
  useEffect(() => {
    if (disabled) {
      scale.value = withSpring(1);
      opacity.value = withTiming(1);
    }
  }, [disabled, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled) {
      if (reducedMotion) {
        opacity.value = withTiming(0.85, { duration: 100 });
      } else {
        scale.value = withSpring(scaleTo, {
          damping: 15,
          stiffness: 200,
        });
      }
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (!disabled) {
      if (reducedMotion) {
        opacity.value = withTiming(1, { duration: 100 });
      } else {
        scale.value = withSpring(1, {
          damping: 15,
          stiffness: 200,
        });
      }
    }
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
