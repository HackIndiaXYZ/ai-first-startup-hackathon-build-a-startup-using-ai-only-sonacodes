import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-24 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base text-stone-900 outline-none ring-teal-700/30 placeholder:text-stone-400 focus:ring-2",
          className,
        )}
        {...props}
      />
    );
  },
);
