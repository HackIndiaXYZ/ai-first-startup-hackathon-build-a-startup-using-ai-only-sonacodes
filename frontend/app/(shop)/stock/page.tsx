"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { StockOverview } from "@/lib/types";
import { money, qty, STOCK_LABEL, when } from "@/lib/format";
import { Badge, Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default function StockPage() {
  const { token, business } = useAuth();
  const [data, setData] = useState<StockOverview | null>(null);

  useEffect(() => {
    if (!token) return;
    api<StockOverview>("/api/v1/stock", { token }).then(setData);
  }, [token]);

  const currency = business?.currency || "INR";

  return (
    <div>
      <PageHeader title="Stock" subtitle="Live quantities from stock movements." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-stone-500">Stock value</p>
          <p className="text-2xl font-semibold">{money(data?.stock_value, currency)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Low stock</p>
          <p className="text-2xl font-semibold">{data?.low_stock_count ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Out of stock</p>
          <p className="text-2xl font-semibold">{data?.out_of_stock_count ?? "—"}</p>
        </Card>
      </div>
      <div className="space-y-2">
        {data?.items.map((item) => (
          <Link key={item.product_id} href={`/products/${item.product_id}`}>
            <Card className="flex items-center justify-between hover:border-teal-200">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-stone-500">{money(item.value, currency)}</p>
              </div>
              <div className="flex items-center gap-3">
                {item.status === "out" ? <Badge tone="bad">Out</Badge> : item.status === "low" ? <Badge tone="warn">Low</Badge> : null}
                <p className="font-medium">
                  {qty(item.quantity)} {item.unit}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-6">
        <h2 className="font-semibold">Recent movements</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data?.recent.map((t) => (
            <li key={t.id} className="flex justify-between gap-3">
              <span>
                {t.product_name || "Product"} · {STOCK_LABEL[t.transaction_type]}
              </span>
              <span>
                {qty(t.quantity)} · {when(t.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
