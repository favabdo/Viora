"use client";

import Avatar from "./ui/Avatar";
import { useOpenProfileCard } from "./ProfileCardContext";

export default function ClickableAvatar({
  userId,
  name,
  src,
  size = "md",
  className = "",
}: {
  userId: string | null | undefined;
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const openProfile = useOpenProfileCard();

  if (!userId) {
    return <Avatar name={name} src={src} size={size} className={className} />;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openProfile(userId);
      }}
      className="rounded-full shrink-0 hover:opacity-90 transition-opacity"
      aria-label={name}
    >
      <Avatar name={name} src={src} size={size} className={className} />
    </button>
  );
}
