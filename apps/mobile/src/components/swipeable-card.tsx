import { Ionicons } from '@expo/vector-icons';
import React, { useImperativeHandle, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useTheme } from '@/theme/theme-context';

export type SwipeAction = {
  readonly key: string;
  readonly label: string;
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly backgroundColor: string;
  readonly onPress: () => void;
  readonly minWidth?: number;
};

export type SwipeableCardRef = {
  readonly close: () => void;
};

function SwipeableCardInner(
  {
    actions,
    children,
    enabled,
  }: {
    readonly actions: readonly SwipeAction[];
    readonly children: React.ReactNode;
    readonly enabled?: boolean;
  },
  ref: React.Ref<SwipeableCardRef>,
) {
  const theme = useTheme();
  const swipeableRef = useRef<SwipeableMethods>(null);

  useImperativeHandle(ref, () => ({
    close() {
      swipeableRef.current?.close();
    },
  }));

  function renderRightActions(
    _progress: unknown,
    _translation: unknown,
    swipeableMethods: SwipeableMethods,
  ) {
    return (
      <View style={{ flexDirection: 'row' }}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => {
              swipeableMethods.close();
              action.onPress();
            }}
            style={({ pressed }) => ({
              width: action.minWidth ?? 72,
              backgroundColor: pressed ? `${action.backgroundColor}cc` : action.backgroundColor,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing[1],
            })}>
            <Ionicons name={action.icon} size={20} color="#FFFFFF" />
            <Text style={{
              fontFamily: theme.fontFamily.labelSemi,
              fontSize: 11,
              color: '#FFFFFF',
              letterSpacing: 0.2,
            }}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      enabled={enabled ?? actions.length > 0}
      friction={2}
      overshootRight={false}
      renderRightActions={renderRightActions}
      rightThreshold={40}>
      {children}
    </ReanimatedSwipeable>
  );
}

export const SwipeableCard = React.forwardRef(SwipeableCardInner);
