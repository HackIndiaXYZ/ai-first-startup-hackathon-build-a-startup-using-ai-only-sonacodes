"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Business, Category, CustomField } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner, PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  const { token, business, refreshBusiness, signOut } = useAuth();
  const [form, setForm] = useState<Partial<Business>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newField, setNewField] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (business) setForm(business);
  }, [business]);

  useEffect(() => {
    if (!token) return;
    api<Category[]>("/api/v1/categories", { token }).then(setCategories);
    api<CustomField[]>("/api/v1/custom-fields", { token }).then(setFields);
  }, [token]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSaved(false);
    try {
      await api("/api/v1/business", {
        token,
        method: "PATCH",
        body: {
          name: form.name,
          address: form.address,
          phone: form.phone,
          email: form.email,
          tax_enabled: form.tax_enabled,
          tax_rate: form.tax_rate,
          tax_number: form.tax_number,
          invoice_prefix: form.invoice_prefix,
          invoice_thank_you: form.invoice_thank_you,
          currency: form.currency,
        },
      });
      await refreshBusiness();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save settings.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="Settings" subtitle="Shop, tax, invoices, categories." />
      <ErrorBanner message={error} />
      <form onSubmit={save} className="space-y-4">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Shop</h2>
          <div>
            <Label>Name</Label>
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Address</Label>
            <Textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>Currency</Label>
            <Input value={form.currency || "INR"} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
        </Card>
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Tax & invoices</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(form.tax_enabled)}
              onChange={(e) => setForm({ ...form, tax_enabled: e.target.checked })}
            />
            Add tax on bills
          </label>
          <div>
            <Label>Tax rate %</Label>
            <Input value={String(form.tax_rate ?? "0")} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
          </div>
          <div>
            <Label>Tax number</Label>
            <Input value={form.tax_number || ""} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} />
          </div>
          <div>
            <Label>Invoice prefix</Label>
            <Input value={form.invoice_prefix || "INV"} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} />
          </div>
          <div>
            <Label>Thank-you line</Label>
            <Input value={form.invoice_thank_you || ""} onChange={(e) => setForm({ ...form, invoice_thank_you: e.target.value })} />
          </div>
        </Card>
        <Button size="lg">{saved ? "Saved" : "Save settings"}</Button>
      </form>

      <Card>
        <h2 className="text-lg font-semibold">Categories</h2>
        <ul className="mt-3 space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>{c.name}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!token) return;
                  await api(`/api/v1/categories/${c.id}`, { token, method: "DELETE" });
                  setCategories((prev) => prev.filter((x) => x.id !== c.id));
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Groceries" />
          <Button
            onClick={async () => {
              if (!token || !newCat.trim()) return;
              const created = await api<Category>("/api/v1/categories", { token, method: "POST", body: { name: newCat } });
              setCategories((prev) => [...prev, created]);
              setNewCat("");
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Custom fields</h2>
        <p className="text-sm text-stone-500">Shows on every product, e.g. size, colour, brand.</p>
        <ul className="mt-3 space-y-2">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center justify-between">
              <span>{f.name}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!token) return;
                  await api(`/api/v1/custom-fields/${f.id}`, { token, method: "DELETE" });
                  setFields((prev) => prev.filter((x) => x.id !== f.id));
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input value={newField} onChange={(e) => setNewField(e.target.value)} placeholder="e.g. Brand" />
          <Button
            onClick={async () => {
              if (!token || !newField.trim()) return;
              const created = await api<CustomField>("/api/v1/custom-fields", {
                token,
                method: "POST",
                body: { name: newField },
              });
              setFields((prev) => [...prev, created]);
              setNewField("");
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      <Button variant="secondary" onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  );
}
