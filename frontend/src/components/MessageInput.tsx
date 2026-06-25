import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

interface MessageInputProps {
  disabled: boolean;
  onSend: (content: string) => boolean;
  onTyping: (isTyping: boolean) => void;
}

const TYPING_DEBOUNCE_MS = 300;

export function MessageInput({ disabled, onSend, onTyping }: MessageInputProps) {
  const [value, setValue] = useState("");
  const typingTimerRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);

  const stopTyping = () => {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping(false);
    }
  };

  useEffect(() => () => stopTyping(), []);

  const handleChange = (next: string) => {
    setValue(next);

    if (!next.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping(true);
    }

    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = window.setTimeout(() => {
      stopTyping();
    }, TYPING_DEBOUNCE_MS);
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    const sent = onSend(trimmed);
    if (sent) {
      setValue("");
      stopTyping();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-800 bg-slate-900 p-4">
      <div className="flex gap-3">
        <textarea
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={2}
          placeholder="Écrivez un message…"
          className="min-h-[48px] flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none ring-sky-500 focus:ring-2 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="self-end rounded-xl bg-sky-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Envoyer
        </button>
      </div>
    </form>
  );
}
