import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Code2, Gamepad2, MessageCircle, MessageSquarePlus, Shuffle, Sparkles, type LucideIcon } from "lucide-react";
import { normalizeSlug, validateSlug } from "@shared/slug";
import { useSeo } from "../hooks/useSeo";
import { homeJsonLd, SEO_DEFAULTS, SITE } from "../lib/seo";
import { getRoomTheme, roomThemeStyle } from "../lib/roomTheme";
import { AppIcon } from "../components/ui/icon";

const FEATURED_ROOMS: {
  slug: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}[] = [
  { slug: "general", label: "Général", desc: "Discussions libres", icon: MessageCircle },
  { slug: "dev", label: "Projets", desc: "Idées & créativité", icon: Code2 },
  { slug: "gaming", label: "Gaming", desc: "Sessions multijoueur", icon: Gamepad2 },
  { slug: "random", label: "Random", desc: "Tout et n'importe quoi", icon: Shuffle },
];

const STEPS = [
  { n: "01", title: "Créez votre salon", desc: "Choisissez un nom pour votre espace" },
  { n: "02", title: "Partagez le lien", desc: "Vos invités rejoignent en un clic" },
  { n: "03", title: "Discutez en direct", desc: "Messages instantanés, où que vous soyez" },
] as const;

const HIGHLIGHTS = [
  "Gratuit et sans inscription",
  "Salons privés par lien",
  "Historique conservé à votre retour",
] as const;

export function HomePage() {
  useSeo({
    title: SEO_DEFAULTS.title,
    description: SEO_DEFAULTS.description,
    path: "/",
    jsonLd: homeJsonLd(),
  });
  const navigate = useNavigate();
  const [slugInput, setSlugInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("home-page");
    return () => document.documentElement.classList.remove("home-page");
  }, []);

  const previewTheme = useMemo(
    () => getRoomTheme(slugInput.length >= 3 ? slugInput : "preview"),
    [slugInput],
  );

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    const validation = validateSlug(slugInput);
    if (!validation.valid || !validation.slug) {
      setError("3 à 32 caractères : lettres, chiffres et tirets uniquement.");
      return;
    }
    navigate(`/r/${validation.slug}`);
  };

  return (
    <main className="page-shell flex min-h-app flex-col py-6 sm:py-10 md:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-5xl">
        <motion.header
          className="text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-200 sm:mb-4 sm:px-4 sm:text-xs"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <AppIcon icon={Sparkles} size="sm" className="text-violet-300" aria-hidden />
            Temps réel · Gratuit · Sans compte
          </motion.div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-gradient text-gradient-animated">{SITE.name}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/50 sm:mt-4 sm:text-base">
            {SITE.pitch}
          </p>
        </motion.header>

        <motion.div
          className="mt-6 hidden grid-cols-3 items-stretch gap-3 md:grid lg:hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="flex h-full min-h-[108px] flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center"
            >
              <p className="font-display text-lg font-bold text-white/20">{step.n}</p>
              <p className="mt-1 text-xs font-semibold text-white">{step.title}</p>
              <p className="mt-0.5 flex-1 text-[10px] leading-snug text-white/40">{step.desc}</p>
            </div>
          ))}
        </motion.div>

        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8">
          <motion.section
            className="hero-card hero-card-glow room-themed flex min-h-0 flex-col p-5 sm:p-6 lg:min-h-[520px] lg:p-8"
            style={roomThemeStyle(previewTheme)}
            aria-labelledby="join-heading"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            layout
          >
            <motion.h2
              id="join-heading"
              className="flex items-center gap-2 font-display text-base font-semibold text-white sm:text-lg"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
            >
              <AppIcon
                icon={MessageSquarePlus}
                size="sm"
                className="shrink-0 text-violet-300"
                aria-hidden
              />
              Créer ou rejoindre un salon
            </motion.h2>

            <form
              onSubmit={handleCreate}
              className="join-room-form mt-4 flex flex-col gap-3 md:flex-row md:items-stretch"
            >
              <div className="input-field-group min-w-0 flex-1">
                <label htmlFor="room-slug" className="sr-only">
                  Nom du salon
                </label>
                <span className="input-field-prefix" aria-hidden>
                  /r/
                </span>
                <input
                  id="room-slug"
                  type="text"
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  value={slugInput}
                  onChange={(e) => {
                    setSlugInput(normalizeSlug(e.target.value));
                    setError(null);
                  }}
                  placeholder="mon-salon"
                  maxLength={32}
                  className="input-field-inner"
                />
              </div>
              <motion.button
                type="submit"
                className="btn-primary flex min-h-[48px] w-full shrink-0 items-center justify-center gap-2 px-6 md:w-auto md:px-8"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                Entrer
                <AppIcon icon={ArrowRight} size="sm" aria-hidden />
              </motion.button>
            </form>

            {error && (
              <motion.p
                className="mt-2 text-sm text-rose-400"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}

            <div className="mt-6 flex flex-1 flex-col sm:mt-8">
              <p className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                Salons populaires
              </p>
              <div className="room-grid mt-3 flex-1">
                {FEATURED_ROOMS.map((room) => {
                  const theme = getRoomTheme(room.slug);
                  return (
                    <Link
                      key={room.slug}
                      to={`/r/${room.slug}`}
                      className="room-card group flex h-full min-h-[96px] flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:min-h-[104px]"
                      style={roomThemeStyle(theme)}
                    >
                      <span
                        className="room-card-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                        style={{
                          background: `color-mix(in srgb, ${theme.accent} 18%, transparent)`,
                          color: theme.accent,
                        }}
                        aria-hidden
                      >
                        <AppIcon icon={room.icon} size="sm" />
                      </span>
                      <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">{room.label}</p>
                      <p className="mt-auto line-clamp-2 text-[11px] leading-snug text-white/45">
                        {room.desc}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.section>

          <motion.aside
            className="hidden min-h-0 lg:block"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <div className="glass-card flex h-full min-h-[520px] flex-col p-6 lg:p-8">
              <p className="shrink-0 text-[11px] font-medium uppercase tracking-widest text-white/35">
                Comment ça marche
              </p>
              <ol className="mt-5 flex flex-1 flex-col gap-5">
                {STEPS.map((step) => (
                  <li key={step.n} className="flex items-start gap-4">
                    <span className="w-9 shrink-0 pt-0.5 text-right font-display text-2xl font-bold leading-none text-white/15">
                      {step.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-white">{step.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/40">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-auto shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                  En bref
                </p>
                <ul className="mt-3 space-y-2">
                  {HIGHLIGHTS.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-white/50">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </main>
  );
}
