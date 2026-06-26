import type { Context } from "hono";
import type { Env } from "../env";

type AppContext = Context<{ Bindings: Env }>;

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500;

export function jsonError(c: AppContext, status: ErrorStatus, code: string, message: string) {
  return c.json({ error: code, message }, status);
}
