import { ReactNode } from "react";

type Tone = "neutral" | "teal" | "sage" | "clay" | "amber";

const tones: Record<Tone, string> = {
  neutral: "bg-paperDark text-inkSoft",
  teal: "bg-tealSoft text-tealDark",
  sage: "bg-sageSoft text-[#3F6136]",
  clay: "bg-claySoft text-clay",
  amber: "bg-amberSoft text-amber",
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
