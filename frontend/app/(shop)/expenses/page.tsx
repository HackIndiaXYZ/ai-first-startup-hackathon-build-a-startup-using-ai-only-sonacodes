"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Expense, ExpenseCategory, PaymentMethod } from "@/lib/types";
import { EXPENSE_LABEL, money, PAYMENT_LABEL, dayLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, PageHeader } from "@/components/page-header";

export default function ExpensesPage() {
  const { token, business } = useAuth();
  const [rows, setRows] = useState<Expense[]>([]);
  const [category, setCategory] = useState<ExpenseCategory>("OTHER");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("CASH");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setRows(await api<Expense[]>("/api/v1/expenses", { token }));
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await api("/api/v1/expenses", {
        token,
        method: "POST",
        body: { category, amount, payment_method: payment, description, expense_date: date },
      });
      setAmount("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save expense.");
    }
  }

  const currency = business?.currency || "INR";

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <PageHeader title="Add expense" />
        <form onSubmit={onSubmit} className="space-y-3">
          <ErrorBanner message={error} />
          <Card className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                {Object.entries(EXPENSE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <Label>Paid by</Label>
              <Select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
                {Object.entries(PAYMENT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Note</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button className="w-full" size="lg">
              Save expense
            </Button>
          </Card>
        </form>
      </div>
      <div>
        <PageHeader title="Expenses" />
        <div className="space-y-3">
          {rows.length === 0 && <Card>No expenses yet.</Card>}
          {rows.map((row) => (
            <Card key={row.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{EXPENSE_LABEL[row.category]}</p>
                <p className="text-sm text-stone-500">
                  {dayLabel(row.expense_date)} · {PAYMENT_LABEL[row.payment_method]}
                  {row.description ? ` · ${row.description}` : ""}
                </p>
              </div>
              <p className="text-lg font-semibold">{money(row.amount, currency)}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
