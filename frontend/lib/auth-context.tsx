"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { Business } from "./types";

const TOKEN_KEY = "shopos_access_token";

export type AuthUser = { id: string; email: string; full_name?: string | null };

type AuthState = {
  ready: boolean;
  user: AuthUser | null;
  token: string | null;
  session: { access_token: string; user: AuthUser } | null;
  business: Business | null;
  businessStatus: "unknown" | "missing" | "ready";
  refreshBusiness: () => Promise<void>;
  setSessionToken: (token: string, user: AuthUser) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessStatus, setBusinessStatus] = useState<AuthState["businessStatus"]>("unknown");

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        if (isSupabaseConfigured()) {
          const { data } = await getSupabase().auth.getSession();
          const access = data.session?.access_token;
          if (access) {
            try {
              const me = await api<AuthUser>("/api/v1/auth/me", { token: access });
              if (cancelled) return;
              setToken(access);
              setUser(me);
              setReady(true);
              return;
            } catch {
              await getSupabase().auth.signOut();
            }
          }
        }
        const stored = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
        if (!stored) {
          if (!cancelled) setReady(true);
          return;
        }
        const me = await api<AuthUser>("/api/v1/auth/me", { token: stored });
        if (cancelled) return;
        setToken(stored);
        setUser(me);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBusiness = useCallback(async () => {
    if (!token) {
      setBusiness(null);
      setBusinessStatus("unknown");
      return;
    }
    try {
      const current = await api<Business>("/api/v1/business", { token });
      setBusiness(current);
      setBusinessStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.code === "NO_BUSINESS")) {
        setBusiness(null);
        setBusinessStatus("missing");
        return;
      }
      throw err;
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setBusiness(null);
      setBusinessStatus("unknown");
      return;
    }
    refreshBusiness().catch(() => setBusinessStatus("unknown"));
  }, [token, refreshBusiness]);

  const setSessionToken = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    if (isSupabaseConfigured()) {
      await getSupabase().auth.signOut();
    }
    setToken(null);
    setUser(null);
    setBusiness(null);
    setBusinessStatus("unknown");
  }, []);

  const session = token && user ? { access_token: token, user } : null;

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      token,
      session,
      business,
      businessStatus,
      refreshBusiness,
      setSessionToken,
      signOut,
    }),
    [ready, user, token, session, business, businessStatus, refreshBusiness, setSessionToken, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
