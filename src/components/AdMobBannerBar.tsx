import React from 'react';
import { ADMOB_CONFIG, admobService } from '../services/admobService';

export const AdMobBannerBar: React.FC = () => {
  const isNative = admobService.isNative();

  if (isNative) {
    // In native Android APK, activity_main.xml already places gameWebView above @+id/bannerAd (AdView),
    // so no extra web spacer is needed inside the WebView!
    return null;
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
          AdMob
        </span>
        <span className="truncate px-2 text-xs font-medium text-slate-100">
          Banner Slot Ready (320×50)
        </span>
        <span className="shrink-0 text-[10px] font-semibold text-sky-300">
          Live ID
        </span>
      </div>
    </div>
  );
};
