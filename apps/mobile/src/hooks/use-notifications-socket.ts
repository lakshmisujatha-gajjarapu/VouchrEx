import { useEffect } from 'react';
import { useSocket } from './use-socket';

/**
 * Calls onNewNotification whenever the server pushes a notification:new event.
 * The callback is stable — callers should memoize it with useCallback.
 */
export function useNotificationsSocket(onNewNotification: () => void) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('notification:new', onNewNotification);
    return () => { socket.off('notification:new', onNewNotification); };
  }, [socket, onNewNotification]);
}
