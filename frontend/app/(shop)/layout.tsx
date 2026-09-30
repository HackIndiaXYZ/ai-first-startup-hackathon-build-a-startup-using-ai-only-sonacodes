import { ShopGuard } from "@/components/shop-guard";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <ShopGuard>{children}</ShopGuard>;
}
