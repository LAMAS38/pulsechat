import type { Context, Hono } from "hono";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateUsername,
  type PublicUser,
} from "../../shared/auth";
import type { Env } from "../env";
import { jsonError } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionToken,
  isSecureRequest,
  readSessionCookie,
  resolveSessionSecret,
  verifySessionToken,
} from "../lib/session";
import { createUser, findUserByEmail, findUserById, toPublicUser } from "../lib/users";

async function setSession(
  c: Context<{ Bindings: Env }>,
  user: Pick<PublicUser, "id" | "username" | "guest">,
): Promise<void> {
  const secret = resolveSessionSecret(c.env.SESSION_SECRET);
  const { token, maxAge } = await createSessionToken(user, secret);
  c.header("Set-Cookie", buildSessionCookie(token, maxAge, isSecureRequest(c.req.raw)));
}

export function registerAuthRoutes(app: Hono<{ Bindings: Env }>) {
  app.post("/auth/register", async (c) => {
    let body: { email?: unknown; username?: unknown; password?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return jsonError(c, 400, "invalid_body", "Corps de requête invalide");
    }

    const email = validateEmail(String(body.email ?? ""));
    if (!email.valid || !email.email) {
      return jsonError(c, 400, "invalid_email", "Adresse e-mail invalide");
    }
    const username = validateUsername(String(body.username ?? ""));
    if (!username.valid || !username.username) {
      return jsonError(c, 400, "invalid_username", "Pseudo invalide (2 à 24 caractères)");
    }
    const password = validatePassword(String(body.password ?? ""));
    if (!password.valid) {
      return jsonError(c, 400, "invalid_password", "Mot de passe : 8 caractères minimum");
    }

    const passwordHash = await hashPassword(String(body.password));
    const result = await createUser(c.env.DB, {
      email: email.email,
      username: username.username,
      passwordHash,
    });

    if (!result.ok) {
      if (result.conflict === "email") {
        return jsonError(c, 409, "email_taken", "Cette adresse e-mail est déjà utilisée");
      }
      if (result.conflict === "username") {
        return jsonError(c, 409, "username_taken", "Ce pseudo est déjà pris");
      }
      return jsonError(c, 500, "register_failed", "Inscription impossible, réessayez");
    }

    const user = toPublicUser(result.user);
    await setSession(c, user);
    return c.json({ user });
  });

  app.post("/auth/login", async (c) => {
    let body: { email?: unknown; password?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return jsonError(c, 400, "invalid_body", "Corps de requête invalide");
    }

    const emailRaw = String(body.email ?? "");
    const passwordRaw = String(body.password ?? "");
    if (!emailRaw || !passwordRaw) {
      return jsonError(c, 400, "invalid_credentials", "E-mail ou mot de passe incorrect");
    }

    const record = await findUserByEmail(c.env.DB, normalizeEmail(emailRaw));
    // On hache toujours pour éviter de révéler l'existence d'un compte via le timing.
    const ok = record
      ? await verifyPassword(passwordRaw, record.passwordHash)
      : await verifyPassword(passwordRaw, "pbkdf2$100000$AAAA$AAAA");

    if (!record || !ok) {
      return jsonError(c, 401, "invalid_credentials", "E-mail ou mot de passe incorrect");
    }

    const user = toPublicUser(record);
    await setSession(c, user);
    return c.json({ user });
  });

  app.post("/auth/guest", async (c) => {
    let body: { username?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return jsonError(c, 400, "invalid_body", "Corps de requête invalide");
    }

    const username = validateUsername(String(body.username ?? ""));
    if (!username.valid || !username.username) {
      return jsonError(c, 400, "invalid_username", "Pseudo invalide (2 à 24 caractères)");
    }

    const user: PublicUser = {
      id: `guest_${crypto.randomUUID()}`,
      username: username.username,
      guest: true,
    };
    await setSession(c, user);
    return c.json({ user });
  });

  app.post("/auth/logout", (c) => {
    c.header("Set-Cookie", clearSessionCookie(isSecureRequest(c.req.raw)));
    return c.json({ ok: true });
  });

  app.get("/auth/me", async (c) => {
    const token = readSessionCookie(c.req.raw);
    if (!token) return c.json({ user: null });

    const payload = await verifySessionToken(token, resolveSessionSecret(c.env.SESSION_SECRET));
    if (!payload) return c.json({ user: null });

    if (payload.guest) {
      const user: PublicUser = { id: payload.sub, username: payload.username, guest: true };
      return c.json({ user });
    }

    // Membre : on rafraîchit depuis la base (le compte a pu être supprimé).
    const record = await findUserById(c.env.DB, payload.sub);
    if (!record) {
      c.header("Set-Cookie", clearSessionCookie(isSecureRequest(c.req.raw)));
      return c.json({ user: null });
    }
    return c.json({ user: toPublicUser(record) });
  });
}
