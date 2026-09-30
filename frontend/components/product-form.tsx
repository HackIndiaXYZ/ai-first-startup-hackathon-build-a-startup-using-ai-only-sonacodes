"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Category, CustomField, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/page-header";

type Props = { product?: Product; onSaved?: () => void };

export function ProductForm({ product, onSaved }: Props) {
  const { token } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: product?.name || "",
    description: product?.description || "",
    sku: product?.sku || "",
    barcode: product?.barcode || "",
    category_id: product?.category_id || "",
    unit: product?.unit || "pc",
    selling_price: product?.selling_price || "",
    purchase_price: product?.purchase_price || "",
    minimum_stock: product?.minimum_stock || "0",
    opening_stock: "",
    custom_fields: product?.custom_fields || ({} as Record<string, string>),
  });

  useEffect(() => {
    if (!token) return;
    api<Category[]>("/api/v1/categories", { token }).then(setCategories);
    api<CustomField[]>("/api/v1/custom-fields", { token }).then(setFields);
  }, [token]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      name: form.name,
      description: form.description || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      category_id: form.category_id || null,
      unit: form.unit,
      selling_price: form.selling_price,
      purchase_price: form.purchase_price || "0",
      minimum_stock: form.minimum_stock || "0",
      custom_fields: form.custom_fields,
    };
    try {
      if (product) {
        await api(`/api/v1/products/${product.id}`, { token, method: "PATCH", body });
        onSaved?.();
      } else {
        if (form.opening_stock) body.opening_stock = form.opening_stock;
        const created = await api<Product>("/api/v1/products", { token, method: "POST", body });
        router.push(`/products/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save product.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4">
      <ErrorBanner message={error} />
      <Card className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Selling price</Label>
            <Input type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} required />
          </div>
          <div>
            <Label>Purchase price</Label>
            <Input type="number" step="0.01" min="0" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Unit</Label>
            <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} />
          </div>
          <div>
            <Label>Low stock at</Label>
            <Input type="number" step="0.001" min="0" value={form.minimum_stock} onChange={(e) => set("minimum_stock", e.target.value)} />
          </div>
          {!product && (
            <div>
              <Label>Opening stock</Label>
              <Input type="number" step="0.001" min="0" value={form.opening_stock} onChange={(e) => set("opening_stock", e.target.value)} />
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} />
          </div>
          <div>
            <Label>Barcode</Label>
            <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        {fields.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.id}>
                <Label>{field.name}</Label>
                <Input
                  value={form.custom_fields[field.name] || ""}
                  onChange={(e) => set("custom_fields", { ...form.custom_fields, [field.name]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
      <Button className="w-full" size="lg" disabled={busy}>
        {busy ? "Saving…" : product ? "Save changes" : "Add product"}
      </Button>
    </form>
  );
}
