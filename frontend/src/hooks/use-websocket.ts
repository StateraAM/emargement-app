'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { api, API_URL } from '@/lib/api';

type WSMessage = {
  type: string;
  student_id: string;
  student_name: string;
  signed_at: string;
};

type UseWebSocketOptions = {
  courseId: string;
  enabled?: boolean;
  onMessage?: (msg: WSMessage) => void;
};

function getWsUrl(courseId: string, token: string): string {
  const base = API_URL.replace(/^http/, 'ws');
  return `${base}/ws/attendance/${courseId}?token=${encodeURIComponent(token)}`;
}

export function useWebSocket({ courseId, enabled = true, onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onMessageRef = useRef(onMessage);
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const token = api.getToken();
    if (!token) return;

    const url = getWsUrl(courseId, token);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        onMessageRef.current?.(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (mountedRef.current) {
        setConnected(false);
        // Auto-reconnect after 3 seconds
        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [courseId]);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);

  return { connected };
}
