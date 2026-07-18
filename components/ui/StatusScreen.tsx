import { Check, Loader2, X } from "lucide-react";
import { ReactNode } from "react";

type Kind = "loading" | "success" | "error";

const styles: Record<Kind, { wrap: string; icon: ReactNode }> = {
  loading: {
    wrap: "bg-paperDark text-inkSoft",
    icon: <Loader2 size={20} strokeWidth={2.25} className="animate-spin" />,
  },
  success: {
    wrap: "bg-mossSoft text-[#3E5A2C]",
    icon: <Check size={20} strokeWidth={2.5} />,
  },
  error: {
    wrap: "bg-oxbloodSoft text-oxblood",
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
