import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface AdMobInterstitialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdMobInterstitialModal: React.FC<AdMobInterstitialModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    if (!isOpen) return;
    setSecondsLeft(3);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDismiss = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    if (secondsLeft > 0) return;
    soundEngine.playClick();
    onClose();
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0B0E1D] p-5 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Sponsored Interstitial Ad"
    >
      {/* Top Bar */}
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-slate-950">
            Sponsored
          </span>
          <span>Color Stack 3D</span>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          disabled={secondsLeft > 0}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-95 whitespace-nowrap shrink-0 ${
            secondsLeft > 0
              ? 'cursor-not-allowed bg-white/10 text-slate-400'
              : 'bg-white text-slate-950 hover:bg-slate-100'
          }`}
        >
          {secondsLeft > 0 ? (
            <span className="tabular-nums">Continue in {secondsLeft}s</span>
          ) : (
            <>
              <X className="h-4 w-4" />
              <span>Close</span>
            </>
          )}
        </button>
      </div>

      {/* Center Production Creative */}
      <div className="mx-auto flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/15 bg-[#151A33] p-8 text-center shadow-2xl">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00D68F] to-emerald-600 text-white shadow-lg">
          <Sparkles className="h-8 w-8 text-slate-950" />
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-white [text-wrap:balance]">
          Stack Higher &amp; Unlock VIP Rewards
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Land 5 Perfect Drops in a row to expand your slab and multiply your coin streak. Upgrade to VIP Club anytime for zero ad breaks!
        </p>
      </div>

      {/* Bottom Footer */}
      <div className="mx-auto w-full max-w-md text-center text-xs text-slate-400">
        Sponsored Break · Tap Close to Return to Game
      </div>
    </div>
  );
};
