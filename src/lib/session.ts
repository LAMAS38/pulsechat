import type { PublicUser } from "../../shared/auth";

/**
 * Sessions stateless via cookie signé HMAC-SHA256 (type JWT maison, sans dépendance).
 * Format du token : base64url(payloadJSON).base64url(signature)
 *
 * Le pseudo affiché dérive TOUJOURS de ce token côté serveur : le client ne peut
 * plus usurper une identité en passant un ?username= arbitraire.
 */

export const SESSION_COOKIE = "pc_session";

const MEMBER_TTL_SEC = 30 * 24 * 60 * 60; // 30 jours
const GUEST_TTL_SEC = 7 * 24 * 60 * 60; // 7 jours

interface SessionPayload {
  sub: string;
  username: string;
  guest: boolean;
  iat: number;
  exp: number;
}

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(
  user: Pick<PublicUser, "id" | "username" | "guest">,
  secret: string,
): Promise<{ token: string; maxAge: number }> {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = user.guest ? GUEST_TTL_SEC : MEMBER_TTL_SEC;
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    guest: user.guest,
    iat: now,
    exp: now + maxAge,
  };

  const body = encode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return { token: `${body}.${encode(new Uint8Array(sig))}`, maxAge };
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const key = await hmacKey(secret);
  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decode(signature),
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(decode(body))) as SessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.sub !== "string" ||
    typeof payload.username !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

export function buildSessionCookie(token: string, maxAge: number, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const attrs = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

const DEV_FALLBACK_SECRET = "pulsechat-dev-insecure-secret-do-not-use-in-prod";

/** Retourne le secret HMAC, avec un repli DEV bruyant si non configuré. */
export function resolveSessionSecret(secret: string | undefined): string {
  if (secret && secret.length > 0) return secret;
  console.warn(
    "[auth] SESSION_SECRET absent — repli DEV non sécurisé. Configurez .dev.vars (dev) ou `wrangler secret put SESSION_SECRET` (prod).",
  );
  return DEV_FALLBACK_SECRET;
}
