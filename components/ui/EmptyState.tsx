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
    <div className="flex flex-col items-center text-center py-14 px-4">
      <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-full bg-paperDark text-inkFaint">
        <Icon size={17} strokeWidth={1.75} />
      </div>
      <p className="text-sm text-inkSoft font-medium">{title}</p>
      {hint && <p className="text-xs text-inkFaint mt-1 max-w-xs leading-relaxed">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
