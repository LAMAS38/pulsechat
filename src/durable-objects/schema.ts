const MESSAGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_created
  ON messages (created_at DESC);

CREATE TABLE IF NOT EXISTS message_reads (
  username TEXT PRIMARY KEY,
  last_read_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bans (
  user_id  TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  banned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function initMessageSchema(sql: DurableObjectStorage["sql"]): void {
  sql.exec(MESSAGE_SCHEMA);
}
