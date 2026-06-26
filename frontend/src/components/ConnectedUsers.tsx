import { motion } from "framer-motion";
import { UserList } from "./UserList";

interface ConnectedUsersProps {
  usernames: string[];
  currentUsername: string;
  ownerUsername?: string | null;
  canModerate?: boolean;
  onBan?: (username: string) => void;
}

export function ConnectedUsers({
  usernames,
  currentUsername,
  ownerUsername = null,
  canModerate = false,
  onBan,
}: ConnectedUsersProps) {
  return (
    <motion.aside
      className="hidden w-44 shrink-0 flex-col border-l border-white/[0.06] bg-white/[0.02] md:flex lg:w-60"
      aria-label="Membres en ligne"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="border-b border-white/[0.06] px-3 py-2.5 lg:px-4 lg:py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-white/40 lg:text-[11px]">
          En ligne
        </p>
        <motion.p
          className="mt-0.5 text-sm font-semibold text-white"
          key={usernames.length}
          initial={{ scale: 1.15, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          {usernames.length} membre{usernames.length !== 1 ? "s" : ""}
        </motion.p>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <UserList
          usernames={usernames}
          currentUsername={currentUsername}
          ownerUsername={ownerUsername}
          canModerate={canModerate}
          onBan={onBan}
        />
      </div>
    </motion.aside>
  );
}
