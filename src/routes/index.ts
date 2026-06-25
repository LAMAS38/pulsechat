import { Hono } from "hono";
import type { Env } from "../env";
import { roomRoutes } from "./room";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/", roomRoutes);

  app.all("*", async (c) => {
    return c.env.ASSETS.fetch(c.req.raw);
  });

  return app;
}
