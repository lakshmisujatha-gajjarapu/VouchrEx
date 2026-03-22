import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Calls `refetch` whenever the screen comes into focus.
 * Skips the very first focus so the initial load from useAsyncResource
 * doesn't fire twice.
 */
export function useRefetchOnFocus(refetch: () => void) {
  const initialFocusDone = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!initialFocusDone.current) {
        initialFocusDone.current = true;
        return;
      }
      refetch();
    }, [refetch])
  );
}
