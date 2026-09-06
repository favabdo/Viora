"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/*
 * سبلاش شعار Viora — بيظهر في أي مكان فيه تحميل:
 * الأجزاء بتتجمّع بتوقيتات مختلفة (أزرق 0s، بنفسجي 0.15s، مثلث 0.3s، توهج 0.6s)
 * وبعدين خط سماوي بيعدي على الحواف + نبضة تكبير 5% — زي سبلاش Apple وLinear.
 * الخروج بـ fade لما التحميل يخلص (لازم يكون جوه <AnimatePresence>).
 */

// إبقاء حالة التحميل ظاهرة مدة أدنى عشان تسلسل الرسم يبان (ظهور المحتوى عند 1.2s)
// المؤقت يبدأ مع تركيب المكوّن ومش بيتلغى لما التحميل يخلص بسرعة
export function useMinLoading(loading: boolean, ms = 1200) {
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), ms);
    return () => clearTimeout(t);
  }, [ms]);

  return loading || !minElapsed;
}

// الهندسة مستخرجة من public/logo-icon.png بكسل-بكسل (Convex Hull لكل لون)
// النقاط مدفوعة 5px ناحية المركز عشان تعويض نمو الـ stroke (width 10) — فالحد النهائي يطابق الأصل
const SHAPES = [
  // الشكل الأزرق — ذراع الشمال، نهايته السفلى مقطوعة بزاوية مايلة
  {
    points: "15,76 144,72 272,268 200,384",
    fill: "url(#vioraBlue)",
    from: { x: -150, opacity: 0 },
  },
  // الشكل البنفسجي — رأسه بارز ناحية الشمال الغربي
  {
    points: "336,72 495,74 399,243 302,244 266,176",
    fill: "url(#vioraPurple)",
    from: { x: 150, opacity: 0 },
  },
  // المثلث السماوي — قمة مايلة ورِجل يمنى شبه رأسية
  {
    points: "296,304 386,430 221,438",
    fill: "url(#vioraCyan)",
    from: { y: 150, opacity: 0 },
  },
];

function GradientDefs() {
  return (
          <defs>
            <linearGradient id="vioraBlue" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor="#585AFF" />
              <stop offset="100%" stopColor="#484AF0" />
            </linearGradient>
            <linearGradient id="vioraPurple" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor="#9C42FF" />
              <stop offset="100%" stopColor="#8E34F2" />
            </linearGradient>
            <linearGradient id="vioraCyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2BDCFF" />
              <stop offset="100%" stopColor="#1FD0F2" />
            </linearGradient>
          </defs>
  );
}

// الشعار المتحرك نفسه — قابل للاستخدام جوه الصفحة (StatusScreen مثلاً)
export function VioraLogoMark({
  className = "h-28 w-28",
  glowClass = "-inset-12",
}: {
  className?: string;
  glowClass?: string;
}) {
  return (
    <div className="relative">
      {/* التوهج */}
      <motion.div
        aria-hidden
        className={`absolute rounded-full ${glowClass}`}
        style={{
          background:
            "radial-gradient(circle, rgba(22,217,255,0.22), rgba(124,92,255,0.16) 45%, transparent 70%)",
          filter: "blur(8px)",
        }}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
      />

      <div className="viora-logo-pulse relative">
        <svg viewBox="0 0 512 512" className={className} role="status" aria-label="جارٍ التحميل">
          <GradientDefs />

          {SHAPES.map((s, i) => (
            <motion.polygon
              key={s.points}
              points={s.points}
              fill={s.fill}
              stroke={s.fill}
              strokeWidth={10}
              strokeLinejoin="round"
              initial={s.from}
              animate={{ x: 0, y: 0, opacity: 1 }}
              transition={{ delay: i * 0.15, duration: 0.6, ease: "easeOut" }}
            />
          ))}

          {/* خط السماوي اللي بيعدي على الحواف (Shine) */}
          {SHAPES.map((s) => (
            <motion.polygon
              key={`shine-${s.points}`}
              className="viora-shine"
              points={s.points}
              fill="none"
              stroke="#22D9FF"
              strokeWidth={7}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="18 82"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function VioraSplash({ label }: { label?: string }) {
  return (
    <motion.div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-6 bg-paper"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
    >
      <VioraLogoMark />

      {label && (
        <motion.p
          className="text-sm text-inkSoft"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
        >
          {label}
        </motion.p>
      )}
    </motion.div>
  );
}
