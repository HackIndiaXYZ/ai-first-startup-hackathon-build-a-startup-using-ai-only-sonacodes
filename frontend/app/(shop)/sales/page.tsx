"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Sale } from "@/lib/types";
import { money, PAYMENT_LABEL, when } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default function SalesPage() {
  const { token, business } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    if (!token) return;
    api<Sale[]>("/api/v1/sales", { token }).then(setSales);
  }, [token]);

  const currency = business?.currency || "INR";

  return (
    <div>
      <PageHeader
        title="Bills"
        action={
          <Link href="/sell">
            <Button>New Bill</Button>
          </Link>
        }
      />
      <div className="space-y-3">
        {sales.length === 0 && <Card>No bills yet.</Card>}
        {sales.map((s) => (
          <Link key={s.id} href={`/sales/${s.id}`}>
            <Card className="flex items-center justify-between hover:border-teal-200">
              <div>
                <p className="font-semibold">{s.invoice_number}</p>
                <p className="text-sm text-stone-500">{when(s.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{money(s.total, currency)}</p>
                <Badge tone="info">{PAYMENT_LABEL[s.payment_method]}</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
