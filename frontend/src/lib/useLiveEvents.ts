import { useEffect, useRef, useState } from 'react';
import { eventStreamUrl, tokenStore } from './api';
import type { LiveEvent } from './types';

export type LiveStatus = 'connecting' | 'live' | 'offline';

const EVENT_TYPES = [
  'connected',
  'heartbeat',
  'ticket.created',
  'ticket.updated',
  'ticket.message',
  'ticket.closed',
];

/**
 * Subscribes to the server's SSE stream. EventSource reconnects on its own, but
 * a 401 (expired token) would retry forever, so errors close the stream and we
 * retry on a short timer. The status is surfaced in the UI ("Live" indicator).
 */
export const useLiveEvents = (onEvent: (event: LiveEvent) => void) => {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!tokenStore.get()) {
      setStatus('offline');
      return;
    }

    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const url = eventStreamUrl();
      if (!url) {
        setStatus('offline');
        return;
      }

      setStatus((current) => (current === 'live' ? 'live' : 'connecting'));
      source = new EventSource(url);

      const handle = (raw: MessageEvent) => {
        try {
          const parsed = JSON.parse(raw.data) as LiveEvent;
          if (parsed.type === 'heartbeat') return;
          if (parsed.type === 'connected') {
            setStatus('live');
            return;
          }
          handlerRef.current(parsed);
        } catch {
          /* ignore malformed frames */
        }
      };

      EVENT_TYPES.forEach((type) => source?.addEventListener(type, handle as EventListener));

      source.onopen = () => setStatus('live');
      source.onerror = () => {
        setStatus('offline');
        source?.close();
        source = null;
        if (!disposed) retryTimer = window.setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return status;
};
