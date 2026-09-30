"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/page-header";
import { api, ApiError } from "@/lib/api";
import { useAuth, type AuthUser } from "@/lib/auth-context";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { setSessionToken } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supabaseEnabled = isSupabaseConfigured();

  async function finish(token: string, user: AuthUser) {
    const me = await api<AuthUser>("/api/v1/auth/me", { token });
    setSessionToken(token, me.email ? me : user);
    router.replace("/");
  }

  function authMessage(err: unknown) {
    if (err instanceof ApiError) return err.message;
    if (err && typeof err === "object" && "message" in err) return String((err as Error).message);
    return "Could not sign in.";
  }

  async function withSupabase() {
    const supabase = getSupabase();
    if (mode === "up") {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) throw err;
      if (!data.session?.access_token) {
        setInfo("Account created. If email confirmation is on, confirm it in your inbox, then sign in.");
        setMode("in");
        return;
      }
      await finish(data.session.access_token, {
        id: data.user?.id || "",
        email: data.user?.email || email,
      });
      return;
    }
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) throw err;
    if (!data.session?.access_token) throw new Error("Could not sign in.");
    await finish(data.session.access_token, {
      id: data.user?.id || "",
      email: data.user?.email || email,
    });
  }

  async function withLocal() {
    const path = mode === "up" ? "/api/v1/auth/register" : "/api/v1/auth/login";
    const data = await api<{ access_token: string; user: AuthUser }>(path, {
      method: "POST",
      body: { email, password },
    });
    setSessionToken(data.access_token, data.user);
    router.replace("/");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (supabaseEnabled) {
        try {
          await withSupabase();
          return;
        } catch (err) {
          const message = authMessage(err);
          const fromApi = err instanceof ApiError;
          if (mode === "in" && !fromApi) {
            try {
              await withLocal();
              return;
            } catch {
              throw new Error(message);
            }
          }
          throw new Error(message);
        }
      }
      await withLocal();
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <Card className="w-full max-w-md p-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Shop OS</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">
          {mode === "in" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-stone-500">Manage products, bills, stock, and closing — simply.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <ErrorBanner message={error} />
          {info ? <p className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">{info}</p> : null}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button className="w-full" size="lg" disabled={busy}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          className="mt-6 text-sm font-medium text-teal-800"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          type="button"
        >
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </Card>
    </div>
  );
}
