import { cn } from "@/lib/utils";
import { HTMLAttributes, SelectHTMLAttributes, forwardRef } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-stone-200 bg-white p-5 shadow-sm", className)} {...props} />;
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-base text-stone-900 outline-none ring-teal-700/30 focus:ring-2",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "ok" | "warn" | "bad" | "info" }) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700",
    ok: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
    bad: "bg-red-50 text-red-800",
    info: "bg-teal-50 text-teal-800",
  };
  return (
    <span
      className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}
