import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Share2, Users } from "lucide-react";
import { validateSlug, validateUsername } from "@shared/slug";
import { useChatViewportLock } from "../hooks/useChatViewportLock";
import { useChatWebSocket } from "../hooks/useChatWebSocket";
import { useSeo } from "../hooks/useSeo";
import { getRoomTheme, roomThemeStyle } from "../lib/roomTheme";
import { roomJsonLd, SITE } from "../lib/seo";
import {
  clearStoredUsername,
  getStoredUsername,
  setStoredUsername,
} from "../lib/username";
import { ActivityToasts } from "./ActivityToasts";
import { ConnectedUsers } from "./ConnectedUsers";
import { ConnectionStatus, statusDotClass } from "./ConnectionStatus";
import { ErrorBanner } from "./ErrorBanner";
import { MobileChatDock } from "./MobileChatDock";
import { MembersSheet } from "./MembersSheet";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { TypingIndicator } from "./TypingIndicator";
import { UsernameModal } from "./UsernameModal";
import { AppIcon } from "./ui/icon";
import { fadeUp, springSnappy } from "../lib/motion";

function CopyRoomLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/r/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiez le lien du salon :", url);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="btn-ghost btn-icon inline-flex min-h-[40px] min-w-[40px] shrink-0 md:min-h-[36px] md:min-w-0 md:gap-1.5 md:px-2.5 md:text-[11px] md:text-white/50 lg:inline-flex"
      aria-live="polite"
      aria-label={copied ? "Lien copié" : "Partager le salon"}
    >
      {copied ? (
        <>
          <AppIcon icon={Check} size="sm" className="text-emerald-400" />
          <span className="hidden lg:inline">Copié</span>
        </>
      ) : (
        <>
          <AppIcon icon={Share2} size="sm" />
          <span className="hidden lg:inline">Partager</span>
        </>
      )}
    </button>
  );
}

export function ChatLayout() {
  const { slug: rawSlug = "" } = useParams<{ slug: string }>();
  const slugValidation = useMemo(() => validateSlug(rawSlug), [rawSlug]);
  const slug = slugValidation.valid ? slugValidation.slug! : rawSlug;
  const theme = useMemo(() => getRoomTheme(slug), [slug]);

  const [membersOpen, setMembersOpen] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);

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

  useChatViewportLock(slugValidation.valid);

  const {
    messages,
    userCount,
    connectedUsers,
    typingUsers,
    connectionStatus,
    historyLoaded,
    error,
    sendMessage,
    setTyping,
    dismissError,
    reconnect,
    activityToasts,
  } = useChatWebSocket({ slug, username, enabled: chatEnabled });

  useSeo({
    title: slugValidation.valid ? `${theme.emoji} #${slug}` : "Salon introuvable",
    description: slugValidation.valid
      ? `Rejoignez le salon #${slug} sur ${SITE.name}. Chat temps réel, messages instantanés et membres en ligne.`
      : `Ce salon n'existe pas ou le nom est invalide. Retournez à l'accueil ${SITE.name}.`,
    path: slugValidation.valid ? `/r/${slug}` : "/",
    noindex: true,
    ogType: "website",
    jsonLd: slugValidation.valid ? roomJsonLd(slug) : undefined,
  });

  const [loadTimedOut, setLoadTimedOut] = useState(false);

  useEffect(() => {
    if (!chatEnabled) {
      setLoadTimedOut(false);
      return;
    }
    setLoadTimedOut(false);
    const id = window.setTimeout(() => setLoadTimedOut(true), 10_000);
    return () => window.clearTimeout(id);
  }, [chatEnabled, slug, username]);

  const isLoadingHistory =
    chatEnabled &&
    !historyLoaded &&
    !loadTimedOut &&
    connectionStatus === "connecting";

  const showError =
    error &&
    !errorDismissed &&
    connectionStatus !== "connecting" &&
    connectionStatus !== "connected";

  useEffect(() => {
    if (error) setErrorDismissed(false);
  }, [error]);

  const handleUsernameSubmit = (nextUsername: string) => {
    setStoredUsername(nextUsername);
    setUsername(nextUsername);
  };

  const handleDismissError = () => {
    setErrorDismissed(true);
    dismissError();
  };

  const handleRetry = () => {
    setErrorDismissed(false);
    reconnect();
  };

  if (!slugValidation.valid) {
    return (
      <div className="flex min-h-app items-center justify-center p-6">
        <div className="glass-card max-w-md p-8 text-center">
          <p className="text-4xl" aria-hidden>
            🚫
          </p>
          <h1 className="mt-4 font-display text-xl font-semibold text-white">Salon introuvable</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Le nom du salon doit contenir 3 à 32 caractères (lettres, chiffres et tirets).
          </p>
          <Link to="/" className="btn-primary mt-6 inline-flex min-h-[44px] items-center">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="room-themed chat-viewport flex flex-col overflow-hidden"
      style={roomThemeStyle(theme)}
    >
      <AnimatePresence>
        {!username && (
          <UsernameModal key="username" slug={slug} theme={theme} onSubmit={handleUsernameSubmit} />
        )}
      </AnimatePresence>

      <motion.header
        className="room-header safe-top z-30 flex shrink-0 items-center justify-between gap-1.5 overflow-visible border-b px-3 py-2.5 backdrop-blur-xl sm:gap-2 sm:px-4 sm:py-3 md:sticky md:top-0 md:gap-3 md:px-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={springSnappy}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-visible sm:gap-3">
          <Link
            to="/"
            className="btn-ghost btn-icon flex min-h-[44px] min-w-[44px]"
            aria-label="Retour à l'accueil"
          >
            <AppIcon icon={ArrowLeft} size="md" />
          </Link>
          <div className="flex min-w-0 items-baseline gap-2 md:gap-2.5">
            <span className="relative top-px shrink-0 text-lg leading-none md:text-xl" aria-hidden>
              {theme.emoji}
            </span>
            <div className="room-slug-wrap">
              <h1 className="room-slug-title">#{slug}</h1>
            </div>
          </div>
          <CopyRoomLink slug={slug} />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="btn-ghost flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 text-xs text-white/70 md:hidden"
            aria-label={`${userCount} membre${userCount !== 1 ? "s" : ""} en ligne, ouvrir la liste`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass[connectionStatus]}`}
              aria-hidden
            />
            <AppIcon icon={Users} size="sm" className="text-white/55" />
            <span className="tabular-nums font-medium">{userCount}</span>
          </button>
          <ConnectionStatus status={connectionStatus} className="hidden md:flex" />
        </div>
      </motion.header>

      <AnimatePresence>
        {showError && (
          <motion.div
            key="error"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <ErrorBanner
              message={error}
              onDismiss={handleDismissError}
              onRetry={connectionStatus === "disconnected" ? handleRetry : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="chat-body">
        <ActivityToasts toasts={activityToasts} />

        <div className="chat-messages-pane relative">
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="chat-shell flex min-h-0 flex-1 flex-col overflow-hidden">
              <MessageList
                messages={messages}
                currentUsername={username ?? ""}
                slug={slug}
                theme={theme}
                connectionStatus={connectionStatus}
                isLoadingHistory={isLoadingHistory}
              />
            </div>
          </main>
          <ConnectedUsers usernames={connectedUsers} currentUsername={username ?? ""} />
        </div>
      </div>

      <MobileChatDock>
        <div className="chat-dock-typing md:px-5 lg:px-6">
          <TypingIndicator usernames={typingUsers} currentUsername={username ?? ""} />
        </div>
        <MessageInput
          slug={slug}
          disabled={!chatEnabled || connectionStatus !== "connected"}
          onSend={sendMessage}
          onTyping={setTyping}
        />
      </MobileChatDock>

      <MembersSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        usernames={connectedUsers}
        currentUsername={username ?? ""}
      />
    </div>
  );
}
