export interface Message {
  id: number;
  roomSlug: string;
  username: string;
  content: string;
  createdAt: string;
}

/** Dernier message lu par un utilisateur (accusés de lecture). */
export interface ReadReceipt {
  username: string;
  lastReadId: number;
}

export interface MessageRow {
  id: number;
  room_slug: string;
  username: string;
  content: string;
  created_at: string;
}

/** @deprecated Préférez les helpers dans src/durable-objects/messages.ts */
export function messageFromRow(row: MessageRow, roomSlug?: string): Message {
  return {
    id: row.id,
    roomSlug: row.room_slug ?? roomSlug ?? "",
    username: row.username,
    content: row.content,
    createdAt: row.created_at,
  };
}
