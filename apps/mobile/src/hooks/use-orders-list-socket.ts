import { useEffect } from 'react';
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

    socket.on('order:updated', onAnyOrderUpdated);
    return () => { socket.off('order:updated', onAnyOrderUpdated); };
  }, [socket, onAnyOrderUpdated]);
}
