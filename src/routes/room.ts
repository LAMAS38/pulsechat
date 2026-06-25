import { Hono } from "hono";
import { validateSlug } from "../../shared/slug";
import type { Env } from "../env";
import { jsonError } from "../lib/errors";

export const roomRoutes = new Hono<{ Bindings: Env }>();

roomRoutes.get("/r/:slug/ws", async (c) => {
  const validation = validateSlug(c.req.param("slug"));
  if (!validation.valid || !validation.slug) {
    return jsonError(c, 400, validation.error ?? "invalid_slug", "Invalid room slug");
  }

  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader?.toLowerCase() !== "websocket") {
    return jsonError(c, 400, "websocket_required", "Expected WebSocket upgrade");
  }

  const id = c.env.CHAT_ROOM.idFromName(validation.slug);
  const stub = c.env.CHAT_ROOM.get(id);

  const headers = new Headers(c.req.raw.headers);
  headers.set("X-Room-Slug", validation.slug);

  return stub.fetch(new Request(c.req.raw, { headers }));
});
