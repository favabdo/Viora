"use client";

import { useOpenProfileCard } from "./ProfileCardContext";

/** اسم أي عضو، لما تدوس عليه بيفتح كارت بروفايله (اسمه، يوزره، إيميله، صورته) */
export default function ClickableName({
  userId,
  children,
  className = "",
}: {
  userId: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const openProfile = useOpenProfileCard();

  if (!userId) return <span className={className}>{children}</span>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openProfile(userId);
      }}
      className={`font-medium hover:text-bottle transition-colors underline decoration-dotted decoration-inkFaint/50 underline-offset-2 ${className}`}
    >
      {children}
    </button>
  );
}
