import type { ExpenseCategory, PaymentMethod, StockTxnType } from "./types";

export function money(value: string | number | null | undefined, currency = "INR") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function qty(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

export function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CREDIT: "Credit",
};

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  SALARY: "Salary",
  TRANSPORT: "Transport",
  PACKAGING: "Packaging",
  MARKETING: "Marketing",
  OTHER: "Other",
};

export const STOCK_LABEL: Record<StockTxnType, string> = {
  OPENING: "Opening",
  PURCHASE: "Purchase",
  SALE: "Sale",
  RETURN: "Return",
  ADJUSTMENT: "Adjustment",
  DAMAGE: "Damage",
  EXPIRY: "Expiry",
};
