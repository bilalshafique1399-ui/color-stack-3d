import React from 'react';
import { ADMOB_CONFIG, admobService } from '../services/admobService';

interface AdMobBannerBarProps {
  vipZeroAds?: boolean;
}

export const AdMobBannerBar: React.FC<AdMobBannerBarProps> = ({ vipZeroAds = false }) => {
  const isNative = admobService.isNative();

  if (isNative || vipZeroAds) {
    // In native Android APK, activity_main.xml already places gameWebView above @+id/bannerAd (AdView),
    // and VIP Club members enjoy zero banner/interstitial ads in web mode.
    return null;
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      data-ad-unit-id={ADMOB_CONFIG.BANNER_AD_ID}
      className="relative z-30 flex h-[50px] w-full shrink-0 items-center justify-center border-t border-white/10 bg-[#0D1021] px-2"
      role="region"
      aria-label="Sponsored Banner"
    >
      <div className="flex h-[42px] w-full max-w-[320px] items-center justify-between rounded-lg bg-[#1B2038] px-3">
        <span className="shrink-0 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
          Ad
        </span>
        <span className="truncate px-2 text-xs font-medium text-slate-100">
          Color Stack 3D · Stack Perfect Combos!
        </span>
        <span className="shrink-0 text-[10px] font-semibold text-[#00D68F]">
          Play Now
        </span>
      </div>
    </div>
  );
};
