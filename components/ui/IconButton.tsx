"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Tone = "default" | "danger" | "active";
type Size = "sm" | "md";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
  "aria-label": string;
}

const tones: Record<Tone, string> = {
  default: "text-inkSoft hover:text-ink hover:bg-paperDark",
  danger: "text-inkSoft hover:text-oxblood hover:bg-oxbloodSoft",
  active: "text-bottle bg-bottleSoft hover:text-bottleDark hover:bg-bottleSoft",
};

const sizes: Record<Size, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tone = "default", size = "md", className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-md transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed ${tones[tone]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";

export default IconButton;
