import { Check, X } from "lucide-react";
import { ReactNode } from "react";
import { VioraLogoMark } from "@/components/ui/VioraSplash";

type Kind = "loading" | "success" | "error";

const styles: Record<Kind, { wrap: string; icon: ReactNode }> = {
  loading: {
    wrap: "",
    icon: null,
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
      {kind === "loading" ? (
        <div className="mx-auto mb-4 w-fit">
          <VioraLogoMark className="h-20 w-20" glowClass="-inset-6" />
        </div>
      ) : (
        <div className={`mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full ${s.wrap}`}>
          {s.icon}
        </div>
      )}
      <h1 className="font-display text-lg font-medium mb-1.5 text-ink">{title}</h1>
      {message && <p className="text-sm text-inkSoft leading-relaxed">{message}</p>}
      {children}
    </div>
  );
}
