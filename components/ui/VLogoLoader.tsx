export default function VLogoLoader({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="status"
      aria-label="جارٍ التحميل"
      className={`text-teal shrink-0 ${className}`}
    >
      <path
        d="M16 14 L32 50 L48 14"
        stroke="currentColor"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={100}
        className="v-logo-draw"
      />
    </svg>
  );
}
