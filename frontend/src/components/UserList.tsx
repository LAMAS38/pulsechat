import { motion } from "framer-motion";
import { Ban, Crown } from "lucide-react";
import { staggerItem } from "../lib/motion";
import { Avatar } from "./Avatar";
import { AppIcon } from "./ui/icon";

interface UserListProps {
  usernames: string[];
  currentUsername: string;
  compact?: boolean;
  ownerUsername?: string | null;
  /** L'utilisateur courant peut-il modérer (= propriétaire) ? */
  canModerate?: boolean;
  onBan?: (username: string) => void;
}

export function UserList({
  usernames,
  currentUsername,
  compact = false,
  ownerUsername = null,
  canModerate = false,
  onBan,
}: UserListProps) {
  const sorted = [...usernames].sort((a, b) => a.localeCompare(b, "fr"));

  if (sorted.length === 0) {
    return (
      <motion.p
        className="px-2 py-6 text-center text-xs text-white/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        En attente de visiteurs…
      </motion.p>
    );
  }

  return (
    <ul className={`space-y-1 ${compact ? "p-2" : "p-3"}`} role="list">
      {sorted.map((name, index) => {
        const isYou = name === currentUsername;
        const isRoomOwner = ownerUsername !== null && name === ownerUsername;
        const canBan = canModerate && !isYou && !isRoomOwner && onBan;
        return (
          <motion.li
            key={name}
            layout
            variants={staggerItem}
            initial="initial"
            animate="animate"
            transition={{ delay: index * 0.04 }}
            className={`group flex min-h-[44px] items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-200 ${
              isYou ? "bg-violet-500/10 ring-1 ring-violet-400/20" : "hover:bg-white/[0.03]"
            }`}
          >
            <Avatar username={name} size="sm" />
            <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-white/90">
              <span className="truncate">{name}</span>
              {isRoomOwner && (
                <AppIcon
                  icon={Crown}
                  size="sm"
                  className="shrink-0 text-amber-400"
                  aria-label="Propriétaire du salon"
                />
              )}
              {isYou && <span className="shrink-0 text-[10px] text-violet-300">(vous)</span>}
            </span>
            {canBan ? (
              <button
                type="button"
                onClick={() => onBan(name)}
                className="btn-ghost btn-icon flex h-8 w-8 shrink-0 items-center justify-center text-white/30 opacity-0 transition-opacity hover:text-rose-400 focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Bannir ${name}`}
                title={`Bannir ${name}`}
              >
                <AppIcon icon={Ban} size="sm" />
              </button>
            ) : (
              <motion.span
                className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                aria-hidden
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
