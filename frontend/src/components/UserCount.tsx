interface UserCountProps {
  count: number;
  status: "connecting" | "connected" | "disconnected" | "reconnecting";
}

const statusLabels = {
  connecting: "Connexion…",
  connected: "Connecté",
  disconnected: "Déconnecté",
  reconnecting: "Reconnexion…",
} as const;

export function UserCount({ count, status }: UserCountProps) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
        {count} connecté{count !== 1 ? "s" : ""}
      </span>
      <span
        className={`rounded-full px-3 py-1 ${
          status === "connected"
            ? "bg-emerald-500/20 text-emerald-300"
            : "bg-amber-500/20 text-amber-300"
        }`}
      >
        {statusLabels[status]}
      </span>
    </div>
  );
}
