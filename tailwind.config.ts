import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF6EC",
        paperDark: "#F1EADA",
        ink: "#20221F",
        inkSoft: "#54574F",
        line: "#D9D0BC",
        teal: "#1F6F72",
        tealDark: "#154F52",
        sage: "#6E8F5C",
        clay: "#B4552F",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 #D9D0BC, 0 2px 8px -2px rgba(32,34,31,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
