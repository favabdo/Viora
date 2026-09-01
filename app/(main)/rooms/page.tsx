"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RoomsSection from "@/components/RoomsSection";
import { useAppSession } from "@/components/AppSession";

function RoomsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAppSession();
  const filter = searchParams.get("filter");
  const initial = filter === "pending" || filter === "all" ? filter : "open";

  return (
    <RoomsSection
      currentUserId={session.user.id}
      initialFilter={initial}
      onFilterChange={(next) => {
        router.replace(next === "open" ? "/rooms" : `/rooms?filter=${next}`);
      }}
    />
  );
}

export default function RoomsPage() {
  return (
    <Suspense fallback={null}>
      <RoomsPageInner />
    </Suspense>
  );
}
