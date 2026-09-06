'use client';

import Image from 'next/image';

export default function MainLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Image src="/logo-full.png" alt="Viora logo" width={120} height={40} className="mb-6" />
      <div className="relative w-20 h-20">
        <svg className="absolute inset-0" viewBox="0 0 24 24">
          <path
            d="M4 12l8 8 8-8"
            stroke="currentColor"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            className="v-path"
          />
        </svg>
      </div>
      <style jsx>{`
        .v-path {
          stroke: #6C5CE7;
          stroke-dasharray: 20;
          stroke-dashoffset: 20;
          animation: draw 2s ease-in-out infinite;
        }
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
