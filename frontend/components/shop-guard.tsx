"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "./app-shell";

export function ShopGuard({ children }: { children: ReactNode }) {
  const { ready, session, businessStatus } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (businessStatus === "missing" && path !== "/setup") {
      router.replace("/setup");
    }
  }, [ready, session, businessStatus, path, router]);

  if (!ready) {
    return <p className="p-8 text-stone-500">Loading…</p>;
  }
  if (!session) return null;
  if (businessStatus === "unknown") {
    return <p className="p-8 text-stone-500">Loading your shop…</p>;
  }
  if (businessStatus === "missing") return null;

  return <AppShell>{children}</AppShell>;
}
