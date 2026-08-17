"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * بنعمل render للمودال جوه document.body مباشرة (مش في مكانه في الشجرة) باستخدام
 * React Portal. ده مهم عشان أي عنصر أب عليه transform/filter (زي أي حاجة معمولها
 * blur أو fade-in animation) بيعمل "containing block" جديد لأي عنصر جواه بـ
 * position: fixed - وده بيخلي المودال يظهر في مكان غلط أو يخرج بره حدود الشاشة
 * على الموبايل بدل ما يتوسط الشاشة كلها زي المفروض.
 */
export default function Modal({
  onClose,
  children,
  maxWidth = "max-w-sm",
}: {
  onClose?: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-ink/50 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-paper border border-line rounded-lg shadow-modal w-full p-5 max-h-[85vh] overflow-y-auto thin-scroll ${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
