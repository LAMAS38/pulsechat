import type { Message } from "./message";

export type ClientEvent =
  | { type: "message"; content: string }
  | { type: "typing"; isTyping: boolean };

export type ServerEvent =
  | { type: "history"; messages: Message[] }
  | { type: "message"; message: Message }
  | { type: "join"; username: string; userCount: number }
  | { type: "leave"; username: string; userCount: number }
  | { type: "typing"; username: string; isTyping: boolean }
  | { type: "users"; count: number; usernames: string[] }
  | { type: "error"; code: string; message: string };

export function parseClientEvent(raw: string): ClientEvent | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || !("type" in data)) {
      return null;
    }

    const event = data as ClientEvent;

    if (event.type === "message") {
      if (typeof event.content !== "string") return null;
      return event;
    }

    if (event.type === "typing") {
      if (typeof event.isTyping !== "boolean") return null;
      return event;
    }

    return null;
  } catch {
    return null;
  }
}

export function parseServerEvent(raw: string): ServerEvent | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || !("type" in data)) {
      return null;
    }
    return data as ServerEvent;
  } catch {
    return null;
  }
}

export function serializeEvent(event: ClientEvent | ServerEvent): string {
  return JSON.stringify(event);
}
