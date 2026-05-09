import { useEffect } from 'react';

import { SOCKET_EVENTS } from '@/lib/realtime.constants';
import { useSocket } from './use-socket';

/**
 * Calls onNewNotification whenever the server pushes a notification:new event.
 * The callback is stable — callers should memoize it with useCallback.
 */
export function useNotificationsSocket(onNewNotification: () => void) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNewNotification);
    return () => { socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, onNewNotification); };
  }, [socket, onNewNotification]);
}
