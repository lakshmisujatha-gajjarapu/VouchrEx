import { useEffect } from 'react';

import { SOCKET_EVENTS } from '@/lib/realtime.constants';
import { useSocket } from './use-socket';

export type ListingCreatedPayload = {
  readonly listingId: string;
  readonly sellerId: string;
  readonly brandId: string;
  readonly status: string;
};

export type ListingUpdatedPayload = {
  readonly listingId: string;
  readonly status: string;
};

type Handlers = {
  readonly onCreated?: (payload: ListingCreatedPayload) => void;
  readonly onUpdated?: (payload: ListingUpdatedPayload) => void;
};

/**
 * Subscribes to listing:created and listing:updated socket events.
 * Callbacks should be memoized by the caller (useCallback).
 */
export function useListingsSocket({ onCreated, onUpdated }: Handlers) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    if (onCreated) socket.on(SOCKET_EVENTS.LISTING_CREATED, onCreated);
    if (onUpdated) socket.on(SOCKET_EVENTS.LISTING_UPDATED, onUpdated);

    return () => {
      if (onCreated) socket.off(SOCKET_EVENTS.LISTING_CREATED, onCreated);
      if (onUpdated) socket.off(SOCKET_EVENTS.LISTING_UPDATED, onUpdated);
    };
  }, [socket, onCreated, onUpdated]);
}
