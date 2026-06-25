import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { validateSlug, validateUsername } from "@shared/slug";
import { useChatWebSocket } from "../hooks/useChatWebSocket";
import {
  clearStoredUsername,
  getStoredUsername,
  setStoredUsername,
} from "../lib/username";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { TypingIndicator } from "./TypingIndicator";
import { UserCount } from "./UserCount";
import { UsernameModal } from "./UsernameModal";

export function ChatLayout() {
  const { slug: rawSlug = "" } = useParams<{ slug: string }>();
  const slugValidation = useMemo(() => validateSlug(rawSlug), [rawSlug]);
  const slug = slugValidation.valid ? slugValidation.slug! : rawSlug;

  const [username, setUsername] = useState<string | null>(() => {
    const stored = getStoredUsername();
    if (!stored) return null;

    const validation = validateUsername(stored);
    if (!validation.valid || !validation.username) {
      clearStoredUsername();
      return null;
    }

    return validation.username;
  });
  const chatEnabled = slugValidation.valid && username !== null;

  const { messages, userCount, typingUsers, connectionStatus, error, sendMessage, setTyping } =
    useChatWebSocket({
      slug,
      username,
      enabled: chatEnabled,
    });

  const handleUsernameSubmit = (nextUsername: string) => {
    setStoredUsername(nextUsername);
    setUsername(nextUsername);
  };

  if (!slugValidation.valid) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="rounded-2xl border border-red-500/30 bg-slate-900 p-8 text-center">
          <h1 className="text-xl font-semibold text-red-300">Salon invalide</h1>
          <p className="mt-2 text-slate-400">
            Le slug doit contenir 3 à 32 caractères (lettres, chiffres, tirets).
          </p>
          <a href="/" className="mt-6 inline-block text-sky-400 hover:underline">
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      {!username && <UsernameModal onSubmit={handleUsernameSubmit} />}

      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Salon</p>
          <h1 className="text-lg font-semibold text-white">#{slug}</h1>
        </div>
        <UserCount count={userCount} status={connectionStatus} />
      </header>

      {error && (
        <div className="bg-red-500/10 px-4 py-2 text-center text-sm text-red-300">{error}</div>
      )}

      <MessageList messages={messages} currentUsername={username ?? ""} />

      <div className="border-t border-slate-800 bg-slate-900 px-4 pt-2">
        <TypingIndicator usernames={typingUsers} currentUsername={username ?? ""} />
      </div>

      <MessageInput
        disabled={!chatEnabled || connectionStatus !== "connected"}
        onSend={sendMessage}
        onTyping={setTyping}
      />
    </div>
  );
}
