'use client';

import { VioraLogoMark } from '@/components/ui/VioraSplash';

export default function MainLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <VioraLogoMark className="h-24 w-24" glowClass="-inset-8" />
    </div>
  );
}
