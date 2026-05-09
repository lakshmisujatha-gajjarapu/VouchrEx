import { useEffect } from 'react';

import { useSocket } from './use-socket';

/**
 * Calls `refetch` whenever the socket reconnects after a drop. Used in
 * combination with useRefetchOnFocus to ensure stale screens recover both
 * after backgrounding (focus) and after network blips (reconnect).
 */
export function useRefetchOnReconnect(refetch: () => void) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    let firstConnect = true;
    const onReconnect = () => {
      if (firstConnect) {
        firstConnect = false;
        return;
      }
      refetch();
    };

    socket.on('connect', onReconnect);
    return () => {
      socket.off('connect', onReconnect);
    };
  }, [socket, refetch]);
}
