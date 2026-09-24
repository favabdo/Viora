"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * الضغط المطوّل باللمس = الكليك اليمين على الماوس.
 * بيرجع props بتُفتح على حواف الإصبع (x, y) بعد `delay`ms،
 * وبيمنع الـ click اللي بيحصل لا إرادي بعد الرفع عشان ميفتحش عنصر تاني.
 */
export function useLongPress(onLongPress: ((x: number, y: number) => void) | undefined, delay = 500) {
  const cbRef = useRef(onLongPress);
  cbRef.current = onLongPress;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);
  const firedRef = useRef(false);

  const start = useCallback(
    (e: React.TouchEvent) => {
      if (!cbRef.current) return;
      movedRef.current = false;
      firedRef.current = false;
      const { clientX: x, clientY: y } = e.touches[0];
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (movedRef.current) return;
        firedRef.current = true;
        cbRef.current?.(x, y);
      }, delay);
    },
    [delay]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const move = useCallback(() => {
    movedRef.current = true;
    cancel();
  }, [cancel]);

  const clickCapture = useCallback((e: React.MouseEvent) => {
    if (firedRef.current) {
      firedRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return { onTouchStart: start, onTouchEnd: cancel, onTouchMove: move, onClickCapture: clickCapture };
}
