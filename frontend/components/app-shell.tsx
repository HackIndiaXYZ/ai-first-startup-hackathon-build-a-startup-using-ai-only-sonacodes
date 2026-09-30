"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  Warehouse,
  Wallet,
  Sunset,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/sell", label: "New Bill", icon: ShoppingCart },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stock", label: "Stock", icon: Warehouse },
  { href: "/sales", label: "Bills", icon: Receipt },
  { href: "/purchases", label: "Purchases", icon: Plus },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/closing", label: "Close day", icon: Sunset },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/sell", label: "Bill", icon: ShoppingCart },
  { href: "/stock", label: "Stock", icon: Warehouse },
  { href: "/products", label: "Items", icon: Package },
  { href: "/settings", label: "More", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { business, signOut, user } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-stone-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-stone-200 bg-white p-4 lg:flex lg:flex-col">
        <div className="px-2 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Shop OS</p>
          <p className="mt-1 truncate text-lg font-semibold text-stone-900">{business?.name || "Your shop"}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => {
            const active = path === item.href || path.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium",
                  active ? "bg-teal-700 text-white" : "text-stone-700 hover:bg-stone-100",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-stone-200 pt-4">
          <p className="truncate px-2 text-sm text-stone-500">{user?.email}</p>
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Shop OS</p>
          <p className="font-semibold text-stone-900">{business?.name || "Your shop"}</p>
        </div>
        <Link href="/sell">
          <Button size="sm">New Bill</Button>
        </Link>
      </header>

      <main className="px-4 pb-28 pt-4 lg:ml-64 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-stone-200 bg-white px-1 py-2 lg:hidden">
        {MOBILE.map((item) => {
          const active = path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-1 text-xs font-medium",
                active ? "text-teal-800" : "text-stone-500",
              )}
            >
              <Icon className={cn("h-6 w-6", item.href === "/sell" && "text-amber-600")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
