export type PaymentMethod = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "CREDIT";
export type PaymentStatus = "PAID" | "PARTIAL" | "CREDIT";
export type StockTxnType =
  | "OPENING"
  | "PURCHASE"
  | "SALE"
  | "RETURN"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "EXPIRY";
export type ExpenseCategory =
  | "RENT"
  | "ELECTRICITY"
  | "SALARY"
  | "TRANSPORT"
  | "PACKAGING"
  | "MARKETING"
  | "OTHER";

export type Business = {
  id: string;
  name: string;
  business_type: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  currency: string;
  tax_enabled: boolean;
  tax_rate: string;
  tax_number: string | null;
  invoice_prefix: string;
  invoice_thank_you: string | null;
  role?: string;
};

export type Category = { id: string; name: string; created_at: string };
export type CustomField = { id: string; name: string; created_at: string };

export type Product = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  unit: string;
  selling_price: string;
  purchase_price: string;
  minimum_stock: string;
  active: boolean;
  custom_fields: Record<string, string>;
  current_stock: string;
  created_at: string;
  updated_at: string;
};

export type StockTxn = {
  id: string;
  product_id: string;
  product_name?: string;
  transaction_type: StockTxnType;
  quantity: string;
  unit_cost: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax: string;
  total: string;
};

export type Sale = {
  id: string;
  invoice_number: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  items: SaleItem[];
};

export type PurchaseItem = {
  id: string;
  product_id: string;
  quantity: string;
  unit_cost: string;
  tax: string;
  total: string;
};

export type Purchase = {
  id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  subtotal: string;
  tax: string;
  total: string;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  items: PurchaseItem[];
};

export type Expense = {
  id: string;
  category: ExpenseCategory;
  amount: string;
  payment_method: PaymentMethod;
  description: string | null;
  expense_date: string;
  created_at: string;
};

export type Dashboard = {
  business_date: string;
  sales_total: string;
  bills_count: number;
  purchases_total: string;
  expenses_total: string;
  low_stock_count: number;
  out_of_stock_count: number;
  stock_value: string;
  top_products: { product_id: string; name: string; quantity: string; amount: string }[];
  recent_transactions: StockTxn[];
};

export type ClosingPreview = {
  business_date: string;
  already_closed: boolean;
  opening_stock_value: string;
  purchases_value: string;
  sales_value: string;
  expenses_value: string;
  adjustments_value: string;
  closing_stock_value: string;
  total_units: string;
  previous_closing_date: string | null;
};

export type StockOverview = {
  stock_value: string;
  low_stock_count: number;
  out_of_stock_count: number;
  items: {
    product_id: string;
    name: string;
    unit: string;
    quantity: string;
    minimum_stock: string;
    purchase_price: string;
    value: string;
    status: "ok" | "low" | "out";
  }[];
  recent: StockTxn[];
};

export type ProductHistory = {
  stock: StockTxn[];
  sales: {
    sale_id: string;
    invoice_number: string;
    quantity: string;
    total: string;
    created_at: string;
  }[];
  purchases: {
    id: string;
    purchase_id: string;
    quantity: string;
    unit_cost: string;
    total: string;
  }[];
};
