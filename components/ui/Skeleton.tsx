export function SkeletonRow({ width = "100%" }: { width?: string }) {
  return <div className="skeleton h-4 rounded-sm" style={{ width }} />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-line/70 border-t border-b border-line">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="skeleton h-[18px] w-[18px] rounded-sm shrink-0" />
          <div className="skeleton h-3.5 rounded-sm flex-1" style={{ maxWidth: `${70 - i * 12}%` }} />
        </li>
      ))}
    </ul>
  );
}
