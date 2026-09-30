"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Product, ProductHistory } from "@/lib/types";
import { money, qty, STOCK_LABEL, when } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/product-form";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, business } = useAuth();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<ProductHistory | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qtyAdj, setQtyAdj] = useState("-1");
  const [reason, setReason] = useState("");
  const [type, setType] = useState("ADJUSTMENT");

  async function load() {
    if (!token) return;
    const p = await api<Product>(`/api/v1/products/${id}`, { token });
    const h = await api<ProductHistory>(`/api/v1/products/${id}/history`, { token });
    setProduct(p);
    setHistory(h);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Not found."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  if (!product) return <ErrorBanner message={error || "Loading…"} />;
  const currency = business?.currency || "INR";
  const stock = Number(product.current_stock);

  return (
    <div>
      <PageHeader
        title={product.name}
        subtitle={`${qty(product.current_stock)} ${product.unit} in stock`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(!editing)}>
              {editing ? "Close edit" : "Edit"}
            </Button>
            <Button
              variant={product.active ? "danger" : "secondary"}
              onClick={async () => {
                if (!token) return;
                await api(`/api/v1/products/${product.id}`, {
                  token,
                  method: "PATCH",
                  body: { active: !product.active },
                });
                await load();
              }}
            >
              {product.active ? "Archive" : "Restore"}
            </Button>
          </div>
        }
      />
      <ErrorBanner message={error} />
      {editing ? (
        <ProductForm
          product={product}
          onSaved={async () => {
            setEditing(false);
            await load();
          }}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <p className="text-sm text-stone-500">Selling price</p>
              <p className="text-2xl font-semibold">{money(product.selling_price, currency)}</p>
            </Card>
            <Card>
              <p className="text-sm text-stone-500">Purchase price</p>
              <p className="text-2xl font-semibold">{money(product.purchase_price, currency)}</p>
            </Card>
            <Card>
              <p className="text-sm text-stone-500">Stock</p>
              <p className="text-2xl font-semibold">
                {qty(product.current_stock)} {product.unit}
              </p>
              {stock <= 0 ? <Badge tone="bad">Out of stock</Badge> : null}
            </Card>
          </div>
          {Object.keys(product.custom_fields || {}).length > 0 && (
            <Card className="mt-4">
              <h2 className="font-semibold">Extra details</h2>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {Object.entries(product.custom_fields).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-sm text-stone-500">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          <Card className="mt-4 space-y-3">
            <h2 className="font-semibold">Adjust stock</h2>
            <p className="text-sm text-stone-500">Use a minus for damage or expiry. This creates a stock movement.</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <Label>Quantity</Label>
                <Input value={qtyAdj} onChange={(e) => setQtyAdj(e.target.value)} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="ADJUSTMENT">Adjustment</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="EXPIRY">Expiry</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
            <Button
              onClick={async () => {
                if (!token) return;
                setError(null);
                try {
                  await api("/api/v1/stock/adjustments", {
                    token,
                    method: "POST",
                    body: { product_id: product.id, quantity: qtyAdj, transaction_type: type, reason },
                  });
                  await load();
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "Could not adjust stock.");
                }
              }}
            >
              Record adjustment
            </Button>
          </Card>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <History title="Stock history" rows={history?.stock.map((t) => `${STOCK_LABEL[t.transaction_type]} ${qty(t.quantity)} · ${when(t.created_at)}`) || []} />
            <History
              title="Sales"
              rows={history?.sales.map((s) => `${s.invoice_number} · ${qty(s.quantity)} · ${money(s.total, currency)}`) || []}
              onClick={(i) => history && router.push(`/sales/${history.sales[i].sale_id}`)}
            />
            <History title="Purchases" rows={history?.purchases.map((p) => `${qty(p.quantity)} @ ${money(p.unit_cost, currency)}`) || []} />
          </div>
        </>
      )}
    </div>
  );
}

function History({ title, rows, onClick }: { title: string; rows: string[]; onClick?: (i: number) => void }) {
  return (
    <Card>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.length === 0 && <li className="text-stone-500">None yet</li>}
        {rows.map((row, i) => (
          <li key={i}>
            {onClick ? (
              <button className="text-left text-teal-800" onClick={() => onClick(i)}>
                {row}
              </button>
            ) : (
              row
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
