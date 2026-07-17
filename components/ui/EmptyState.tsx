import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export default function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-paperDark text-inkFaint">
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <p className="text-sm text-inkSoft">{title}</p>
      {hint && <p className="text-xs text-inkFaint mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
