"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, PageHeader } from "@/components/page-header";

type Line = { product_id: string; quantity: string; unit_cost: string };

export default function NewPurchasePage() {
  const { token } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: "1", unit_cost: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<Product[]>("/api/v1/products", { token }).then(setProducts);
  }, [token]);

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((line, idx) => (idx === i ? { ...line, ...patch } : line)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/purchases", {
        token,
        method: "POST",
        body: {
          supplier_name: supplier || null,
          invoice_number: invoice || null,
          items: lines.filter((l) => l.product_id && l.quantity && l.unit_cost),
        },
      });
      router.push("/purchases");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save purchase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Record purchase" subtitle="This adds stock immediately." />
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorBanner message={error} />
        <Card className="space-y-4">
          <div>
            <Label>Supplier</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="City Wholesale" />
          </div>
          <div>
            <Label>Their invoice no. (optional)</Label>
            <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Label>Product</Label>
                <Select
                  value={line.product_id}
                  onChange={(e) => {
                    const product = products.find((p) => p.id === e.target.value);
                    update(i, {
                      product_id: e.target.value,
                      unit_cost: product?.purchase_price || line.unit_cost,
                    });
                  }}
                >
                  <option value="">Choose product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Qty</Label>
                <Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
              </div>
              <div>
                <Label>Unit cost</Label>
                <Input type="number" min="0" step="0.01" value={line.unit_cost} onChange={(e) => update(i, { unit_cost: e.target.value })} />
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setLines((l) => [...l, { product_id: "", quantity: "1", unit_cost: "" }])}>
            Add another item
          </Button>
        </Card>
        <Button className="w-full" size="lg" disabled={busy}>
          {busy ? "Saving…" : "Save purchase"}
        </Button>
      </form>
    </div>
  );
}
