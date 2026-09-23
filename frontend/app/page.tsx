"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { ready, session, businessStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    router.replace(businessStatus === "missing" ? "/setup" : "/dashboard");
  }, [ready, session, businessStatus, router]);

  return <p className="p-8 text-stone-500">Opening your shop…</p>;
}
