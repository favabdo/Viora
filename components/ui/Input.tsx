import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-lg border border-[#2D2F39] bg-[#12141c] px-3 py-2.5 text-sm text-ink placeholder:text-inkFaint outline-none transition-colors focus:border-[#8C3AED] focus:ring-2 focus:ring-[#8C3AED]/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} className={`${fieldClass} ${className}`} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => (
    <textarea ref={ref} className={`${fieldClass} resize-none ${className}`} {...props} />
  )
);
Textarea.displayName = "Textarea";
