import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_BOTTOM_MARGIN = 12;

export function useTabBarClearance(extra = 16) {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, TAB_BAR_BOTTOM_MARGIN) + extra;
}
