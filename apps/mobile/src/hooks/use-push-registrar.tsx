import React, { useEffect } from 'react';
import { router } from 'expo-router';

import { useAuth } from './use-auth';
import {
  configureForegroundBehavior,
  registerForPush,
  subscribeToNotificationTaps
} from '@/lib/push';

export function PushRegistrar({ children }: { readonly children: React.ReactNode }) {
  const { sessionToken, status } = useAuth();

  useEffect(() => {
    configureForegroundBehavior();
    const cleanup = subscribeToNotificationTaps((link) => { router.push(link as never); });
    return cleanup;
  }, []);

  useEffect(() => {
    if (status === 'signedIn' && sessionToken) {
      void registerForPush(sessionToken);
    }
  }, [status, sessionToken]);

  return <>{children}</>;
}
