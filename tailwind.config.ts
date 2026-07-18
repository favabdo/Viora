import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Parchment / ink ground
        paper: "#F1ECDE",
        paperDark: "#E6DEC5",
        surface: "#FFFFFF",
        surfaceSunken: "#F5F0E2",
        ink: "#211D17",
        inkSoft: "#6E6656",
        inkFaint: "#A29A85",
        line: "#DBD2B9",
        lineStrong: "#C2B695",

        // Fountain-pen ink — primary action, the one color that carries weight
        bottle: "#234B3B",
        bottleDark: "#15332A",
        bottleSoft: "#E2E9DE",

        // Moss — secondary confirmation state (accepted, success)
        moss: "#55693E",
        mossSoft: "#E8ECDA",

        // Oxblood — the only red in the system, reserved for destructive/error
        oxblood: "#7A2E28",
        oxbloodSoft: "#F0DED8",

        // Brass — warm highlight, used sparingly for pending/attention states
        brass: "#9C6B2E",
        brassSoft: "#F0E3CB",
      },
      fontFamily: {
        display: ["var(--font-newsreader)", "serif"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "10px",
        xl: "14px",
      },
      boxShadow: {
        xs: "0 1px 2px -1px rgba(33,29,23,0.10)",
        raised: "0 3px 8px -3px rgba(33,29,23,0.12)",
        panel: "0 10px 28px -10px rgba(33,29,23,0.18), 0 1px 3px -1px rgba(33,29,23,0.08)",
        modal: "0 28px 56px -18px rgba(33,29,23,0.34), 0 2px 8px -2px rgba(33,29,23,0.14)",
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
