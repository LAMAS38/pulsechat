-- Comptes utilisateurs (membres inscrits). Les invités ne sont PAS stockés ici :
-- leur identité vit uniquement dans le cookie de session signé.

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  email_lower    TEXT NOT NULL,
  username       TEXT NOT NULL,
  username_lower TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON users (email_lower);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower
  ON users (username_lower);
