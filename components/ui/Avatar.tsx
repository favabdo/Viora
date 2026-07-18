function initialsOf(name: string) {
  return (name || "؟").trim().charAt(0).toUpperCase();
}

const sizes = {
  sm: "h-6 w-6 text-2xs",
  md: "h-9 w-9 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

export default function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover border border-line shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      className={`${sizes[size]} rounded-full bg-bottleSoft text-bottleDark flex items-center justify-center font-display font-medium shrink-0 ${className}`}
    >
      {initialsOf(name)}
    </div>
  );
}
