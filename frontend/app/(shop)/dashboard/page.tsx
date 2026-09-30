"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Dashboard } from "@/lib/types";
import { money, qty, STOCK_LABEL, when } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner, PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  const { token, business } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Dashboard>("/api/v1/dashboard", { token })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load today."));
  }, [token]);

  const currency = business?.currency || "INR";

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle="A quick look at your shop."
        action={
          <Link href="/sell">
            <Button size="lg">New Bill</Button>
          </Link>
        }
      />
      <ErrorBanner message={error} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales" value={money(data?.sales_total, currency)} />
        <Stat label="Bills" value={String(data?.bills_count ?? 0)} />
        <Stat label="Purchases" value={money(data?.purchases_total, currency)} />
        <Stat label="Expenses" value={money(data?.expenses_total, currency)} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link href="/stock">
          <Card className="hover:border-teal-200">
            <p className="text-sm text-stone-500">Low stock</p>
            <p className="mt-1 text-3xl font-semibold">{data?.low_stock_count ?? "—"}</p>
          </Card>
        </Link>
        <Link href="/stock">
          <Card className="hover:border-red-200">
            <p className="text-sm text-stone-500">Out of stock</p>
            <p className="mt-1 text-3xl font-semibold">{data?.out_of_stock_count ?? "—"}</p>
          </Card>
        </Link>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Top selling today</h2>
          <ul className="mt-4 space-y-3">
            {(data?.top_products || []).length === 0 && <p className="text-stone-500">No bills yet today.</p>}
            {data?.top_products.map((p) => (
              <li key={p.product_id} className="flex justify-between gap-4">
                <span className="font-medium">{p.name}</span>
                <span className="text-stone-500">
                  {qty(p.quantity)} · {money(p.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Recent stock moves</h2>
          <ul className="mt-4 space-y-3">
            {(data?.recent_transactions || []).length === 0 && <p className="text-stone-500">Nothing yet.</p>}
            {data?.recent_transactions.map((t) => (
              <li key={t.id} className="flex justify-between gap-4 text-sm">
                <span>
                  <span className="font-medium">{t.product_name}</span>
                  <span className="text-stone-500"> · {STOCK_LABEL[t.transaction_type]}</span>
                </span>
                <span>
                  {qty(t.quantity)} · {when(t.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}
