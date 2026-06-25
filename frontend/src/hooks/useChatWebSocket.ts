import { useCallback, useEffect, useRef, useState } from "react";
import { parseServerEvent, serializeEvent } from "@shared/events";
import type { Message } from "@shared/message";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

interface UseChatWebSocketOptions {
  slug: string;
  username: string | null;
  enabled: boolean;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
const MAX_RECONNECT_ATTEMPTS = 8;

function buildWebSocketUrl(slug: string, username: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({ username });
  return `${protocol}//${window.location.host}/r/${encodeURIComponent(slug)}/ws?${params.toString()}`;
}

export function useChatWebSocket({ slug, username, enabled }: UseChatWebSocketOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current) return;

    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus("disconnected");
      setError("Connexion impossible. Rechargez la page ou vérifiez votre pseudo.");
      return;
    }

    const attempt = reconnectAttemptRef.current;
    const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
    const jitter = Math.random() * 500;
    const delay = exponential + jitter;

    setConnectionStatus("reconnecting");
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectAttemptRef.current += 1;
      connectRef.current();
    }, delay);
  }, []);

  const connectRef = useRef<() => void>(() => {});

  connectRef.current = () => {
    if (!enabled || !username) return;

    clearReconnectTimer();
    wsRef.current?.close();

    setConnectionStatus(reconnectAttemptRef.current === 0 ? "connecting" : "reconnecting");
    setError(null);

    const ws = new WebSocket(buildWebSocketUrl(slug, username));
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnectionStatus("connected");
    };

    ws.onmessage = (event) => {
      const data = typeof event.data === "string" ? event.data : "";
      const serverEvent = parseServerEvent(data);
      if (!serverEvent) return;

      switch (serverEvent.type) {
        case "history":
          setMessages(serverEvent.messages);
          break;
        case "message":
          setMessages((prev) => [...prev, serverEvent.message]);
          break;
        case "join":
        case "leave":
          setUserCount(serverEvent.userCount);
          break;
        case "users":
          setUserCount(serverEvent.count);
          break;
        case "typing":
          setTypingUsers((prev) => {
            if (!serverEvent.isTyping) {
              return prev.filter((name) => name !== serverEvent.username);
            }
            if (prev.includes(serverEvent.username)) return prev;
            return [...prev, serverEvent.username];
          });
          break;
        case "error":
          setError(serverEvent.message);
          break;
      }
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      if (intentionalCloseRef.current) {
        setConnectionStatus("disconnected");
        return;
      }

      if (event.code === 1008) {
        setConnectionStatus("disconnected");
        setError(event.reason || "Connexion refusée (pseudo ou salon invalide).");
        return;
      }

      scheduleReconnect();
    };

    ws.onerror = () => {
      setError("Connexion WebSocket interrompue");
    };
  };

  useEffect(() => {
    if (!enabled || !username) {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
      setConnectionStatus("disconnected");
      return;
    }

    intentionalCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    setMessages([]);
    setTypingUsers([]);
    setUserCount(0);
    connectRef.current();

    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [slug, username, enabled, clearReconnectTimer]);

  const sendMessage = useCallback((content: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    ws.send(serializeEvent({ type: "message", content }));
    return true;
  }, []);

  const setTyping = useCallback((isTyping: boolean) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(serializeEvent({ type: "typing", isTyping }));
  }, []);

  return {
    messages,
    userCount,
    typingUsers,
    connectionStatus,
    error,
    sendMessage,
    setTyping,
  };
}
