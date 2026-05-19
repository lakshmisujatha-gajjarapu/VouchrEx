import { Ionicons } from '@expo/vector-icons';
import React, { useImperativeHandle, useRef } from 'react';
import { Text, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';

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
  const swipeableRef = useRef<Swipeable>(null);

  useImperativeHandle(ref, () => ({
    close() {
      swipeableRef.current?.close();
    },
  }));

  function renderRightActions() {
    return (
      <View style={{ flexDirection: 'row' }}>
        {actions.map((action) => (
          <RectButton
            key={action.key}
            onPress={() => {
              swipeableRef.current?.close();
              action.onPress();
            }}
            style={{
              width: action.minWidth ?? 72,
              backgroundColor: action.backgroundColor,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing[1],
            }}>
            <Ionicons name={action.icon} size={20} color="#FFFFFF" />
            <Text style={{
              fontFamily: theme.fontFamily.labelSemi,
              fontSize: 11,
              color: '#FFFFFF',
              letterSpacing: 0.2,
            }}>
              {action.label}
            </Text>
          </RectButton>
        ))}
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      enabled={enabled ?? actions.length > 0}
      friction={2}
      overshootRight={false}
      renderRightActions={renderRightActions}
      rightThreshold={40}>
      {children}
    </Swipeable>
  );
}

export const SwipeableCard = React.forwardRef(SwipeableCardInner);
