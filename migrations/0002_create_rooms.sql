-- Propriété des salons. Le premier membre INSCRIT (non-invité) à rejoindre un
-- salon en devient propriétaire. Les invités ne peuvent pas posséder de salon.

CREATE TABLE IF NOT EXISTS rooms (
  slug           TEXT PRIMARY KEY,
  owner_user_id  TEXT NOT NULL,
  owner_username TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
