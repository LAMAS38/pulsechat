import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-wide text-sky-400">Cloudflare Chat</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Salons de clavardage temps réel</h1>
        <p className="mt-4 text-slate-400">
          Rejoignez un salon via une URL unique. Chaque salon fonctionne comme une instance
          indépendante propulsée par Cloudflare Durable Objects.
        </p>
        <Link
          to="/r/general"
          className="mt-8 inline-flex rounded-xl bg-sky-500 px-5 py-3 font-medium text-white transition hover:bg-sky-400"
        >
          Rejoindre le salon general
        </Link>
        <p className="mt-6 text-sm text-slate-500">
          Ou accédez directement à <code className="text-slate-300">/r/votre-salon</code>
        </p>
      </div>
    </div>
  );
}
