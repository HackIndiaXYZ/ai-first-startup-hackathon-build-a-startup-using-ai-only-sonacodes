import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-base text-stone-900 outline-none ring-teal-700/30 placeholder:text-stone-400 focus:ring-2",
          className,
        )}
        {...props}
      />
    );
  },
);
