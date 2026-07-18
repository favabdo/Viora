export function SkeletonRow({ width = "100%" }: { width?: string }) {
  return <div className="skeleton h-4 rounded-sm" style={{ width }} />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-line/70 border-t border-b border-line">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="skeleton h-[18px] w-[18px] rounded-md shrink-0" />
          <div className="skeleton h-3.5 rounded-sm flex-1" style={{ maxWidth: `${70 - i * 12}%` }} />
        </li>
      ))}
    </ul>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-line rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="skeleton h-6 w-6 rounded-md shrink-0" />
            <div className="skeleton h-3 w-24 rounded-sm" />
          </div>
          <div className="skeleton h-3 w-full rounded-sm mb-1.5" />
          <div className="skeleton h-3 w-2/3 rounded-sm" />
        </div>
      ))}
    </div>
  );
}
