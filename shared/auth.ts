import { validateUsername } from "./slug";

/** Utilisateur tel qu'exposé au client (jamais de hash ni d'info sensible). */
export interface PublicUser {
  id: string;
  username: string;
  guest: boolean;
  /** Présent uniquement pour les membres inscrits. */
  email?: string;
  /** ISO 8601 ; présent uniquement pour les membres inscrits. */
  createdAt?: string;
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(raw: string): { valid: boolean; email?: string; error?: string } {
  const email = raw.trim();
  if (email.length > 254 || !EMAIL_REGEX.test(email)) {
    return { valid: false, error: "invalid_email" };
  }
  return { valid: true, email };
}

export function validatePassword(raw: string): { valid: boolean; error?: string } {
  if (typeof raw !== "string" || raw.length < PASSWORD_MIN || raw.length > PASSWORD_MAX) {
    return { valid: false, error: "invalid_password" };
  }
  return { valid: true };
}

export { validateUsername };
