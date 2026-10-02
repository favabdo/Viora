"use client";

import { useEffect, type RefObject } from "react";

export function useRevealPanelOnMobile(ref: RefObject<HTMLElement | null>, selectedTaskId: string | null) {
  useEffect(() => {
    if (!selectedTaskId) return;
    if (window.matchMedia("(max-width: 1279px)").matches) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedTaskId, ref]);
}
