import { useEffect } from 'react';

import { SOCKET_EVENTS } from '@/lib/realtime.constants';
import { useSocket } from './use-socket';

/**
 * Calls the callback whenever any order:updated event arrives. Use this on
 * list screens that need to refresh when any of the user's orders change.
 * For a single-order screen, use useOrderSocket instead.
 */
export function useOrdersListSocket(onAnyOrderUpdated: () => void) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on(SOCKET_EVENTS.ORDER_UPDATED, onAnyOrderUpdated);
    return () => { socket.off(SOCKET_EVENTS.ORDER_UPDATED, onAnyOrderUpdated); };
  }, [socket, onAnyOrderUpdated]);
}
