export interface RoomOwner {
  ownerUserId: string;
  ownerUsername: string;
}

interface RoomRow {
  owner_user_id: string;
  owner_username: string;
}

/** Lit le propriétaire d'un salon (null si le salon n'a pas encore de propriétaire). */
export async function getRoomOwner(db: D1Database, slug: string): Promise<RoomOwner | null> {
  const row = await db
    .prepare(`SELECT owner_user_id, owner_username FROM rooms WHERE slug = ?`)
    .bind(slug)
    .first<RoomRow>();
  return row ? { ownerUserId: row.owner_user_id, ownerUsername: row.owner_username } : null;
}

/**
 * Revendique la propriété si le salon n'a pas encore de propriétaire, puis
 * retourne le propriétaire effectif. À n'appeler que pour des membres inscrits.
 */
export async function claimRoomOwner(
  db: D1Database,
  slug: string,
  userId: string,
  username: string,
): Promise<RoomOwner> {
  await db
    .prepare(
      `INSERT INTO rooms (slug, owner_user_id, owner_username)
       VALUES (?, ?, ?)
       ON CONFLICT(slug) DO NOTHING`,
    )
    .bind(slug, userId, username)
    .run();

  const owner = await getRoomOwner(db, slug);
  // En cas de course, l'INSERT a forcément abouti pour quelqu'un.
  return owner ?? { ownerUserId: userId, ownerUsername: username };
}
