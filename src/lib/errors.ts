import type { Context } from "hono";
import type { Env } from "../env";

type AppContext = Context<{ Bindings: Env }>;

export function jsonError(c: AppContext, status: 400 | 404 | 500, code: string, message: string) {
  return c.json({ error: code, message }, status);
}
