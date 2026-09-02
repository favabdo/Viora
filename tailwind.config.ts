import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        paperDark: "rgb(var(--color-paperDark) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        surfaceSunken: "rgb(var(--color-surfaceSunken) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        inkSoft: "rgb(var(--color-inkSoft) / <alpha-value>)",
        inkFaint: "rgb(var(--color-inkFaint) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        lineStrong: "rgb(var(--color-lineStrong) / <alpha-value>)",
        teal: "rgb(var(--color-teal) / <alpha-value>)",
        tealDark: "rgb(var(--color-tealDark) / <alpha-value>)",
        tealSoft: "rgb(var(--color-tealSoft) / <alpha-value>)",
        sage: "rgb(var(--color-sage) / <alpha-value>)",
        sageSoft: "rgb(var(--color-sageSoft) / <alpha-value>)",
        clay: "rgb(var(--color-clay) / <alpha-value>)",
        claySoft: "rgb(var(--color-claySoft) / <alpha-value>)",
        amber: "rgb(var(--color-amber) / <alpha-value>)",
        amberSoft: "rgb(var(--color-amberSoft) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        sm: "5px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        xs: "0 1px 2px -1px rgb(var(--color-teal) / 0.12)",
        raised: "0 4px 14px -6px rgb(var(--color-teal) / 0.22)",
        panel: "var(--glass-shadow)",
        modal: "0 28px 56px -18px rgb(var(--color-teal) / 0.35), 0 8px 24px -8px rgba(15, 10, 30, 0.28)",
        glow: "var(--hover-glow)",
      },
      spacing: {
        4.5: "1.125rem",
        13: "3.25rem",
        15: "3.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
