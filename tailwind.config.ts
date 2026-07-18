import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF8F4",
        paperDark: "#F1EDE3",
        surface: "#FFFFFF",
        surfaceSunken: "#F6F3EC",
        ink: "#191A1D",
        inkSoft: "#585B60",
        inkFaint: "#95978F",
        line: "#E6E1D4",
        lineStrong: "#D3CCB8",
        teal: "#0E6E62",
        tealDark: "#0A4F47",
        tealSoft: "#E3EFEB",
        sage: "#5F8A52",
        sageSoft: "#EAF1E4",
        clay: "#AF4E2E",
        claySoft: "#F6E5DC",
        amber: "#B4801F",
        amberSoft: "#F6EAD3",
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
        xs: "0 1px 2px -1px rgba(25,26,29,0.08)",
        raised: "0 2px 6px -2px rgba(25,26,29,0.10)",
        panel: "0 8px 24px -8px rgba(25,26,29,0.16), 0 1px 3px -1px rgba(25,26,29,0.08)",
        modal: "0 24px 48px -16px rgba(25,26,29,0.32), 0 2px 8px -2px rgba(25,26,29,0.12)",
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
