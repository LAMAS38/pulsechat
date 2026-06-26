export interface Env {
  CHAT_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  DB: D1Database;
  /** Secret HMAC pour signer les cookies de session. En dev: .dev.vars ; en prod: `wrangler secret put SESSION_SECRET`. */
  SESSION_SECRET?: string;
}
