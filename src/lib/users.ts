import type { PublicUser } from "../../shared/auth";
import { normalizeEmail } from "../../shared/auth";

interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface UserRecord extends PublicUser {
  passwordHash: string;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    guest: false,
    createdAt: row.created_at,
    passwordHash: row.password_hash,
  };
}

export function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    username: record.username,
    email: record.email,
    guest: false,
    createdAt: record.createdAt,
  };
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRecord | null> {
  const row = await db
    .prepare(
      `SELECT id, email, username, password_hash, created_at
       FROM users WHERE email_lower = ?`,
    )
    .bind(normalizeEmail(email))
    .first<UserRow>();
  return row ? toRecord(row) : null;
}

export async function findUserById(db: D1Database, id: string): Promise<UserRecord | null> {
  const row = await db
    .prepare(
      `SELECT id, email, username, password_hash, created_at
       FROM users WHERE id = ?`,
    )
    .bind(id)
    .first<UserRow>();
  return row ? toRecord(row) : null;
}

export interface CreateUserInput {
  email: string;
  username: string;
  passwordHash: string;
}

export type CreateUserResult =
  | { ok: true; user: UserRecord }
  | { ok: false; conflict: "email" | "username" | "unknown" };

export async function createUser(
  db: D1Database,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  const id = crypto.randomUUID();
  const emailLower = normalizeEmail(input.email);
  const usernameLower = input.username.toLowerCase();

  try {
    const row = await db
      .prepare(
        `INSERT INTO users (id, email, email_lower, username, username_lower, password_hash)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id, email, username, password_hash, created_at`,
      )
      .bind(id, input.email, emailLower, input.username, usernameLower, input.passwordHash)
      .first<UserRow>();
    if (!row) return { ok: false, conflict: "unknown" };
    return { ok: true, user: toRecord(row) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // SQLite/D1 rapporte la colonne : "UNIQUE constraint failed: users.username_lower".
    if (/email_lower/.test(message)) return { ok: false, conflict: "email" };
    if (/username_lower/.test(message)) return { ok: false, conflict: "username" };
    if (/UNIQUE/i.test(message)) return { ok: false, conflict: "unknown" };
    throw err;
  }
}
