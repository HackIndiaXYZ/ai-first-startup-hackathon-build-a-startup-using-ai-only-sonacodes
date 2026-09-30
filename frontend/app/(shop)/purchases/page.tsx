"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Purchase } from "@/lib/types";
import { money, when } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default function PurchasesPage() {
  const { token, business } = useAuth();
  const [rows, setRows] = useState<Purchase[]>([]);

  useEffect(() => {
    if (!token) return;
    api<Purchase[]>("/api/v1/purchases", { token }).then(setRows);
  }, [token]);

  const currency = business?.currency || "INR";

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Stock goes up automatically when you save a purchase."
        action={
          <Link href="/purchases/new">
            <Button>Record purchase</Button>
          </Link>
        }
      />
      <div className="space-y-3">
        {rows.length === 0 && <Card>No purchases yet.</Card>}
        {rows.map((p) => (
          <Card key={p.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{p.supplier_name || "Supplier"}</p>
              <p className="text-sm text-stone-500">
                {p.invoice_number ? `${p.invoice_number} · ` : ""}
                {when(p.created_at)}
              </p>
            </div>
            <p className="text-lg font-semibold">{money(p.total, currency)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
