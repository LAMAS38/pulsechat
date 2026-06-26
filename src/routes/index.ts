import { Hono } from "hono";
import type { Env } from "../env";
import { registerAuthRoutes } from "./auth";
import { registerRoomRoutes } from "./room";

function isStaticAssetPath(pathname: string): boolean {
  return /\.[a-zA-Z0-9]+$/.test(pathname) && !pathname.endsWith(".html");
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (c) => c.json({ status: "ok" }));

  registerAuthRoutes(app);
  registerRoomRoutes(app);

  app.all("*", async (c) => {
    const url = new URL(c.req.url);

    if (isStaticAssetPath(url.pathname)) {
      const asset = await c.env.ASSETS.fetch(c.req.raw);
      const type = asset.headers.get("content-type") ?? "";
      if (!type.includes("text/html")) {
        return asset;
      }
      return c.text("Asset not found — relancez npm run dev", 404);
    }

    const indexRequest = new Request(new URL("/index.html", url.origin), {
      method: "GET",
    });
    return c.env.ASSETS.fetch(indexRequest);
  });

  return app;
}
