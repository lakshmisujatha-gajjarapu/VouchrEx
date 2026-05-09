import { useEffect } from 'react';
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

    if (onCreated) socket.on('listing:created', onCreated);
    if (onUpdated) socket.on('listing:updated', onUpdated);

    return () => {
      if (onCreated) socket.off('listing:created', onCreated);
      if (onUpdated) socket.off('listing:updated', onUpdated);
    };
  }, [socket, onCreated, onUpdated]);
}
