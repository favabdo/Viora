import { ReactNode } from "react";

type Tone = "neutral" | "teal" | "sage" | "clay";

const tones: Record<Tone, string> = {
  neutral: "bg-paperDark text-inkSoft",
  teal: "bg-tealSoft text-tealDark",
  sage: "bg-sageSoft text-[#4B6640]",
  clay: "bg-claySoft text-clay",
};

export default function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-2xs font-medium leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
