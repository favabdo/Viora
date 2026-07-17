"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import UserProfileCard from "./UserProfileCard";

const Ctx = createContext<(userId: string) => void>(() => {});

/** نادِ على الدالة دي بمعرّف أي مستخدم عشان تفتح كارت البروفايل بتاعه (اسمه، يوزره، إيميله، صورته) */
export function useOpenProfileCard() {
  return useContext(Ctx);
}

export default function ProfileCardProvider({
  children,
  currentUserId,
}: {
  children: ReactNode;
  currentUserId: string;
}) {
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  return (
    <Ctx.Provider value={setOpenUserId}>
      {children}
      {openUserId && (
        <UserProfileCard
          userId={openUserId}
          currentUserId={currentUserId}
          onClose={() => setOpenUserId(null)}
        />
      )}
    </Ctx.Provider>
  );
}
