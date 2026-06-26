import { PASSWORD_MIN } from "@shared/auth";

export interface PasswordStrength {
  /** 0 (vide) à 4 (fort). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** Couleur Tailwind (classe bg) pour la barre. */
  barClass: string;
  textClass: string;
}

const LEVELS: Record<PasswordStrength["score"], Omit<PasswordStrength, "score">> = {
  0: { label: "", barClass: "bg-white/10", textClass: "text-white/40" },
  1: { label: "Faible", barClass: "bg-rose-500", textClass: "text-rose-300" },
  2: { label: "Moyen", barClass: "bg-amber-500", textClass: "text-amber-300" },
  3: { label: "Bon", barClass: "bg-lime-500", textClass: "text-lime-300" },
  4: { label: "Fort", barClass: "bg-emerald-500", textClass: "text-emerald-300" },
};

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, ...LEVELS[0] };

  let points = 0;
  if (password.length >= PASSWORD_MIN) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;

  // Mot de passe trop court : plafonné à "Faible" quoi qu'il arrive.
  if (password.length < PASSWORD_MIN) {
    return { score: 1, ...LEVELS[1] };
  }

  const score = Math.min(4, Math.max(1, points)) as PasswordStrength["score"];
  return { score, ...LEVELS[score] };
}
