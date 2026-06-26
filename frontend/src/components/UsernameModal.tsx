import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { validateUsername } from "@shared/slug";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useOverlayScrollLock } from "../hooks/useOverlayScrollLock";
import { useVisualViewportOverlay } from "../hooks/useVisualViewportOverlay";
import type { RoomTheme } from "../lib/roomTheme";
import { roomThemeStyle } from "../lib/roomTheme";
import { backdropVariants, scaleIn, springSnappy } from "../lib/motion";
import { Avatar } from "./Avatar";
import { AppIcon } from "./ui/icon";

interface UsernameModalProps {
  slug: string;
  theme: RoomTheme;
  onSubmit: (username: string) => void;
}

export function UsernameModal({ slug, theme, onSubmit }: UsernameModalProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { panelStyle, scrollAnchorIntoView } = useVisualViewportOverlay(
    isMobile,
    formAnchorRef,
    scrollRef,
  );

  useOverlayScrollLock(true, "username-modal-open");

  useEffect(() => {
    if (isMobile) return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isMobile]);

  const preview = value.trim() || "Vous";
  const validation = validateUsername(value);
  const canPreview = validation.valid && validation.username;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validation.valid || !validation.username) {
      setError("2–24 caractères : lettres, chiffres, espaces, - ou _");
      return;
    }
    onSubmit(validation.username);
  };

  const handleInputFocus = () => {
    if (!isMobile) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollAnchorIntoView);
    });
    window.setTimeout(scrollAnchorIntoView, 320);
  };

  const header = (
    <>
      <div className="flex items-start justify-between gap-3">
        <motion.p
          className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50 sm:text-[11px] sm:tracking-widest"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <span className="text-base sm:text-sm" aria-hidden>
            {theme.emoji}
          </span>
          <span className="truncate">Rejoindre #{slug}</span>
        </motion.p>
        <Link
          to="/"
          className="btn-ghost -mr-1 flex min-h-[44px] shrink-0 items-center gap-1.5 px-2 py-1.5 text-sm text-white/60 sm:min-h-0 sm:text-xs sm:text-white/55"
        >
          <AppIcon icon={ArrowLeft} size="sm" aria-hidden />
          Autre salon
        </Link>
      </div>

      <motion.h2
        id="username-modal-title"
        className="mt-3 font-display text-[1.375rem] font-bold leading-snug text-white sm:mt-2 sm:text-2xl md:text-[1.75rem]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        Comment vous appelle-t-on ?
      </motion.h2>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-white/45 sm:text-sm md:text-base">
        Votre pseudo est visible par les autres membres du salon.
      </p>
    </>
  );

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username-input" className="sr-only">
          Pseudo
        </label>
        <input
          ref={inputRef}
          id="username-input"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onFocus={handleInputFocus}
          placeholder="Ex. Latifa, DevQueen…"
          autoComplete="nickname"
          enterKeyHint="go"
          maxLength={24}
          className="input-field w-full"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      {error && (
        <motion.p
          className="text-sm text-rose-400 sm:text-xs"
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          {error}
        </motion.p>
      )}
      <motion.button
        type="submit"
        className="btn-primary flex min-h-[48px] w-full items-center justify-center gap-2 py-3.5 text-base font-semibold sm:py-3 sm:text-sm"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
      >
        Entrer dans le salon
        <span aria-hidden>{theme.emoji}</span>
        <AppIcon icon={ArrowRight} size="sm" className="opacity-80" aria-hidden />
      </motion.button>
    </form>
  );

  const previewCard = (
    <motion.div
      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
      layout
      transition={springSnappy}
    >
      <motion.div
        key={canPreview ? validation.username : preview}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springSnappy}
      >
        <Avatar username={canPreview ? validation.username! : preview} size="lg" ring />
      </motion.div>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-white sm:text-[0.9375rem]">
          {canPreview ? validation.username : preview}
        </p>
        <p className="text-xs text-white/35 sm:text-[11px]">Aperçu de votre profil</p>
      </div>
    </motion.div>
  );

  const modal = (
    <>
      {isMobile && (
        <motion.div
          className="username-modal-backdrop fixed inset-0 z-[60] bg-[#08080c]"
          aria-hidden
          variants={backdropVariants}
          initial="initial"
          animate="animate"
          exit="initial"
        />
      )}

      <motion.div
        className={`username-modal-overlay room-themed z-[61] flex sm:fixed sm:inset-0 sm:items-center sm:justify-center sm:bg-[#08080c]/90 sm:backdrop-blur-md sm:p-4 ${isMobile ? "bg-transparent" : ""}`}
        style={{ ...roomThemeStyle(theme), ...(isMobile ? panelStyle : undefined) }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-modal-title"
        variants={isMobile ? undefined : backdropVariants}
        initial={isMobile ? undefined : "initial"}
        animate={isMobile ? undefined : "animate"}
        exit={isMobile ? undefined : "initial"}
      >
      <div
        ref={scrollRef}
        className="username-modal-scroll h-full w-full overflow-y-auto overscroll-contain sm:h-auto sm:overflow-visible"
      >
        <motion.div
          className="username-modal-sheet hero-card hero-card-glow safe-bottom mx-auto w-full max-w-md p-5 sm:rounded-2xl sm:p-6 md:p-8"
          variants={scaleIn}
          initial="initial"
          animate="animate"
          exit="exit"
          drag={isMobile ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.35 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100) {
              /* swipe dismiss disabled — username required */
            }
          }}
        >
          {isMobile ? (
            <div className="flex min-h-full flex-col gap-5 pt-2">
              {header}
              <div ref={formAnchorRef} className="username-modal-form-anchor">
                {form}
              </div>
              {previewCard}
            </div>
          ) : (
            <>
              {header}
              <div className="mt-6">{previewCard}</div>
              <div ref={formAnchorRef} className="username-modal-form-anchor mt-6">
                {form}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
    </>
  );

  return createPortal(modal, document.body);
}
