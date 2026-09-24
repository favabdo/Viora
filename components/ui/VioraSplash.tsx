"use client";

import { AnimatePresence, motion } from "framer-motion";

/*
 * سبلاش شعار Viora — بيظهر بس خلال فترة التحميل الفعلية (شبكة وحشة / بيانات بتتجيب)
 * وأول ما المحتوى يجهز بيختفي فوراً بـ fade — من غير أي مدة أدنى إجبارية.
 * لازم يكون جوه <AnimatePresence> عشان الـ fade-out يشتغل.
 */

// الهندسة مستخرجة من public/logo-icon.png بكسل-بكسل (Convex Hull لكل لون)
// النقاط مدفوعة 5px ناحية المركز عشان تعويض نمو الـ stroke (width 10) — فالحد النهائي يطابق الأصل
const SHAPES = [
  // الشكل الأزرق — ذراع الشمال، نهايته السفلى مقطوعة بزاوية مايلة
  {
    points: "15,76 144,72 272,268 200,384",
    fill: "url(#vioraAzure)",
    from: { x: -150, opacity: 0 },
  },
  // الشكل البنفسجي — رأسه بارز ناحية الشمال الغربي
  {
    points: "336,72 495,74 399,243 302,244 266,176",
    fill: "url(#vioraGreen)",
    from: { x: 150, opacity: 0 },
  },
  // المثلث السماوي — قمة مايلة ورِجل يمنى شبه رأسية
  {
    points: "296,304 386,430 221,438",
    fill: "url(#vioraTeal)",
    from: { y: 150, opacity: 0 },
  },
];

function GradientDefs() {
  return (
          <defs>
            <linearGradient id="vioraAzure" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor="#3D6EA5" />
              <stop offset="100%" stopColor="#2B5680" />
            </linearGradient>
            <linearGradient id="vioraGreen" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor="#2E9E6B" />
              <stop offset="100%" stopColor="#1F7A52" />
            </linearGradient>
            <linearGradient id="vioraTeal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#0D9488" />
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
            "radial-gradient(circle, rgba(147, 197, 253,0.22), rgba(61, 110, 165,0.16) 45%, transparent 70%)",
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
              stroke="#93C5FD"
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
      exit={{ opacity: 0, transition: { duration: 0.35, ease: "easeInOut" } }}
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
