"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/page-header";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SetupPage() {
  const { ready, session, token, businessStatus, refreshBusiness } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace("/login");
    if (businessStatus === "ready") router.replace("/dashboard");
  }, [ready, session, businessStatus, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/business", {
        token,
        method: "POST",
        body: { name, phone, address, currency: "INR" },
      });
      await refreshBusiness();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your shop.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4">
      <Card className="w-full p-8">
        <h1 className="text-3xl font-semibold">Set up your shop</h1>
        <p className="mt-2 text-stone-500">One minute. You can change this later in Settings.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <ErrorBanner message={error} />
          <div>
            <Label htmlFor="name">Shop name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Demo Store" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <Button className="w-full" size="lg" disabled={busy}>
            {busy ? "Saving…" : "Create shop"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
