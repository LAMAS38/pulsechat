import { useCallback, useEffect, useRef, useState } from "react";
import { parseServerEvent, serializeEvent } from "@shared/events";
import type { Message } from "@shared/message";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

export interface ActivityToast {
  id: string;
  kind: "join" | "leave" | "notice";
  username: string;
  text?: string;
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
/** Délai après lequel un « X écrit… » non rafraîchi est purgé (filet anti-blocage). */
const TYPING_TIMEOUT_MS = 6_000;
/** Délai de grâce avant d'afficher « a quitté » : évite le bruit lors d'un simple rafraîchissement. */
const LEAVE_GRACE_MS = 2_500;

function buildWebSocketUrl(slug: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // Le pseudo n'est plus passé en clair : l'identité est dérivée côté serveur
  // depuis le cookie de session signé (envoyé automatiquement au handshake).
  return `${protocol}//${window.location.host}/r/${encodeURIComponent(slug)}/ws`;
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
  const [reads, setReads] = useState<Record<string, number>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityToasts, setActivityToasts] = useState<ActivityToast[]>([]);
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  // Fermeture définitive (bannissement, session invalide) : ni reconnexion auto, ni « Réessayer ».
  const [terminal, setTerminal] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const connectionIdRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const historyTimeoutRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const lastReadSentRef = useRef(0);
  const typingTimersRef = useRef<Map<string, number>>(new Map());
  const pendingLeaveRef = useRef<Map<string, number>>(new Map());
  const connectedUsersRef = useRef<string[]>([]);

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

  const pushNotice = useCallback((text: string) => {
    const id = crypto.randomUUID();
    setActivityToasts((prev) => [...prev.slice(-2), { id, kind: "notice", username: "", text }]);
    window.setTimeout(() => {
      setActivityToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  /** Retire un utilisateur de la liste « en train d'écrire » et annule son timer. */
  const stopTyping = useCallback((name: string) => {
    const timer = typingTimersRef.current.get(name);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      typingTimersRef.current.delete(name);
    }
    setTypingUsers((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : prev));
  }, []);

  /** Purge tous les indicateurs de frappe (reset de salon, déconnexion, démontage). */
  const clearAllTyping = useCallback(() => {
    for (const timer of typingTimersRef.current.values()) window.clearTimeout(timer);
    typingTimersRef.current.clear();
    setTypingUsers([]);
  }, []);

  /** Annule les « a quitté » en attente (reset de salon, déconnexion, démontage). */
  const clearPendingLeaves = useCallback(() => {
    for (const timer of pendingLeaveRef.current.values()) window.clearTimeout(timer);
    pendingLeaveRef.current.clear();
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

    const ws = new WebSocket(buildWebSocketUrl(slug));
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
        case "join": {
          markHistoryLoaded();
          const name = serverEvent.username;
          const pending = pendingLeaveRef.current.get(name);
          if (pending !== undefined) {
            // La personne revient (rafraîchissement / reconnexion) : on annule son
            // « a quitté » en attente et on n'affiche pas non plus de « a rejoint ».
            window.clearTimeout(pending);
            pendingLeaveRef.current.delete(name);
          } else {
            pushActivityToast("join", name);
          }
          setUserCount(serverEvent.userCount);
          break;
        }
        case "leave": {
          markHistoryLoaded();
          const name = serverEvent.username;
          // Délai de grâce : un rafraîchissement enchaîne leave puis join très vite.
          // On n'affiche « a quitté » que si la personne n'est pas revenue et n'a pas
          // un autre onglet encore connecté (connectedUsers est dédupliqué par pseudo).
          const existing = pendingLeaveRef.current.get(name);
          if (existing !== undefined) window.clearTimeout(existing);
          pendingLeaveRef.current.set(
            name,
            window.setTimeout(() => {
              pendingLeaveRef.current.delete(name);
              if (!connectedUsersRef.current.includes(name)) {
                pushActivityToast("leave", name);
              }
            }, LEAVE_GRACE_MS),
          );
          setUserCount(serverEvent.userCount);
          break;
        }
        case "users":
          markHistoryLoaded();
          setUserCount(serverEvent.count);
          setConnectedUsers(serverEvent.usernames);
          connectedUsersRef.current = serverEvent.usernames;
          // Purge la frappe des utilisateurs qui ne sont plus connectés
          // (corrige l'indicateur bloqué après une déconnexion brutale en cours de frappe).
          {
            const present = new Set(serverEvent.usernames);
            for (const name of [...typingTimersRef.current.keys()]) {
              if (!present.has(name)) stopTyping(name);
            }
            setTypingUsers((prev) => prev.filter((name) => present.has(name)));
          }
          break;
        case "typing":
          if (serverEvent.isTyping) {
            const name = serverEvent.username;
            setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
            const existing = typingTimersRef.current.get(name);
            if (existing !== undefined) window.clearTimeout(existing);
            // Filet de sécurité : purge si le « stop » n'arrive jamais (onglet fermé brutalement).
            typingTimersRef.current.set(
              name,
              window.setTimeout(() => stopTyping(name), TYPING_TIMEOUT_MS),
            );
          } else {
            stopTyping(serverEvent.username);
          }
          break;
        case "reads":
          setReads(() => {
            const next: Record<string, number> = {};
            for (const receipt of serverEvent.reads) {
              next[receipt.username] = receipt.lastReadId;
            }
            return next;
          });
          break;
        case "read":
          setReads((prev) => {
            const current = prev[serverEvent.username] ?? 0;
            if (serverEvent.lastReadId <= current) return prev;
            return { ...prev, [serverEvent.username]: serverEvent.lastReadId };
          });
          break;
        case "room":
          setOwnerUsername(serverEvent.ownerUsername);
          setIsOwner(serverEvent.isOwner);
          break;
        case "cleared":
          markHistoryLoaded();
          setMessages([]);
          setReads({});
          break;
        case "notice":
          pushNotice(serverEvent.message);
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
        // Fermeture définitive (bannissement, session invalide) : pas de reconnexion
        // automatique NI de bouton « Réessayer » — réessayer échouerait pareil.
        setTerminal(true);
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
      clearAllTyping();
      clearPendingLeaves();
      return;
    }

    intentionalCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    setError(null);
    setTerminal(false);
    setHistoryLoaded(false);
    setMessages([]);
    clearAllTyping();
    clearPendingLeaves();
    setUserCount(0);
    setConnectedUsers([]);
    connectedUsersRef.current = [];
    setReads({});
    lastReadSentRef.current = 0;
    setActivityToasts([]);
    setOwnerUsername(null);
    setIsOwner(false);
    connectRef.current();

    return () => {
      intentionalCloseRef.current = true;
      connectionIdRef.current += 1;
      clearReconnectTimer();
      clearHistoryTimeout();
      closeActiveSocket();
      clearAllTyping();
      clearPendingLeaves();
    };
  }, [
    slug,
    username,
    enabled,
    clearReconnectTimer,
    clearHistoryTimeout,
    closeActiveSocket,
    clearAllTyping,
    clearPendingLeaves,
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

  const sendRead = useCallback((lastReadId: number) => {
    if (!Number.isFinite(lastReadId) || lastReadId <= lastReadSentRef.current) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    lastReadSentRef.current = lastReadId;
    ws.send(serializeEvent({ type: "read", lastReadId }));
  }, []);

  const clearRoom = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(serializeEvent({ type: "clear_room" }));
  }, []);

  const banUser = useCallback((target: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(serializeEvent({ type: "ban", username: target }));
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const reconnect = useCallback(() => {
    if (!enabled || !username) return;
    intentionalCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    setError(null);
    setTerminal(false);
    connectRef.current();
  }, [enabled, username, clearReconnectTimer]);

  return {
    messages,
    userCount,
    connectedUsers,
    typingUsers,
    reads,
    connectionStatus,
    historyLoaded,
    error,
    terminal,
    ownerUsername,
    isOwner,
    sendMessage,
    setTyping,
    sendRead,
    clearRoom,
    banUser,
    dismissError,
    reconnect,
    activityToasts,
  };
}
