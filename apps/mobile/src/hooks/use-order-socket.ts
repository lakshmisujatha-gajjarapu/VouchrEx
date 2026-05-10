import { useEffect } from 'react';

import { SOCKET_EVENTS } from '@/constants';
import { useSocket } from './use-socket';

/**
 * Calls onOrderUpdated whenever the server pushes an order:updated event
 * matching the given orderId. The callback is stable — callers should
 * memoize it with useCallback.
 */
export function useOrderSocket(orderId: string | undefined, onOrderUpdated: () => void) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !orderId) return;

    const handler = (data: { orderId: string; status: string }) => {
      if (data.orderId === orderId) {
        onOrderUpdated();
      }
    };

    socket.on(SOCKET_EVENTS.ORDER_UPDATED, handler);
    return () => { socket.off(SOCKET_EVENTS.ORDER_UPDATED, handler); };
  }, [socket, orderId, onOrderUpdated]);
}
