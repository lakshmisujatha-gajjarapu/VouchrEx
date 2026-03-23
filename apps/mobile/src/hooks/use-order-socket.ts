import { useEffect } from 'react';
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

    socket.on('order:updated', handler);
    return () => { socket.off('order:updated', handler); };
  }, [socket, orderId, onOrderUpdated]);
}
