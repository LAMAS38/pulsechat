interface TypingIndicatorProps {
  usernames: string[];
  currentUsername: string;
}

function formatTyping(usernames: string[]): string {
  const others = usernames.filter((name) => name.length > 0);
  if (others.length === 0) return "";
  if (others.length === 1) return `${others[0]} est en train d'écrire…`;
  if (others.length === 2) return `${others[0]} et ${others[1]} écrivent…`;
  return `${others[0]} et ${others.length - 1} autres écrivent…`;
}

export function TypingIndicator({ usernames, currentUsername }: TypingIndicatorProps) {
  const label = formatTyping(usernames.filter((name) => name !== currentUsername));
  if (!label) return <div className="h-5" />;

  return (
    <p className="h-5 truncate text-sm italic text-slate-400" aria-live="polite">
      {label}
    </p>
  );
}
