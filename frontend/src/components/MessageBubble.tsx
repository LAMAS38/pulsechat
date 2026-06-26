import { memo } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck } from "lucide-react";
import type { Message } from "../types";
import { springSnappy } from "../lib/motion";
import { Avatar } from "./Avatar";
import { AppIcon } from "./ui/icon";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  animate?: boolean;
  /** Pseudos ayant vu le message (uniquement pour les messages envoyés). */
  seenBy?: string[];
}

function formatSeenLabel(seenBy: string[]): string {
  if (seenBy.length === 1) return `Vu par ${seenBy[0]}`;
  if (seenBy.length <= 3) {
    return `Vu par ${seenBy.slice(0, -1).join(", ")} et ${seenBy[seenBy.length - 1]}`;
  }
  return `Vu par ${seenBy.slice(0, 2).join(", ")} et ${seenBy.length - 2} autres`;
}

function formatTime(iso: string): string {
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showAvatar,
  animate = false,
  seenBy,
}: MessageBubbleProps) {
  const seenCount = seenBy?.length ?? 0;
  return (
    <motion.article
      className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      aria-label={`Message de ${message.username}`}
      initial={animate ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springSnappy}
      layout="position"
    >
      {!isOwn && (
        <div className="w-9 shrink-0 pt-0.5">
          {showAvatar ? (
            <motion.div
              initial={animate ? { scale: 0.8, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...springSnappy, delay: 0.04 }}
            >
              <Avatar username={message.username} size="md" />
            </motion.div>
          ) : null}
        </div>
      )}
      <div className={`flex max-w-[min(88%,16rem)] flex-col sm:max-w-[min(82%,18rem)] md:max-w-[min(75%,22rem)] lg:max-w-md ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && showAvatar && (
          <p className="mb-1 px-1 text-[11px] font-medium text-white/40">{message.username}</p>
        )}
        <motion.div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn
              ? "bubble-own rounded-br-sm text-white"
              : "rounded-bl-sm border border-white/[0.06] bg-white/[0.06] text-white"
          }`}
          whileHover={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white sm:text-[15px]">
            {message.content}
          </p>
        </motion.div>
        <div
          className={`mt-1.5 flex items-center gap-1.5 px-1 text-[11px] text-white/45 ${
            isOwn ? "flex-row-reverse" : ""
          }`}
        >
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          {isOwn &&
            (seenCount > 0 ? (
              <span
                className="inline-flex items-center gap-0.5 text-sky-400"
                title={formatSeenLabel(seenBy!)}
                aria-label={formatSeenLabel(seenBy!)}
              >
                <AppIcon icon={CheckCheck} size="sm" className="h-3.5 w-3.5" />
                <span className="tabular-nums font-medium">{seenCount}</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center text-white/35"
                title="Envoyé"
                aria-label="Envoyé"
              >
                <AppIcon icon={Check} size="sm" className="h-3.5 w-3.5" />
              </span>
            ))}
        </div>
      </div>
    </motion.article>
  );
});
