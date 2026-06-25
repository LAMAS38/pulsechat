import { useEffect, useRef } from "react";
import type { Message } from "../types";

interface MessageListProps {
  messages: Message[];
  currentUsername: string;
}

function formatTime(iso: string): string {
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function MessageList({ messages, currentUsername }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500">
        Aucun message pour l'instant. Lancez la conversation !
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((message) => {
        const isOwn = message.username === currentUsername;
        return (
          <article
            key={message.id}
            className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                isOwn
                  ? "rounded-br-md bg-sky-600 text-white"
                  : "rounded-bl-md bg-slate-800 text-slate-100"
              }`}
            >
              {!isOwn && (
                <p className="mb-1 text-xs font-medium text-sky-300">{message.username}</p>
              )}
              <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
              <p className={`mt-1 text-[10px] ${isOwn ? "text-sky-100/70" : "text-slate-400"}`}>
                {formatTime(message.createdAt)}
              </p>
            </div>
          </article>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
