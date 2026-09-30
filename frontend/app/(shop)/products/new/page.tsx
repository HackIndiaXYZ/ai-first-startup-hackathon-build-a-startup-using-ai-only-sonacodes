"use client";

import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return (
    <div>
      <PageHeader title="Add product" subtitle="Prices and opening stock are saved on the server." />
      <ProductForm />
    </div>
  );
}
