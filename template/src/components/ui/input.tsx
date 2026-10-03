import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-gray-400",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
