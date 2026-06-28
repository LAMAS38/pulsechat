import { DurableObject } from "cloudflare:workers";
import {
  parseClientEvent,
  serializeEvent,
  type ServerEvent,
} from "../../shared/events";
import { validateUsername } from "../../shared/slug";
import { countGraphemes, MESSAGE_MAX_GRAPHEMES } from "../../shared/textLength";
import type { Env } from "../env";
import {
  MessageRateLimiter,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_SEC,
} from "../lib/rateLimit";
import {
  addBan,
  clearRoomMessages,
  fetchMessageHistory,
  fetchReadReceipts,
  insertMessage,
  isBanned,
  recordReadReceipt,
} from "./messages";
import { initMessageSchema } from "./schema";

const MAX_MESSAGE_LENGTH = MESSAGE_MAX_GRAPHEMES;
const HISTORY_LIMIT = 50;

interface SessionAttachment {
  username: string;
  roomSlug: string;
  userId: string;
  guest: boolean;
  isOwner: boolean;
}

export class ChatRoom extends DurableObject<Env> {
  private readonly rateLimiter = new MessageRateLimiter();
  /** Propriétaire du salon (pseudo), fourni par le Worker à chaque connexion. */
  private ownerUsername: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      initMessageSchema(this.ctx.storage.sql);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const roomSlug =
      request.headers.get("X-Room-Slug") ??
      new URL(request.url).searchParams.get("room") ??
      "";

    if (!roomSlug) {
      return new Response("Missing room", { status: 400 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // L'identité provient du header posé par le Worker après vérification du
    // cookie de session (cf. src/routes/room.ts). Jamais d'un paramètre client.
    const usernameHeader = request.headers.get("X-Username") ?? "";
    let decodedUsername = "";
    try {
      decodedUsername = decodeURIComponent(usernameHeader);
    } catch {
      decodedUsername = "";
    }
    const usernameValidation = validateUsername(decodedUsername);
    if (!usernameValidation.valid || !usernameValidation.username) {
      return new Response(
        serializeEvent({
          type: "error",
          code: usernameValidation.error ?? "invalid_username",
          message: "Invalid username",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const username = usernameValidation.username;
    const userId = request.headers.get("X-User-Id") ?? username;
    const guest = request.headers.get("X-User-Guest") === "1";
    const isOwner = request.headers.get("X-Is-Owner") === "1";

    // Le propriétaire (transmis par le Worker depuis D1) est mémorisé pour le salon.
    const ownerHeader = request.headers.get("X-Owner-Username") ?? "";
    try {
      const decodedOwner = decodeURIComponent(ownerHeader);
      this.ownerUsername = decodedOwner || this.ownerUsername;
    } catch {
      /* on garde la valeur précédente */
    }

    // Enforcement du bannissement dès le handshake. On ACCEPTE le WebSocket puis
    // on le ferme aussitôt avec le code 1008 + un motif. Un rejet HTTP 403 serait
    // invisible côté navigateur (onclose code 1006) et déclencherait une boucle de
    // reconnexion (« connexion instable »). Le 1008 + motif permet au client
    // d'afficher la raison du bannissement et d'arrêter les tentatives.
    if (isBanned(this.ctx.storage.sql, userId)) {
      const banPair = new WebSocketPair();
      const banClient = banPair[0];
      const banServer = banPair[1];
      banServer.accept();
      banServer.send(
        serializeEvent({ type: "error", code: "banned", message: "Vous êtes banni de ce salon" }),
      );
      banServer.close(1008, "Vous êtes banni de ce salon");
      return new Response(null, { status: 101, webSocket: banClient });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    const attachment: SessionAttachment = { username, roomSlug, userId, guest, isOwner };
    this.ctx.acceptWebSocket(server, [JSON.stringify(attachment)]);

    // Historique après le 101 — waitUntil garantit l'envoi côté Worker.
    this.ctx.waitUntil(this.bootstrapConnection(server, roomSlug, username, isOwner));

    return new Response(null, { status: 101, webSocket: client });
  }

  private async bootstrapConnection(
    server: WebSocket,
    roomSlug: string,
    username: string,
    isOwner: boolean,
  ): Promise<void> {
    this.send(server, { type: "room", ownerUsername: this.ownerUsername, isOwner });
    await this.sendHistory(server, roomSlug);
    this.sendReadReceipts(server);
    this.broadcast(
      {
        type: "join",
        username,
        userCount: this.getConnectedUsernames().length,
      },
      server,
    );
    this.broadcastUsers();
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const session = this.getSession(ws);
    if (!session) {
      ws.close(1008, "Invalid session");
      return;
    }

    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const event = parseClientEvent(raw);
    if (!event) {
      this.send(ws, {
        type: "error",
        code: "invalid_event",
        message: "Invalid event payload",
      });
      return;
    }

    if (event.type === "typing") {
      this.broadcast(
        {
          type: "typing",
          username: session.username,
          isTyping: event.isTyping,
        },
        ws,
      );
      return;
    }

    if (event.type === "read") {
      const result = recordReadReceipt(
        this.ctx.storage.sql,
        session.username,
        Math.trunc(event.lastReadId),
      );
      if (result.changed) {
        this.broadcast({
          type: "read",
          username: session.username,
          lastReadId: result.lastReadId,
        });
      }
      return;
    }

    if (event.type === "clear_room") {
      if (!session.isOwner) {
        this.send(ws, { type: "error", code: "forbidden", message: "Action réservée au propriétaire" });
        return;
      }
      clearRoomMessages(this.ctx.storage.sql);
      this.broadcast({ type: "cleared" });
      this.broadcast({ type: "notice", message: "Le salon a été vidé par le propriétaire." });
      return;
    }

    if (event.type === "ban") {
      if (!session.isOwner) {
        this.send(ws, { type: "error", code: "forbidden", message: "Action réservée au propriétaire" });
        return;
      }
      this.banUser(event.username, session.username);
      return;
    }

    const content = event.content.trim();
    if (!content || countGraphemes(content) > MAX_MESSAGE_LENGTH) {
      this.send(ws, {
        type: "error",
        code: "invalid_message",
        message: "Message must be between 1 and 2000 characters",
      });
      return;
    }

    if (this.rateLimiter.isLimited(session.username)) {
      const retryAfter = Math.ceil(this.rateLimiter.retryAfterMs(session.username) / 1000);
      this.send(ws, {
        type: "error",
        code: "rate_limited",
        message: `Trop de messages. Réessayez dans ${retryAfter || RATE_LIMIT_WINDOW_SEC} s (max ${RATE_LIMIT_MAX}/${RATE_LIMIT_WINDOW_SEC} s).`,
      });
      return;
    }

    let saved;
    try {
      saved = insertMessage(
        this.ctx.storage.sql,
        session.roomSlug,
        session.username,
        content,
      );
    } catch {
      this.send(ws, {
        type: "error",
        code: "persist_failed",
        message: "Failed to save message",
      });
      return;
    }

    this.broadcast({
      type: "message",
      message: saved,
    });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const remainingCount = this.getConnectedUsernames(ws).length;
    this.broadcast({
      type: "leave",
      username: session.username,
      userCount: remainingCount,
    });
    this.broadcastUsers(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    ws.close(1011, "WebSocket error");
  }

  /**
   * Bannit un utilisateur connecté par son pseudo : enregistre le ban (par id),
   * ferme ses sockets et notifie le salon. On ne peut bannir que des membres
   * actuellement connectés (on a besoin de leur id), ni le propriétaire.
   */
  private banUser(targetUsername: string, byUsername: string): void {
    const target = targetUsername.trim();
    if (!target || target === this.ownerUsername) return;

    const victims = this.ctx
      .getWebSockets()
      .map((socket) => ({ socket, session: this.getSession(socket) }))
      .filter((entry): entry is { socket: WebSocket; session: SessionAttachment } =>
        entry.session !== null && entry.session.username === target && !entry.session.isOwner,
      );

    if (victims.length === 0) return;

    for (const { socket, session } of victims) {
      addBan(this.ctx.storage.sql, session.userId, session.username);
      this.send(socket, { type: "error", code: "banned", message: "Vous avez été banni de ce salon" });
      try {
        socket.close(1008, "Vous avez été banni de ce salon");
      } catch {
        /* socket déjà fermé */
      }
    }

    this.broadcast({ type: "notice", message: `${target} a été banni par ${byUsername}.` });
    this.broadcastUsers();
  }

  private getSession(ws: WebSocket): SessionAttachment | null {
    const tags = this.ctx.getTags(ws);
    if (tags.length === 0) return null;

    try {
      return JSON.parse(tags[0]!) as SessionAttachment;
    } catch {
      return null;
    }
  }

  private getConnectedUsernames(exclude?: WebSocket): string[] {
    const usernames = new Set<string>();
    for (const socket of this.ctx.getWebSockets()) {
      if (exclude && socket === exclude) continue;
      const session = this.getSession(socket);
      if (session) {
        usernames.add(session.username);
      }
    }
    return [...usernames].sort((a, b) => a.localeCompare(b));
  }

  private async sendHistory(ws: WebSocket, roomSlug: string): Promise<void> {
    try {
      const messages = fetchMessageHistory(this.ctx.storage.sql, roomSlug, HISTORY_LIMIT);
      this.send(ws, { type: "history", messages });
    } catch {
      this.send(ws, {
        type: "error",
        code: "history_failed",
        message: "Impossible de charger l'historique",
      });
    }
  }

  private sendReadReceipts(ws: WebSocket): void {
    try {
      const reads = fetchReadReceipts(this.ctx.storage.sql);
      if (reads.length > 0) {
        this.send(ws, { type: "reads", reads });
      }
    } catch {
      // Les accusés de lecture sont secondaires : on n'interrompt pas la connexion.
    }
  }

  private send(ws: WebSocket, event: ServerEvent): void {
    try {
      ws.send(serializeEvent(event));
    } catch {
      ws.close(1011, "Failed to send");
    }
  }

  private broadcast(event: ServerEvent, exclude?: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (exclude && ws === exclude) continue;
      this.send(ws, event);
    }
  }

  private broadcastUsers(exclude?: WebSocket): void {
    const usernames = this.getConnectedUsernames(exclude);
    this.broadcast({
      type: "users",
      count: usernames.length,
      usernames,
    });
  }
}
