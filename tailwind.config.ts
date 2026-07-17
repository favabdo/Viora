import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF6EC",
        paperDark: "#F1EADA",
        surface: "#FFFFFF",
        ink: "#20221F",
        inkSoft: "#54574F",
        inkFaint: "#8B8A7F",
        line: "#D9D0BC",
        lineStrong: "#C7BC9F",
        teal: "#1F6F72",
        tealDark: "#154F52",
        tealSoft: "#E4EFEC",
        sage: "#6E8F5C",
        sageSoft: "#EBF0E5",
        clay: "#B4552F",
        claySoft: "#F6E7DE",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
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
        raised: "0 2px 6px -2px rgba(32,34,31,0.10)",
        modal: "0 24px 48px -16px rgba(32,34,31,0.30), 0 2px 8px -2px rgba(32,34,31,0.10)",
      },
      spacing: {
        4.5: "1.125rem",
      },
    },
  },
  plugins: [],
};
export default config;
