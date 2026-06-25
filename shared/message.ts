export interface Message {
  id: number;
  roomSlug: string;
  username: string;
  content: string;
  createdAt: string;
}

export interface MessageRow {
  id: number;
  username: string;
  content: string;
  created_at: string;
}

export function messageFromRow(row: MessageRow, roomSlug: string): Message {
  return {
    id: row.id,
    roomSlug,
    username: row.username,
    content: row.content,
    createdAt: row.created_at,
  };
}
