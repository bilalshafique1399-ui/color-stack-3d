import React from 'react';
import { ADMOB_CONFIG, admobService } from '../services/admobService';

export const AdMobBannerBar: React.FC = () => {
  const isNative = admobService.isNative();

  if (isNative) {
    // Native Capacitor AdMob renders the OS-level Adaptive Banner (ADMOB_CONFIG.BANNER_AD_ID) over this bottom slot
    return (
      <div
        className="h-[56px] w-full shrink-0 bg-[#0D1021] pb-[env(safe-area-inset-bottom)]"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      data-ad-unit-id={ADMOB_CONFIG.BANNER_AD_ID}
      className="relative z-30 flex h-[50px] w-full shrink-0 items-center justify-center border-t border-white/10 bg-[#0D1021] px-2"
      role="region"
      aria-label="Banner Ad"
    >
      <div className="flex h-[50px] w-full max-w-[320px] items-center justify-between bg-[#1B2038] px-3">
        <span className="shrink-0 rounded-sm bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
          Test Ad
        </span>
        <span className="truncate px-2 text-xs font-medium text-slate-100">
          Nice job! This is a 320x50 test ad.
        </span>
        <span className="shrink-0 text-[10px] font-semibold text-sky-300">
          AdMob
        </span>
      </div>
    </div>
  );
};
