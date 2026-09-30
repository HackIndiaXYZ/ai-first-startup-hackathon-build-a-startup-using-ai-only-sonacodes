import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

const variants = {
  primary:
    "bg-teal-700 text-white hover:bg-teal-800 shadow-sm disabled:bg-teal-700/50",
  secondary:
    "bg-white text-stone-800 border border-stone-200 hover:bg-stone-50 disabled:opacity-50",
  ghost: "bg-transparent text-stone-700 hover:bg-stone-100",
  danger: "bg-red-700 text-white hover:bg-red-800",
  accent: "bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold",
};

const sizes = {
  md: "h-12 px-5 text-base",
  lg: "h-14 px-6 text-lg",
  sm: "h-10 px-3 text-sm",
  icon: "h-12 w-12",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
