import { ReactNode } from "react";

type Tone = "neutral" | "bottle" | "moss" | "oxblood" | "brass";

const tones: Record<Tone, string> = {
  neutral: "bg-paperDark text-inkSoft",
  bottle: "bg-bottleSoft text-bottleDark",
  moss: "bg-mossSoft text-[#3E5A2C]",
  oxblood: "bg-oxbloodSoft text-oxblood",
  brass: "bg-brassSoft text-brass",
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
