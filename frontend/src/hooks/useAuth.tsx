import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PublicUser } from "@shared/auth";
import * as authApi from "../lib/authApi";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: PublicUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  continueAsGuest: (username: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    authApi
      .fetchMe()
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        setStatus(res.user ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: next } = await authApi.login(email, password);
    setUser(next);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const { user: next } = await authApi.register(email, username, password);
    setUser(next);
    setStatus("authenticated");
  }, []);

  const continueAsGuest = useCallback(async (username: string) => {
    const { user: next } = await authApi.continueAsGuest(username);
    setUser(next);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, continueAsGuest, logout }),
    [user, status, login, register, continueAsGuest, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
