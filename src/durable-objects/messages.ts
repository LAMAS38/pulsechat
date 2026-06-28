import type { Message, ReadReceipt } from "../../shared/message";

interface MessageRow {
  id: number;
  username: string;
  content: string;
  created_at: string;
}

interface ReadRow {
  username: string;
  last_read_id: number;
}

function messageFromRow(row: MessageRow, roomSlug: string): Message {
  return {
    id: row.id,
    roomSlug,
    username: row.username,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function fetchMessageHistory(
  sql: DurableObjectStorage["sql"],
  roomSlug: string,
  limit: number,
): Message[] {
  const cursor = sql.exec(
    `SELECT id, username, content, created_at
     FROM messages
     -- Tri par id (clé primaire monotone) et NON par created_at : datetime('now')
     -- a une précision à la seconde, insuffisante pour départager des messages
     -- envoyés dans la même seconde. id garantit l'ordre d'insertion réel.
     ORDER BY id DESC
     LIMIT ?`,
    limit,
  );

  return [...cursor]
    .map((row) => messageFromRow(row as unknown as MessageRow, roomSlug))
    .reverse();
}

export function insertMessage(
  sql: DurableObjectStorage["sql"],
  roomSlug: string,
  username: string,
  content: string,
): Message {
  const row = sql
    .exec(
      `INSERT INTO messages (username, content)
       VALUES (?, ?)
       RETURNING id, username, content, created_at`,
      username,
      content,
    )
    .one() as unknown as MessageRow;

  return messageFromRow(row, roomSlug);
}

export function fetchReadReceipts(sql: DurableObjectStorage["sql"]): ReadReceipt[] {
  const cursor = sql.exec(`SELECT username, last_read_id FROM message_reads`);
  return [...cursor].map((row) => {
    const r = row as unknown as ReadRow;
    return { username: r.username, lastReadId: r.last_read_id };
  });
}

/** Vide entièrement le salon (messages + accusés de lecture). Action propriétaire. */
export function clearRoomMessages(sql: DurableObjectStorage["sql"]): void {
  sql.exec(`DELETE FROM messages`);
  sql.exec(`DELETE FROM message_reads`);
}

/** Vrai si l'utilisateur (par id) est banni du salon. */
export function isBanned(sql: DurableObjectStorage["sql"], userId: string): boolean {
  const row = [...sql.exec(`SELECT 1 AS hit FROM bans WHERE user_id = ?`, userId)][0];
  return row !== undefined;
}

/** Enregistre un bannissement (idempotent). */
export function addBan(
  sql: DurableObjectStorage["sql"],
  userId: string,
  username: string,
): void {
  sql.exec(
    `INSERT INTO bans (user_id, username)
     VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET username = excluded.username`,
    userId,
    username,
  );
}

/**
 * Enregistre le dernier message lu par un utilisateur. La valeur ne peut que
 * progresser : un accusé plus ancien est ignoré. Retourne la valeur retenue et
 * indique si elle a changé (pour ne diffuser que les vraies mises à jour).
 */
export function recordReadReceipt(
  sql: DurableObjectStorage["sql"],
  username: string,
  lastReadId: number,
): { lastReadId: number; changed: boolean } {
  const existing = [
    ...sql.exec(`SELECT last_read_id FROM message_reads WHERE username = ?`, username),
  ][0] as unknown as { last_read_id: number } | undefined;
  const previous = existing ? existing.last_read_id : 0;

  if (lastReadId <= previous) {
    return { lastReadId: previous, changed: false };
  }

  sql.exec(
    `INSERT INTO message_reads (username, last_read_id)
     VALUES (?, ?)
     ON CONFLICT(username) DO UPDATE SET last_read_id = excluded.last_read_id`,
    username,
    lastReadId,
  );

  return { lastReadId, changed: true };
}
