import { useCallback, useEffect, useRef, useState } from "react";
import { parseServerEvent, serializeEvent } from "@shared/events";
import type { Message } from "@shared/message";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

export interface ActivityToast {
  id: string;
  kind: "join" | "leave";
  username: string;
}

interface UseChatWebSocketOptions {
  slug: string;
  username: string | null;
  enabled: boolean;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
const MAX_RECONNECT_ATTEMPTS = 8;
/** N'afficher une alerte qu'après plusieurs échecs (évite les faux positifs à l'entrée). */
const ERROR_AFTER_ATTEMPTS = 2;

function buildWebSocketUrl(slug: string, username: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({ username });
  return `${protocol}//${window.location.host}/r/${encodeURIComponent(slug)}/ws?${params.toString()}`;
}

function detachWebSocket(ws: WebSocket): void {
  ws.onopen = null;
  ws.onmessage = null;
  ws.onclose = null;
  ws.onerror = null;
}

export function useChatWebSocket({ slug, username, enabled }: UseChatWebSocketOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityToasts, setActivityToasts] = useState<ActivityToast[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const connectionIdRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const historyTimeoutRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);
  const usernameRef = useRef(username);
  usernameRef.current = username;

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const clearHistoryTimeout = useCallback(() => {
    if (historyTimeoutRef.current !== null) {
      window.clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
  }, []);

  const markHistoryLoaded = useCallback(() => {
    clearHistoryTimeout();
    setHistoryLoaded(true);
  }, [clearHistoryTimeout]);

  const scheduleHistoryFallback = useCallback(() => {
    clearHistoryTimeout();
    historyTimeoutRef.current = window.setTimeout(() => {
      historyTimeoutRef.current = null;
      setHistoryLoaded(true);
    }, 4_000);
  }, [clearHistoryTimeout]);

  const pushActivityToast = useCallback((kind: ActivityToast["kind"], name: string) => {
    if (name === usernameRef.current) return;

    const id = crypto.randomUUID();
    setActivityToasts((prev) => [...prev.slice(-2), { id, kind, username: name }]);
    window.setTimeout(() => {
      setActivityToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeActiveSocket = useCallback(() => {
    clearConnectTimeout();
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    detachWebSocket(ws);
    ws.close();
  }, [clearConnectTimeout]);

  const setTransientError = useCallback((message: string) => {
    if (reconnectAttemptRef.current >= ERROR_AFTER_ATTEMPTS) {
      setError(message);
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current) return;

    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus("disconnected");
      setHistoryLoaded(true);
      setError("Connexion impossible. Réessayez ou rechargez la page.");
      return;
    }

    if (reconnectAttemptRef.current >= ERROR_AFTER_ATTEMPTS) {
      setError("Connexion instable. Nouvelle tentative en cours…");
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
    closeActiveSocket();

    const connectionId = ++connectionIdRef.current;
    const isFirstAttempt = reconnectAttemptRef.current === 0;

    setConnectionStatus(isFirstAttempt ? "connecting" : "reconnecting");
    if (isFirstAttempt) {
      setError(null);
      scheduleHistoryFallback();
    }

    const ws = new WebSocket(buildWebSocketUrl(slug, username));
    wsRef.current = ws;

    connectTimeoutRef.current = window.setTimeout(() => {
      connectTimeoutRef.current = null;
      if (ws.readyState === WebSocket.CONNECTING) {
        detachWebSocket(ws);
        ws.close();
      }
    }, 12_000);

    ws.onopen = () => {
      if (connectionId !== connectionIdRef.current) return;

      clearConnectTimeout();
      reconnectAttemptRef.current = 0;
      setConnectionStatus("connected");
      setError(null);
      scheduleHistoryFallback();
    };

    ws.onmessage = (event) => {
      if (connectionId !== connectionIdRef.current) return;

      const data = typeof event.data === "string" ? event.data : "";
      const serverEvent = parseServerEvent(data);
      if (!serverEvent) return;

      switch (serverEvent.type) {
        case "history":
          setMessages(serverEvent.messages);
          markHistoryLoaded();
          break;
        case "message":
          markHistoryLoaded();
          setMessages((prev) => [...prev, serverEvent.message]);
          break;
        case "join":
          markHistoryLoaded();
          pushActivityToast("join", serverEvent.username);
          setUserCount(serverEvent.userCount);
          break;
        case "leave":
          markHistoryLoaded();
          pushActivityToast("leave", serverEvent.username);
          setUserCount(serverEvent.userCount);
          break;
        case "users":
          markHistoryLoaded();
          setUserCount(serverEvent.count);
          setConnectedUsers(serverEvent.usernames);
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
          markHistoryLoaded();
          setError(serverEvent.message);
          break;
      }
    };

    ws.onclose = (event) => {
      if (connectionId !== connectionIdRef.current) return;

      clearConnectTimeout();
      wsRef.current = null;

      if (intentionalCloseRef.current) {
        setConnectionStatus("disconnected");
        return;
      }

      if (event.code === 1008) {
        setConnectionStatus("disconnected");
        setError(event.reason || "Connexion refusée. Vérifiez votre pseudo ou le salon.");
        return;
      }

      scheduleReconnect();
    };

    // onerror ne fournit aucun détail fiable — onclose gère les vrais échecs
    ws.onerror = () => {
      if (connectionId !== connectionIdRef.current) return;
      setTransientError("Problème de connexion. Nouvelle tentative…");
    };
  };

  useEffect(() => {
    if (!enabled || !username) {
      intentionalCloseRef.current = true;
      connectionIdRef.current += 1;
      clearReconnectTimer();
      clearHistoryTimeout();
      closeActiveSocket();
      setConnectionStatus("disconnected");
      setHistoryLoaded(false);
      setError(null);
      return;
    }

    intentionalCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    setError(null);
    setHistoryLoaded(false);
    setMessages([]);
    setTypingUsers([]);
    setUserCount(0);
    setConnectedUsers([]);
    setActivityToasts([]);
    connectRef.current();

    return () => {
      intentionalCloseRef.current = true;
      connectionIdRef.current += 1;
      clearReconnectTimer();
      clearHistoryTimeout();
      closeActiveSocket();
    };
  }, [
    slug,
    username,
    enabled,
    clearReconnectTimer,
    clearHistoryTimeout,
    closeActiveSocket,
  ]);

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

  const dismissError = useCallback(() => setError(null), []);

  const reconnect = useCallback(() => {
    if (!enabled || !username) return;
    intentionalCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    setError(null);
    connectRef.current();
  }, [enabled, username, clearReconnectTimer]);

  return {
    messages,
    userCount,
    connectedUsers,
    typingUsers,
    connectionStatus,
    historyLoaded,
    error,
    sendMessage,
    setTyping,
    dismissError,
    reconnect,
    activityToasts,
  };
}
