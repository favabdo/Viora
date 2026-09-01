"use client";

import { useOpenProfileCard } from "./ProfileCardContext";

/** اسم عضو. الكارت بيتفتح بس لو `previewCard` (من جوه تاسك). */
export default function ClickableName({
  userId,
  children,
  className = "",
  previewCard = false,
}: {
  userId: string | null | undefined;
  children: React.ReactNode;
  className?: string;
  previewCard?: boolean;
}) {
  const openProfile = useOpenProfileCard();

  if (!userId || !previewCard) return <span className={className}>{children}</span>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openProfile(userId);
      }}
      className={`font-medium hover:text-teal transition-colors underline decoration-dotted decoration-inkFaint/50 underline-offset-2 ${className}`}
    >
      {children}
    </button>
  );
}
