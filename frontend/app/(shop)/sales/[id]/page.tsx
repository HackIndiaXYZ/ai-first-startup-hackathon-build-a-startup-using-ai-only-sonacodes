"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Product, Sale } from "@/lib/types";
import { money, PAYMENT_LABEL, qty, when } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBanner, PageHeader } from "@/components/page-header";

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, business } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const s = await api<Sale>(`/api/v1/sales/${id}`, { token });
        setSale(s);
        const products = await api<Product[]>("/api/v1/products", { token, query: { include_archived: true } });
        setNames(Object.fromEntries(products.map((p) => [p.id, p.name])));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Bill not found.");
      }
    })();
  }, [token, id]);

  async function openPdf() {
    if (!token || !sale) return;
    const blob = await api<Blob>(`/api/v1/sales/${sale.id}/invoice.pdf`, { token });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  if (!sale) return <ErrorBanner message={error || "Loading…"} />;
  const currency = business?.currency || "INR";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={sale.invoice_number}
        subtitle={when(sale.created_at)}
        action={<Button onClick={openPdf}>Print / PDF</Button>}
      />
      <Card>
        <p className="text-sm text-stone-500">Payment</p>
        <p className="font-medium">
          {PAYMENT_LABEL[sale.payment_method]} · {sale.payment_status}
        </p>
        <table className="mt-4 w-full text-left">
          <thead>
            <tr className="text-sm text-stone-500">
              <th className="py-2">Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-t border-stone-100">
                <td className="py-2">{names[item.product_id] || "Product"}</td>
                <td>{qty(item.quantity)}</td>
                <td>{money(item.unit_price, currency)}</td>
                <td className="text-right">{money(item.total, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 text-right">
          <p>Subtotal {money(sale.subtotal, currency)}</p>
          <p>Discount {money(sale.discount, currency)}</p>
          <p>Tax {money(sale.tax, currency)}</p>
          <p className="text-2xl font-semibold">Total {money(sale.total, currency)}</p>
        </div>
      </Card>
    </div>
  );
}
