import { useState, type FormEvent } from "react";
import { validateUsername } from "@shared/slug";

interface UsernameModalProps {
  onSubmit: (username: string) => void;
}

export function UsernameModal({ onSubmit }: UsernameModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const validation = validateUsername(value);
    if (!validation.valid || !validation.username) {
      setError("Pseudo invalide (2–24 caractères, lettres, chiffres, espaces, - ou _)");
      return;
    }
    onSubmit(validation.username);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-white">Rejoindre le salon</h2>
        <p className="mt-2 text-sm text-slate-400">
          Choisissez un pseudo pour participer à la conversation.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            placeholder="Votre pseudo"
            autoFocus
            maxLength={24}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none ring-sky-500 focus:ring-2"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-sky-500 px-4 py-3 font-medium text-white transition hover:bg-sky-400"
          >
            Entrer dans le salon
          </button>
        </form>
      </div>
    </div>
  );
}
