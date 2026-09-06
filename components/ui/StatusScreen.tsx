import { Check, X } from "lucide-react";
import { ReactNode } from "react";
import VLogoLoader from "@/components/ui/VLogoLoader";

type Kind = "loading" | "success" | "error";

const styles: Record<Kind, { wrap: string; icon: ReactNode }> = {
  loading: {
    wrap: "bg-paperDark text-inkSoft",
    icon: <VLogoLoader size={22} className="text-teal" />,
  },
  success: {
    wrap: "bg-sageSoft text-[#3F6136]",
    icon: <Check size={20} strokeWidth={2.5} />,
  },
  error: {
    wrap: "bg-claySoft text-clay",
    icon: <X size={20} strokeWidth={2.5} />,
  },
};

export default function StatusScreen({
  kind,
  title,
  message,
  children,
}: {
  kind: Kind;
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  const s = styles[kind];
  return (
    <div className="text-center">
      <div className={`mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full ${s.wrap}`}>
        {s.icon}
      </div>
      <h1 className="font-display text-lg font-medium mb-1.5 text-ink">{title}</h1>
      {message && <p className="text-sm text-inkSoft leading-relaxed">{message}</p>}
      {children}
    </div>
  );
}
