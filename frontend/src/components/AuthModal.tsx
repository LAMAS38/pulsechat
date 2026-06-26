import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  type LucideIcon,
  Lock,
  LogIn,
  Mail,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { validateEmail, validatePassword, validateUsername } from "@shared/auth";
import { useAuth } from "../hooks/useAuth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useOverlayScrollLock } from "../hooks/useOverlayScrollLock";
import { useVisualViewportOverlay } from "../hooks/useVisualViewportOverlay";
import { AuthRequestError } from "../lib/authApi";
import { evaluatePasswordStrength } from "../lib/passwordStrength";
import type { RoomTheme } from "../lib/roomTheme";
import { roomThemeStyle } from "../lib/roomTheme";
import { backdropVariants, scaleIn, springSnappy } from "../lib/motion";
import { Avatar } from "./Avatar";
import { AppIcon } from "./ui/icon";

type Mode = "choose" | "guest" | "login" | "register";

interface AuthModalProps {
  slug: string;
  theme: RoomTheme;
}

interface FieldProps extends ComponentProps<"input"> {
  icon: LucideIcon;
  action?: ReactNode;
}

function Field({ icon, action, ...inputProps }: FieldProps) {
  return (
    <div className={`auth-field ${action ? "auth-field-has-action" : ""}`}>
      <span className="auth-field-icon">
        <AppIcon icon={icon} size="sm" aria-hidden />
      </span>
      <input className="input-field" {...inputProps} />
      {action}
    </div>
  );
}

const modeMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function AuthModal({ slug, theme }: AuthModalProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { login, register, continueAsGuest } = useAuth();

  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formAnchorRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { panelStyle, scrollAnchorIntoView } = useVisualViewportOverlay(
    isMobile,
    formAnchorRef,
    scrollRef,
  );

  useOverlayScrollLock(true, "auth-modal-open");

  useEffect(() => {
    setError(null);
    setShowPassword(false);
  }, [mode]);

  const handleInputFocus = () => {
    if (!isMobile) return;
    requestAnimationFrame(() => requestAnimationFrame(scrollAnchorIntoView));
    window.setTimeout(scrollAnchorIntoView, 320);
  };

  const run = async (action: () => Promise<void>) => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      // Succès : le parent démonte la modale (user devient non-null).
    } catch (err) {
      const message =
        err instanceof AuthRequestError ? err.message : "Une erreur est survenue, réessayez";
      setError(message);
      setSubmitting(false);
    }
  };

  const submitGuest = (event: FormEvent) => {
    event.preventDefault();
    const v = validateUsername(username);
    if (!v.valid || !v.username) {
      setError("Pseudo : 2 à 24 caractères (lettres, chiffres, espaces, - ou _)");
      return;
    }
    void run(() => continueAsGuest(v.username!));
  };

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    if (!validateEmail(email).valid) {
      setError("Adresse e-mail invalide");
      return;
    }
    if (!validatePassword(password).valid) {
      setError("Mot de passe : 8 caractères minimum");
      return;
    }
    void run(() => login(email, password));
  };

  const submitRegister = (event: FormEvent) => {
    event.preventDefault();
    if (!validateEmail(email).valid) {
      setError("Adresse e-mail invalide");
      return;
    }
    const v = validateUsername(username);
    if (!v.valid || !v.username) {
      setError("Pseudo : 2 à 24 caractères (lettres, chiffres, espaces, - ou _)");
      return;
    }
    if (!validatePassword(password).valid) {
      setError("Mot de passe : 8 caractères minimum");
      return;
    }
    void run(() => register(email, v.username!, password));
  };

  const passwordToggle = (
    <button
      type="button"
      className="auth-field-action"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      tabIndex={-1}
    >
      <AppIcon icon={showPassword ? EyeOff : Eye} size="sm" aria-hidden />
    </button>
  );

  const titleFor: Record<Mode, { title: string; subtitle: string }> = {
    choose: { title: "Avant d'entrer", subtitle: "Discutez en invité ou créez un compte pour garder votre pseudo." },
    guest: { title: "Comment vous appelle-t-on ?", subtitle: "Votre pseudo est visible par les autres membres." },
    login: { title: "Bon retour", subtitle: "Connectez-vous pour retrouver votre profil." },
    register: { title: "Créer un compte", subtitle: "Gardez votre pseudo et votre historique." },
  };

  const avatarPreview = (name: string) => (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <Avatar username={name.trim() || "Vous"} size="lg" ring />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-white">{name.trim() || "Vous"}</p>
        <p className="text-xs text-white/35">Aperçu de votre profil</p>
      </div>
    </div>
  );

  // Validation en direct (n'affiche un message que si le champ est non vide).
  const emailValid = validateEmail(email).valid;
  const usernameValid = validateUsername(username).valid;
  const strength = evaluatePasswordStrength(password);

  const fieldError = (msg: string) => (
    <p className="mt-1.5 px-1 text-xs text-rose-300/90">{msg}</p>
  );

  const passwordStrengthMeter = (
    <div className="mt-2 px-1">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.barClass : "bg-white/10"}`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs ${strength.textClass}`} aria-live="polite">
        {password.length < 8
          ? "Mot de passe : 8 caractères minimum"
          : `Robustesse : ${strength.label}`}
      </p>
    </div>
  );

  const errorBlock = error && (
    <motion.p
      className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300"
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <AppIcon icon={AlertCircle} size="sm" className="mt-0.5 shrink-0" aria-hidden />
      <span>{error}</span>
    </motion.p>
  );

  const submitButton = (label: string, busyLabel: string, icon: LucideIcon) => (
    <button
      type="submit"
      disabled={submitting}
      className="btn-primary flex min-h-[50px] w-full items-center justify-center gap-2 text-base font-semibold disabled:opacity-60"
    >
      <AppIcon icon={icon} size="sm" aria-hidden />
      {submitting ? busyLabel : label}
    </button>
  );

  const chooseView = (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setMode("guest")}
        className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-violet-400/40 hover:bg-white/[0.05]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
          <AppIcon icon={Users} size="md" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-white">Continuer en invité</span>
          <span className="block text-sm text-white/45">Rapide, aucun e-mail requis</span>
        </span>
        <AppIcon icon={ArrowRight} size="sm" className="shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => setMode("register")}
        className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-violet-400/40 hover:bg-white/[0.05]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
          <AppIcon icon={UserPlus} size="md" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-white">Créer un compte</span>
          <span className="block text-sm text-white/45">Gardez pseudo & historique</span>
        </span>
        <AppIcon icon={ArrowRight} size="sm" className="shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>

      <p className="pt-1 text-center text-sm text-white/45">
        Vous avez déjà un compte ?{" "}
        <button type="button" onClick={() => setMode("login")} className="font-semibold text-violet-300 underline-offset-2 hover:underline">
          Se connecter
        </button>
      </p>
    </div>
  );

  const guestView = (
    <form onSubmit={submitGuest} className="space-y-4">
      {avatarPreview(username)}
      <div>
        <Field
          icon={User}
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(null); }}
          onFocus={handleInputFocus}
          placeholder="Votre pseudo"
          autoComplete="nickname"
          enterKeyHint="go"
          maxLength={24}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {username.length > 0 && !usernameValid &&
          fieldError("2 à 24 caractères : lettres, chiffres, espaces, - ou _")}
      </div>
      {errorBlock}
      {submitButton("Entrer dans le salon", "Connexion…", ArrowRight)}
    </form>
  );

  const loginView = (
    <form onSubmit={submitLogin} className="space-y-4">
      <div>
        <Field
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          onFocus={handleInputFocus}
          placeholder="Adresse e-mail"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
        />
        {email.length > 0 && !emailValid && fieldError("Format d'e-mail invalide")}
      </div>
      <Field
        icon={Lock}
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(null); }}
        onFocus={handleInputFocus}
        placeholder="Mot de passe"
        autoComplete="current-password"
        action={passwordToggle}
      />
      {errorBlock}
      {submitButton("Se connecter", "Connexion…", LogIn)}
      <p className="text-center text-sm text-white/45">
        Pas encore de compte ?{" "}
        <button type="button" onClick={() => setMode("register")} className="font-semibold text-violet-300 underline-offset-2 hover:underline">
          Créer un compte
        </button>
      </p>
    </form>
  );

  const registerView = (
    <form onSubmit={submitRegister} className="space-y-4">
      {avatarPreview(username)}
      <div>
        <Field
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          onFocus={handleInputFocus}
          placeholder="Adresse e-mail"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
        />
        {email.length > 0 && !emailValid && fieldError("Format d'e-mail invalide")}
      </div>
      <div>
        <Field
          icon={User}
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(null); }}
          onFocus={handleInputFocus}
          placeholder="Pseudo"
          autoComplete="nickname"
          maxLength={24}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {username.length > 0 && !usernameValid &&
          fieldError("2 à 24 caractères : lettres, chiffres, espaces, - ou _")}
      </div>
      <div>
        <Field
          icon={Lock}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          onFocus={handleInputFocus}
          placeholder="Mot de passe (8 caractères min.)"
          autoComplete="new-password"
          action={passwordToggle}
        />
        {password.length > 0 && passwordStrengthMeter}
      </div>
      {errorBlock}
      {submitButton("Créer mon compte", "Création…", UserPlus)}
      <p className="text-center text-sm text-white/45">
        Déjà inscrit ?{" "}
        <button type="button" onClick={() => setMode("login")} className="font-semibold text-violet-300 underline-offset-2 hover:underline">
          Se connecter
        </button>
      </p>
    </form>
  );

  const body =
    mode === "choose"
      ? chooseView
      : mode === "guest"
        ? guestView
        : mode === "login"
          ? loginView
          : registerView;

  const { title, subtitle } = titleFor[mode];

  const header = (
    <div className="flex items-start justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50 sm:text-[11px] sm:tracking-widest">
        <span className="text-base sm:text-sm" aria-hidden>{theme.emoji}</span>
        <span className="truncate">Rejoindre #{slug}</span>
      </p>
      {mode === "choose" ? (
        <Link
          to="/"
          className="btn-ghost -mr-1 flex min-h-[44px] shrink-0 items-center gap-1.5 px-2 py-1.5 text-sm text-white/60 sm:min-h-0 sm:text-xs"
        >
          <AppIcon icon={ArrowLeft} size="sm" aria-hidden />
          Accueil
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="btn-ghost -mr-1 flex min-h-[44px] shrink-0 items-center gap-1.5 px-2 py-1.5 text-sm text-white/60 sm:min-h-0 sm:text-xs"
        >
          <AppIcon icon={ArrowLeft} size="sm" aria-hidden />
          Retour
        </button>
      )}
    </div>
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
        aria-labelledby="auth-modal-title"
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
            transition={springSnappy}
            layout
          >
            <div className="flex min-h-full flex-col gap-5 pt-1 sm:gap-6">
              {header}
              <div ref={formAnchorRef} className="username-modal-form-anchor">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={mode}
                    variants={modeMotion}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.18 }}
                    className="space-y-5"
                  >
                    <div>
                      <h2 id="auth-modal-title" className="font-display text-[1.5rem] font-bold leading-snug text-white sm:text-[1.625rem]">
                        {title}
                      </h2>
                      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-white/45 sm:text-sm">
                        {subtitle}
                      </p>
                    </div>
                    {body}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );

  return createPortal(modal, document.body);
}
