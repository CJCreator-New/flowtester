import { useEffect, useRef, useState } from 'react';
import type { RunnerEvent } from '../lib/translate';

export type StreamConnection = 'connecting' | 'open' | 'reconnecting';

const RECONNECT_DELAY_MS = 3000;

/**
 * Keeps one EventSource open to the runner while `enabled`, reconnecting after drops.
 * After a reconnect, `onReconnected` fires so the caller can catch up on anything it missed.
 */
export function useRunnerStream(
  url: string,
  enabled: boolean,
  onEvent: (event: RunnerEvent) => void,
  onReconnected: () => void
): StreamConnection {
  const [connection, setConnection] = useState<StreamConnection>('connecting');
  const handlers = useRef({ onEvent, onReconnected });
  handlers.current = { onEvent, onReconnected };

  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let dropped = false;

    const connect = () => {
      source = new EventSource(url);
      source.onmessage = (message) => {
        let event: RunnerEvent;
        try {
          event = JSON.parse(message.data);
        } catch {
          return;
        }
        if (event.type === 'connected') {
          setConnection('open');
          if (dropped) {
            dropped = false;
            handlers.current.onReconnected();
          }
        }
        handlers.current.onEvent(event);
      };
      source.onerror = () => {
        source?.close();
        if (disposed) return;
        dropped = true;
        setConnection('reconnecting');
        retry = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();
    return () => {
      disposed = true;
      source?.close();
      clearTimeout(retry);
    };
  }, [url, enabled]);

  return connection;
}
