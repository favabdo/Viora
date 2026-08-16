"use client";

import { useCallback, useEffect, useState } from "react";

export type PendingItem = {
  id: number;
  kind: "new_task" | "change_request";
  taskText: string;
  customerName: string | null;
  requestedByName: string | null;
  requestedAt: string | null;
};

const POLL_INTERVAL_MS = 20000; // 20 ثانية - كفاية لتحديث العداد وهو التاب مفتوح

/**
 * بيراقب /api/rooms/pending كل POLL_INTERVAL_MS، وبيرجّع عدد الطلبات المعلّقة (لعرضه في badge).
 * التنبيه الفعلي (Push حقيقي بيوصل حتى لو التاب مقفول) بقى بيتبعت من السيرفر نفسه
 * (lib/webPush.ts) مش من هنا - الـ polling هنا غرضه بس تحديث العداد وهو التاب مفتوح.
 */
export function useRoomsPendingPoll(enabled: boolean = true) {
  const [pendingCount, setPendingCount] = useState(0);

  const poll = useCallback(async () => {
    if (!enabled) return;
    try {
      const authRes = await fetch("/api/rooms/auth");
      const authData = await authRes.json();
      if (!authData.unlocked) return;

      const res = await fetch("/api/rooms/pending");
      if (!res.ok) return;
      const data = await res.json();
      const items: PendingItem[] = data.items || [];
      setPendingCount(items.length);
    } catch {
      // فشل الاستعلام مؤقتًا - نتجاهله ونحاول تاني في الدورة الجاية
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setPendingCount(0);
      return;
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { pendingCount };
}
