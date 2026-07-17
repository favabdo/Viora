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
  "inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-teal text-paper hover:bg-tealDark",
  secondary: "bg-transparent text-ink border border-line hover:border-lineStrong hover:bg-paperDark",
  ghost: "bg-transparent text-inkSoft hover:text-ink hover:bg-paperDark",
  danger: "bg-transparent text-clay border border-clay/30 hover:bg-claySoft",
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
