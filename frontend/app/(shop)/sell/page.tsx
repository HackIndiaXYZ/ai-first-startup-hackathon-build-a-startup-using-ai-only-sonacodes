"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { PaymentMethod, Product, Sale } from "@/lib/types";
import { money, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, PageHeader } from "@/components/page-header";

type Line = { product: Product; quantity: number };

export default function SellPage() {
  const { token, business } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("0");
  const [payment, setPayment] = useState<PaymentMethod>("UPI");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      api<Product[]>("/api/v1/products", { token, query: { q: q || undefined } }).then(setProducts);
    }, 150);
    return () => clearTimeout(t);
  }, [token, q]);

  const currency = business?.currency || "INR";
  const taxRate = business?.tax_enabled ? Number(business.tax_rate || 0) : 0;

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, line) => sum + Number(line.product.selling_price) * line.quantity, 0);
    const disc = Math.min(Number(discount || 0), subtotal);
    const taxable = Math.max(subtotal - disc, 0);
    const tax = taxRate ? (taxable * taxRate) / 100 : 0;
    return { subtotal, disc, tax, total: taxable + tax };
  }, [cart, discount, taxRate]);

  function add(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { product, quantity: 1 }];
    });
  }

  function setQty(id: string, quantity: number) {
    setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(1, quantity) } : l)).filter((l) => l.quantity > 0));
  }

  async function complete() {
    if (!token || cart.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const sale = await api<Sale>("/api/v1/sales", {
        token,
        method: "POST",
        body: {
          items: cart.map((l) => ({ product_id: l.product.id, quantity: String(l.quantity) })),
          discount: discount || "0",
          payment_method: payment,
        },
      });
      router.push(`/sales/${sale.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete the bill.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <PageHeader title="New Bill" subtitle="Search, tap, and collect payment." />
        <Input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4" />
        <div className="grid gap-2">
          {products.map((p) => (
            <button key={p.id} onClick={() => add(p)} className="text-left">
              <Card className="flex items-center justify-between hover:border-teal-300">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-stone-500">
                    {qty(p.current_stock)} {p.unit} in stock
                  </p>
                </div>
                <p className="text-lg font-semibold">{money(p.selling_price, currency)}</p>
              </Card>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Card className="space-y-4 lg:sticky lg:top-8">
          <h2 className="text-xl font-semibold">Cart</h2>
          <ErrorBanner message={error} />
          {cart.length === 0 && <p className="text-stone-500">Tap a product to add it.</p>}
          {cart.map((line) => (
            <div key={line.product.id} className="flex items-center gap-2">
              <div className="flex-1">
                <p className="font-medium">{line.product.name}</p>
                <p className="text-sm text-stone-500">{money(line.product.selling_price, currency)}</p>
              </div>
              <Button size="icon" variant="secondary" onClick={() => setQty(line.product.id, line.quantity - 1)}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-semibold">{line.quantity}</span>
              <Button size="icon" variant="secondary" onClick={() => setQty(line.product.id, line.quantity + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((l) => l.product.id !== line.product.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div>
            <Label>Discount</Label>
            <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div>
            <Label>Payment</Label>
            <Select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CREDIT">Credit</option>
            </Select>
          </div>
          <div className="space-y-1 text-sm">
            <Row label="Subtotal" value={money(totals.subtotal, currency)} />
            <Row label="Discount" value={money(totals.disc, currency)} />
            {business?.tax_enabled ? <Row label={`Tax (${business.tax_rate}%)`} value={money(totals.tax, currency)} /> : null}
            <Row label="Total" value={money(totals.total, currency)} strong />
          </div>
          <Button className="w-full" size="lg" disabled={busy || cart.length === 0} onClick={complete}>
            {busy ? "Saving…" : `Complete bill · ${money(totals.total, currency)}`}
          </Button>
          <p className="text-xs text-stone-500">Prices and stock are confirmed by the server. The bill will fail if an item runs out.</p>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-lg font-semibold" : "text-stone-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
