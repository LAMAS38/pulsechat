import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { resetViewportAfterOverlay } from "../lib/viewport";
import { backdropVariants, slideUp, springSnappy } from "../lib/motion";
import { UserList } from "./UserList";
import { AppIcon } from "./ui/icon";

interface MembersSheetProps {
  open: boolean;
  onClose: () => void;
  usernames: string[];
  currentUsername: string;
  ownerUsername?: string | null;
  canModerate?: boolean;
  onBan?: (username: string) => void;
}

export function MembersSheet({
  open,
  onClose,
  usernames,
  currentUsername,
  ownerUsername = null,
  canModerate = false,
  onBan,
}: MembersSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(open);

  const handleClose = useCallback(() => {
    onClose();
    resetViewportAfterOverlay();
  }, [onClose]);

  useEffect(() => {
    if (open) return;
    resetViewportAfterOverlay();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) return;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Membres en ligne"
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-[#08080c]/70 backdrop-blur-sm"
            aria-label="Fermer"
            onClick={handleClose}
            variants={backdropVariants}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 max-h-[min(70dvh,calc(var(--app-height,100dvh)*0.7))] rounded-t-2xl border border-white/[0.08] bg-[#0e0e14] shadow-2xl"
            variants={slideUp}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80) handleClose();
            }}
          >
            <div className="flex justify-center py-3">
              <span className="h-1 w-10 rounded-full bg-white/15" aria-hidden />
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 pb-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">En ligne</p>
                <motion.p
                  className="text-base font-semibold text-white"
                  key={usernames.length}
                  initial={{ scale: 1.2, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={springSnappy}
                >
                  {usernames.length} membre{usernames.length !== 1 ? "s" : ""}
                </motion.p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleClose}
                className="btn-ghost btn-icon min-h-[44px] min-w-[44px]"
                aria-label="Fermer la liste"
              >
                <AppIcon icon={X} size="md" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              <UserList
                usernames={usernames}
                currentUsername={currentUsername}
                ownerUsername={ownerUsername}
                canModerate={canModerate}
                onBan={onBan}
                compact
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
