"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-200 rounded-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

const variants: Record<Variant, string> = {
  primary:
    "text-white bg-gradient-to-r from-[#8b5cf6] via-[#7c5cff] to-[#6366f1] shadow-[0_8px_22px_-8px_rgba(124,92,255,0.85)] hover:shadow-[0_12px_28px_-6px_rgba(124,92,255,0.95)] hover:-translate-y-0.5",
  secondary: "bg-transparent text-ink border border-line hover:border-teal/50 hover:bg-tealSoft hover:shadow-glow",
  ghost: "bg-transparent text-inkSoft hover:text-ink hover:bg-tealSoft",
  danger: "bg-[#E85D4C] text-white hover:bg-[#d14e3e]",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5",
  md: "text-sm px-3.5 py-2",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "secondary", size = "md", loading, fullWidth, className = "", disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" size={size === "sm" ? 13 : 15} strokeWidth={2.5} />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;
