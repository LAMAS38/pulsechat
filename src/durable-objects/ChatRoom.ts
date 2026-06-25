import { DurableObject } from "cloudflare:workers";
import type { SqlStorageValue } from "@cloudflare/workers-types";
import {
  parseClientEvent,
  serializeEvent,
  type ServerEvent,
} from "../../shared/events";
import { messageFromRow } from "../../shared/message";
import { validateUsername } from "../../shared/slug";
import type { Env } from "../env";
import { MESSAGES_SCHEMA } from "./schema";

interface SqlMessageRow extends Record<string, SqlStorageValue> {
  id: number;
  username: string;
  content: string;
  created_at: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_LIMIT = 50;

interface SessionAttachment {
  username: string;
  roomSlug: string;
}

export class ChatRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    this.ensureSchema();

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

    const usernameParam = new URL(request.url).searchParams.get("username") ?? "";
    const usernameValidation = validateUsername(usernameParam);
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
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    const attachment: SessionAttachment = { username, roomSlug };
    this.ctx.acceptWebSocket(server, [JSON.stringify(attachment)]);

    this.sendHistory(server, roomSlug);
    this.broadcast(
      {
        type: "join",
        username,
        userCount: this.getConnectedUsernames().length,
      },
      server,
    );
    this.broadcastUsers();

    return new Response(null, { status: 101, webSocket: client });
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

    const content = event.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      this.send(ws, {
        type: "error",
        code: "invalid_message",
        message: "Message must be between 1 and 2000 characters",
      });
      return;
    }

    let inserted: SqlMessageRow;
    try {
      inserted = this.ctx.storage.sql
        .exec<SqlMessageRow>(
          `INSERT INTO messages (username, content)
           VALUES (?, ?)
           RETURNING id, username, content, created_at`,
          session.username,
          content,
        )
        .one();
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
      message: messageFromRow(inserted, session.roomSlug),
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

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(MESSAGES_SCHEMA);
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

  private sendHistory(ws: WebSocket, roomSlug: string): void {
    const rows = this.ctx.storage.sql
      .exec<SqlMessageRow>(
        `SELECT id, username, content, created_at
         FROM messages
         ORDER BY created_at DESC
         LIMIT ?`,
        HISTORY_LIMIT,
      )
      .toArray();

    const messages = rows.map((row) => messageFromRow(row, roomSlug)).reverse();

    this.send(ws, { type: "history", messages });
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
