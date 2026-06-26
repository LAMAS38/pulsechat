import { Check, Eraser, Keyboard, Send, Smile } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  clampGraphemes,
  countGraphemes,
  MESSAGE_MAX_GRAPHEMES,
} from "@shared/textLength";
import {
  insertAtSelection,
  readTextareaSelection,
  resizeComposeTextarea,
  type TextSelection,
} from "../lib/composeUtils";
import { clearDraft, getDraftRecord, setDraft } from "../lib/drafts";
import { useComposeDraft } from "../hooks/useComposeDraft";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { resetViewportAfterOverlay } from "../lib/viewport";
import { AppIcon } from "./ui/icon";
import { ComposeEmojiPanel } from "./ComposeEmojiPanel";

interface MessageInputProps {
  slug: string;
  disabled: boolean;
  onSend: (content: string) => boolean;
  onTyping: (isTyping: boolean) => void;
}

const TYPING_DEBOUNCE_MS = 300;
const MAX_LENGTH = MESSAGE_MAX_GRAPHEMES;
const COMPOSE_HEIGHT = 48;
const MAX_TEXTAREA_HEIGHT = 160;
const SHOW_COUNTER_FROM = 1;
const MOBILE_MEDIA = "(max-width: 767px)";

export function MessageInput({ slug, disabled, onSend, onTyping }: MessageInputProps) {
  const isMobile = useMediaQuery(MOBILE_MEDIA);
  const initialRecordRef = useRef(getDraftRecord(slug));
  const [value, setValue] = useState(() => initialRecordRef.current.content);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composeRef = useRef<HTMLFormElement>(null);
  const emojiTriggerRef = useRef<HTMLButtonElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<TextSelection>(initialRecordRef.current.selection);
  const pendingSelectionRef = useRef<TextSelection | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  const slugRef = useRef(slug);
  const valueRef = useRef(value);
  const composeAreaRef = useRef<HTMLDivElement>(null);
  const emojiOpenRef = useRef(emojiOpen);
  valueRef.current = value;
  emojiOpenRef.current = emojiOpen;

  const {
    loadDraft,
    persistDraft,
    discardDraft,
    flushDraft,
    saveState,
    showRestored,
    resetUi,
  } = useComposeDraft(slug);

  const syncSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    selectionRef.current = readTextareaSelection(el);
  }, []);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping(false);
    }
  }, [onTyping]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    resizeComposeTextarea(el, COMPOSE_HEIGHT, MAX_TEXTAREA_HEIGHT);
  }, []);

  const notifyTyping = useCallback(
    (next: string) => {
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
      typingTimerRef.current = window.setTimeout(stopTyping, TYPING_DEBOUNCE_MS);
    },
    [onTyping, stopTyping],
  );

  const restoreTextareaSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = selectionRef.current;
    el.focus({ preventScroll: true });
    el.setSelectionRange(start, end);
  }, []);

  const patchValue = useCallback(
    (next: string, selection?: TextSelection) => {
      const clamped = clampGraphemes(next, MAX_LENGTH);
      const sel = selection ?? selectionRef.current;
      setValue(clamped);
      notifyTyping(clamped);
      persistDraft(clamped, sel);
      selectionRef.current = sel;
      if (selection) {
        pendingSelectionRef.current = sel;
      }
    },
    [notifyTyping, persistDraft],
  );

  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    pendingSelectionRef.current = null;

    const el = textareaRef.current;
    if (!el) return;

    selectionRef.current = pending;
    el.setSelectionRange(pending.start, pending.end);
    resizeComposeTextarea(el, COMPOSE_HEIGHT, MAX_TEXTAREA_HEIGHT);

    // Mobile + panneau emoji : insérer sans rouvrir le clavier
    if (isMobile && emojiOpenRef.current) return;

    el.focus({ preventScroll: true });
  }, [value, isMobile]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const { start, end } = selectionRef.current;
    el.setSelectionRange(start, end);
  }, [disabled]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  useEffect(() => {
    if (slugRef.current === slug) return;

    const previousSlug = slugRef.current;
    slugRef.current = slug;

    const leaving = valueRef.current;
    if (leaving.trim()) setDraft(previousSlug, leaving, selectionRef.current);
    else clearDraft(previousSlug);

    const { content: draft, selection } = loadDraft();
    setValue(draft);
    selectionRef.current = selection;
    pendingSelectionRef.current = selection;
    setEmojiOpen(false);
    resetUi();
  }, [slug, loadDraft, resetUi]);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  useEffect(() => {
    if (disabled) return;
    const id = window.requestAnimationFrame(restoreTextareaSelection);
    return () => window.cancelAnimationFrame(id);
  }, [disabled, slug, restoreTextareaSelection]);

  useEffect(() => {
    return () => {
      flushDraft(valueRef.current, selectionRef.current);
    };
  }, [flushDraft]);

  useEffect(() => {
    if (!isMobile || !emojiOpen) return;
    textareaRef.current?.blur();
    setFocused(false);
  }, [isMobile, emojiOpen]);

  useEffect(() => {
    if (!emojiOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (emojiPanelRef.current?.contains(target)) return;
      if (emojiTriggerRef.current?.contains(target)) return;
      if (isMobile) {
        setEmojiOpen(false);
        return;
      }
      if (composeRef.current?.contains(target)) return;
      setEmojiOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [emojiOpen, isMobile]);

  const closeEmojiPicker = useCallback(
    (options?: { focusInput?: boolean }) => {
      const focusInput = options?.focusInput ?? !isMobile;
      setEmojiOpen(false);
      if (!isMobile) {
        resetViewportAfterOverlay();
      }

      if (!focusInput || disabled) return;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          restoreTextareaSelection();
          setFocused(true);
        });
      });
    },
    [disabled, isMobile, restoreTextareaSelection],
  );

  const openEmojiPicker = useCallback(() => {
    syncSelection();
    const el = textareaRef.current;
    if (el) {
      el.blur();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    setFocused(false);
    stopTyping();
    setEmojiOpen(true);
  }, [syncSelection, stopTyping]);

  const handleEmojiTriggerClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (emojiOpen) {
      closeEmojiPicker({ focusInput: true });
    } else {
      openEmojiPicker();
    }
  };

  const handleTextareaClick = () => {
    syncSelection();
    if (isMobile && emojiOpen) {
      closeEmojiPicker({ focusInput: true });
    }
  };

  const insertEmoji = (emoji: string) => {
    if (disabled) return;
    syncSelection();
    const { start, end } = selectionRef.current;
    const { next, selectionStart, selectionEnd } = insertAtSelection(value, start, end, emoji);
    if (countGraphemes(next) > MAX_LENGTH) return;
    patchValue(next, { start: selectionStart, end: selectionEnd });
  };

  const clearDraftAndInput = () => {
    setValue("");
    discardDraft();
    stopTyping();
    selectionRef.current = { start: 0, end: 0 };
    requestAnimationFrame(resizeTextarea);
    textareaRef.current?.focus({ preventScroll: true });
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    const sent = onSend(trimmed);
    if (sent) {
      setValue("");
      discardDraft();
      stopTyping();
      setEmojiOpen(false);
      selectionRef.current = { start: 0, end: 0 };
      requestAnimationFrame(resizeTextarea);
    }
  };

  const { charCount, nearLimit, progress, showCounter, showBar, canSend } = useMemo(() => {
    const count = countGraphemes(value);
    return {
      charCount: count,
      nearLimit: count > MAX_LENGTH * 0.9,
      progress: count / MAX_LENGTH,
      showCounter: count >= SHOW_COUNTER_FROM || focused || emojiOpen,
      showBar: count >= MAX_LENGTH * 0.25,
      canSend: !disabled && Boolean(value.trim()),
    };
  }, [value, disabled, focused, emojiOpen]);

  const showMobileEmoji = emojiOpen && !disabled && isMobile;
  const showDesktopEmoji = emojiOpen && !disabled && !isMobile;

  const emojiButton = (
    <button
      ref={emojiTriggerRef}
      type="button"
      className={`compose-tool-btn ${isMobile ? "compose-tool-btn-row" : ""} ${emojiOpen ? "compose-tool-btn-active" : ""}`}
      onPointerDown={(e) => e.preventDefault()}
      onClick={handleEmojiTriggerClick}
      disabled={disabled}
      aria-label={emojiOpen ? "Afficher le clavier" : "Ouvrir les emojis"}
      aria-expanded={emojiOpen}
      aria-controls="emoji-picker-panel"
    >
      <AppIcon icon={isMobile && emojiOpen ? Keyboard : Smile} size="sm" />
    </button>
  );

  const charCountEl = showCounter ? (
    <div
      className={`compose-char-count ${nearLimit ? "compose-char-count-warn" : ""}`}
      aria-live="polite"
      aria-label={`${charCount} caractères sur ${MAX_LENGTH}`}
    >
      <span className="compose-char-count-value">{charCount}</span>
      <span className="compose-char-count-sep">/</span>
      <span className="compose-char-count-max">{MAX_LENGTH}</span>
    </div>
  ) : null;

  const saveBadgeEl =
    saveState === "saved" && value.trim() ? (
      <span className={`compose-save-badge ${isMobile ? "compose-save-badge-mobile" : ""}`} role="status">
        <AppIcon icon={Check} size="sm" className="text-emerald-400/90" aria-hidden />
        Sauvegardé
      </span>
    ) : null;

  return (
    <div ref={composeAreaRef} className="chat-compose-area">
      <form
        ref={composeRef}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit();
        }}
        className={`chat-compose-form relative z-30 shrink-0 border-t border-white/[0.06] bg-[#0a0a10] px-3 md:bg-[#0a0a10]/95 md:px-5 md:py-3 md:safe-bottom md:backdrop-blur-xl lg:px-6 lg:py-4 ${emojiOpen && isMobile ? "chat-compose-form-emoji-open chat-compose-form-emoji-mode py-2" : "py-2.5"} ${isMobile ? "chat-compose-form-mobile" : "safe-bottom"}`}
      >
        {showMobileEmoji && (
          <div className="compose-emoji-inline">
            <ComposeEmojiPanel
              open={emojiOpen}
              panelRef={emojiPanelRef}
              onPick={insertEmoji}
              onClose={() => closeEmojiPicker({ focusInput: false })}
              variant="mobile"
            />
          </div>
        )}

        <AnimatePresence>
          {showRestored && (
            <motion.p
              key="draft-restored"
              className="compose-toast mb-2"
              role="status"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              Brouillon restauré
            </motion.p>
          )}
        </AnimatePresence>

        <div className="compose-media-wrap">
          {showDesktopEmoji && (
            <ComposeEmojiPanel
              open={emojiOpen}
              panelRef={emojiPanelRef}
              onPick={insertEmoji}
              onClose={() => closeEmojiPicker()}
              variant="desktop"
            />
          )}

          {!isMobile && (
            <div className="chat-compose-toolbar">
              <div className="chat-compose-tools">{emojiButton}</div>
              <div className="chat-compose-meta">
                <AnimatePresence mode="wait">
                  {saveBadgeEl && (
                    <motion.span
                      key="saved"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                    >
                      {saveBadgeEl}
                    </motion.span>
                  )}
                </AnimatePresence>
                {charCountEl}
              </div>
            </div>
          )}
        </div>

        <div className={`chat-compose-row ${emojiOpen && isMobile ? "mt-0" : "mt-2"}`}>
          {isMobile && emojiButton}

          <div className="chat-compose-field">
            <label htmlFor="chat-input" className="sr-only">
              Votre message
            </label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={value}
              readOnly={disabled || (isMobile && emojiOpen)}
              inputMode={isMobile && emojiOpen ? "none" : "text"}
              enterKeyHint="send"
              onTouchStart={(e) => {
                if (isMobile && emojiOpen) e.preventDefault();
              }}
              onChange={(e) => {
                const el = e.target;
                const sel = readTextareaSelection(el);
                selectionRef.current = sel;
                patchValue(el.value, sel);
              }}
              onSelect={syncSelection}
              onKeyUp={syncSelection}
              onClick={handleTextareaClick}
              onFocus={() => {
                if (isMobile && emojiOpen) {
                  textareaRef.current?.blur();
                  return;
                }
                setFocused(true);
              }}
              onBlur={() => {
                if (isMobile && emojiOpen) return;
                setFocused(false);
                syncSelection();
                flushDraft(valueRef.current, selectionRef.current);
              }}
              onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape" && emojiOpen) {
                  e.preventDefault();
                  closeEmojiPicker({ focusInput: !isMobile });
                }
              }}
              disabled={disabled}
              rows={1}
              placeholder={disabled ? "Connexion en cours…" : "Écrivez un message…"}
              className="chat-compose-input"
              aria-describedby="chat-input-hint"
            />
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="chat-compose-send"
            aria-label="Envoyer le message"
          >
            <span className="hidden md:inline">Envoyer</span>
            <AppIcon icon={Send} size="md" className="md:hidden" aria-hidden />
          </button>
        </div>

        {isMobile && (showCounter || saveBadgeEl) && (
          <div className="compose-mobile-meta">
            {saveBadgeEl}
            {charCountEl}
          </div>
        )}

        {showBar && (
          <div className="compose-progress-bar mt-2" aria-hidden>
            <div
              className={`compose-progress-bar-fill ${nearLimit ? "compose-progress-bar-warn" : ""}`}
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        )}

        <div className="mt-2 hidden items-center justify-between gap-2 md:flex">
          <p id="chat-input-hint" className="text-[10px] text-white/30">
            {focused
              ? `Entrée · envoyer  ·  Maj+Entrée · ligne  ·  ${charCount}/${MAX_LENGTH} car.`
              : "Cliquez pour écrire"}
          </p>
          {value.trim() && !disabled && (
            <button
              type="button"
              onClick={clearDraftAndInput}
              className="compose-clear-btn"
            >
              <AppIcon icon={Eraser} size="sm" />
              Effacer
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
