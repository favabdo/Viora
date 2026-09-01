"use client";

import AppFrame from "@/components/AppFrame";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
