"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { ClosingPreview } from "@/lib/types";
import { money, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, PageHeader } from "@/components/page-header";

export default function ClosingPage() {
  const { token, business } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<ClosingPreview | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(day = date) {
    if (!token) return;
    setPreview(await api<ClosingPreview>("/api/v1/daily-closing", { token, query: { business_date: day } }));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Could not load closing."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, date]);

  const currency = business?.currency || "INR";

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Close day" subtitle="Saves a snapshot. Stock itself stays in the movement history." />
      <ErrorBanner message={error} />
      <div className="mb-4">
        <Label>Business date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Card className="space-y-3">
        <Row label="Opening stock value" value={money(preview?.opening_stock_value, currency)} />
        <Row label="Purchases" value={money(preview?.purchases_value, currency)} />
        <Row label="Sales" value={money(preview?.sales_value, currency)} />
        <Row label="Expenses" value={money(preview?.expenses_value, currency)} />
        <Row label="Adjustments" value={money(preview?.adjustments_value, currency)} />
        <Row label="Closing stock value" value={money(preview?.closing_stock_value, currency)} strong />
        <Row label="Units on hand" value={qty(preview?.total_units)} />
        {preview?.previous_closing_date ? (
          <p className="text-sm text-stone-500">Opening comes from {preview.previous_closing_date}.</p>
        ) : (
          <p className="text-sm text-stone-500">No previous closing. Opening starts at 0 until you close a day.</p>
        )}
        <div>
          <Label>Note</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={busy || preview?.already_closed}
          onClick={async () => {
            if (!token) return;
            setBusy(true);
            setError(null);
            try {
              await api("/api/v1/daily-closing", {
                token,
                method: "POST",
                body: { business_date: date, notes: notes || null },
              });
              await load();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Could not close the day.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {preview?.already_closed ? "This day is already closed" : busy ? "Closing…" : "Close day"}
        </Button>
      </Card>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-xl font-semibold" : ""}`}>
      <span className="text-stone-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}
