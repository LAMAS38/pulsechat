import type { Hono } from "hono";
import { validateSlug } from "../../shared/slug";
import type { Env } from "../env";
import { jsonError } from "../lib/errors";
import { claimRoomOwner, getRoomOwner } from "../lib/rooms";
import {
  readSessionCookie,
  resolveSessionSecret,
  verifySessionToken,
} from "../lib/session";

export function registerRoomRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/r/:slug/ws", async (c) => {
  const validation = validateSlug(c.req.param("slug"));
  if (!validation.valid || !validation.slug) {
    return jsonError(c, 400, validation.error ?? "invalid_slug", "Invalid room slug");
  }

  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader?.toLowerCase() !== "websocket") {
    return jsonError(c, 400, "websocket_required", "Expected WebSocket upgrade");
  }

  // L'identité est dérivée du cookie de session signé (envoyé automatiquement
  // sur le handshake WS, même origine). Le client ne fournit JAMAIS son pseudo.
  const token = readSessionCookie(c.req.raw);
  const session = token
    ? await verifySessionToken(token, resolveSessionSecret(c.env.SESSION_SECRET))
    : null;
  if (!session) {
    return jsonError(c, 401, "auth_required", "Authentification requise");
  }

  // Propriété du salon : un membre inscrit revendique la propriété au 1er join ;
  // un invité ne peut que la consulter (jamais devenir propriétaire).
  const owner = session.guest
    ? await getRoomOwner(c.env.DB, validation.slug)
    : await claimRoomOwner(c.env.DB, validation.slug, session.sub, session.username);
  const isOwner = !session.guest && owner?.ownerUserId === session.sub;

  const id = c.env.CHAT_ROOM.idFromName(validation.slug);
  const stub = c.env.CHAT_ROOM.get(id);

  const headers = new Headers(c.req.raw.headers);
  headers.set("X-Room-Slug", validation.slug);
  // set() écrase toute valeur fournie par le client : identité non usurpable.
  headers.set("X-User-Id", session.sub);
  headers.set("X-Username", encodeURIComponent(session.username));
  headers.set("X-User-Guest", session.guest ? "1" : "0");
  headers.set("X-Is-Owner", isOwner ? "1" : "0");
  headers.set("X-Owner-Username", encodeURIComponent(owner?.ownerUsername ?? ""));

  return stub.fetch(new Request(c.req.raw, { headers }));
  });
}
