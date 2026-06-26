import type { PublicUser } from "@shared/auth";

export interface ApiError {
  error: string;
  message: string;
}

export class AuthRequestError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new AuthRequestError(0, "network", "Connexion au serveur impossible");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // réponse sans corps JSON
  }

  if (!res.ok) {
    const err = data as Partial<ApiError> | null;
    throw new AuthRequestError(
      res.status,
      err?.error ?? "error",
      err?.message ?? "Une erreur est survenue",
    );
  }

  return data as T;
}

export function fetchMe(): Promise<{ user: PublicUser | null }> {
  return request("/auth/me");
}

export function login(email: string, password: string): Promise<{ user: PublicUser }> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(
  email: string,
  username: string,
  password: string,
): Promise<{ user: PublicUser }> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
}

export function continueAsGuest(username: string): Promise<{ user: PublicUser }> {
  return request("/auth/guest", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function logout(): Promise<{ ok: true }> {
  return request("/auth/logout", { method: "POST" });
}
