export default function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 rounded-full bg-paperDark overflow-hidden">
        <div
          className="h-full rounded-full bg-sage transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-2xs font-mono text-inkFaint tabular-nums">
        {value}/{total}
      </span>
    </div>
  );
}
