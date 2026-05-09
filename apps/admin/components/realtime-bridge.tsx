'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';

import { API_CONFIG } from '@/lib/constants';

type Props = {
  readonly token: string | null;
};

const TAB_FLASH_PREFIX = '🔔 ';

export function RealtimeBridge({ token }: Props) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const originalTitleRef = useRef<string>('');
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    originalTitleRef.current = document.title;

    const wsUrl = API_CONFIG.BASE_URL.replace(/^http/, 'ws');
    const socket = io(wsUrl, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000
    });
    socketRef.current = socket;

    const refresh = () => { router.refresh(); };

    socket.on('order:updated', refresh);

    socket.on('dispute:opened', (payload: { orderId: string }) => {
      refresh();
      toast.warning('New dispute opened', {
        description: `Order ${payload.orderId.slice(0, 8)}…`,
        action: {
          label: 'Open',
          onClick: () => { window.location.href = `/disputes`; }
        }
      });
      startTabFlash();
    });

    const onFocus = () => { stopTabFlash(); };
    window.addEventListener('focus', onFocus);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      window.removeEventListener('focus', onFocus);
      stopTabFlash();
    };

    function startTabFlash() {
      if (document.hasFocus()) return;
      if (flashIntervalRef.current) return;
      let flipped = false;
      flashIntervalRef.current = setInterval(() => {
        flipped = !flipped;
        document.title = flipped
          ? `${TAB_FLASH_PREFIX}${originalTitleRef.current}`
          : originalTitleRef.current;
      }, 1000);
    }

    function stopTabFlash() {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
      document.title = originalTitleRef.current;
    }
  }, [token, router]);

  return null;
}
