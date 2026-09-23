"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Category, Product } from "@/lib/types";
import { money, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default function ProductsPage() {
  const { token, business } = useAuth();
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [archived, setArchived] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!token) return;
    api<Category[]>("/api/v1/categories", { token }).then(setCategories);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      api<Product[]>("/api/v1/products", {
        token,
        query: {
          q: q || undefined,
          category_id: categoryId || undefined,
          include_archived: archived,
          active: archived ? undefined : true,
        },
      }).then(setProducts);
    }, 200);
    return () => clearTimeout(t);
  }, [token, q, categoryId, archived]);

  const currency = business?.currency || "INR";
  const cats = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Search, add, and keep stock in view."
        action={
          <Link href="/products/new">
            <Button>Add product</Button>
          </Link>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input placeholder="Search name, SKU, barcode" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex h-12 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          Show archived
        </label>
      </div>
      <div className="grid gap-3">
        {products.length === 0 && <Card>No products yet. Add your first item.</Card>}
        {products.map((p) => {
          const stock = Number(p.current_stock);
          const low = p.minimum_stock && stock > 0 && stock <= Number(p.minimum_stock);
          const out = stock <= 0;
          return (
            <Link key={p.id} href={`/products/${p.id}`}>
              <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:border-teal-200">
                <div>
                  <p className="text-lg font-semibold">{p.name}</p>
                  <p className="text-sm text-stone-500">
                    {p.sku ? `SKU ${p.sku}` : p.unit}
                    {p.category_id && cats[p.category_id] ? ` · ${cats[p.category_id]}` : ""}
                    {!p.active ? " · Archived" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg font-semibold">{money(p.selling_price, currency)}</p>
                  {out ? <Badge tone="bad">Out of stock</Badge> : low ? <Badge tone="warn">Low stock</Badge> : null}
                  <p className="min-w-20 text-right text-stone-700">
                    {qty(p.current_stock)} {p.unit}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
