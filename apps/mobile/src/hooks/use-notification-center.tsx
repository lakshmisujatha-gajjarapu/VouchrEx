import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import { safeDeepLink } from '@/lib/push';
import { SOCKET_EVENTS } from '@/lib/realtime.constants';

import { useSocket } from './use-socket';

type IncomingNotification = {
  readonly id?: string;
  readonly title?: string;
  readonly message?: string;
  readonly link?: string;
};

type NotificationCenterValue = {
  readonly unreadCount: number;
  readonly markAllRead: () => void;
};

const NotificationCenterContext = createContext<NotificationCenterValue>({
  unreadCount: 0,
  markAllRead: () => {}
});

export function NotificationCenterProvider({ children }: { readonly children: React.ReactNode }) {
  const { socket } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  const handleNew = useCallback((payload: IncomingNotification | undefined) => {
    setUnreadCount((n) => n + 1);

    Toast.show({
      type: 'info',
      text1: payload?.title ?? 'New notification',
      text2: payload?.message,
      onPress: () => {
        const safe = safeDeepLink(payload?.link);
        if (safe) router.push(safe as never);
      }
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, handleNew);
    return () => { socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, handleNew); };
  }, [socket, handleNew]);

  const markAllRead = useCallback(() => { setUnreadCount(0); }, []);

  return (
    <NotificationCenterContext.Provider value={{ unreadCount, markAllRead }}>
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  return useContext(NotificationCenterContext);
}
