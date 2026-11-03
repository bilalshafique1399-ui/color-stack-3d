import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Smartphone, X } from 'lucide-react';
import { ADMOB_CONFIG } from '../services/admobService';
import { copyTextWithFallback } from '../services/referralService';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { soundEngine } from '../audio/soundEngine';

interface ApkBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkBuildModal: React.FC<ApkBuildModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const buildCommand = './build-apk.sh';

  const handleCopyCommand = async () => {
    soundEngine.playClick();
    const ok = await copyTextWithFallback(buildCommand);
    if (ok) {
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 2000);
    }
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Android APK & Mobile Install"
    >
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/15 bg-[#141830] p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Android APK &amp; Mobile Setup
          </h2>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 text-slate-200 hover:bg-white/15 active:scale-95 transition-transform"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-300 leading-relaxed">
          This project includes a standalone Android project (SDK 34, AdMob 22.6.0) pre-wired with portrait lock and your live AdMob App, Banner, Interstitial (every 3 games), and App Open IDs.
        </p>

        {/* Primary Action 1: Download Pre-Configured Android Studio / Gradle APK Project */}
        <div className="mt-5 space-y-3">
          <a
            href="/color-stack-android-apk-project.zip"
            download="color-stack-3d-android-apk-project.zip"
            onClick={() => soundEngine.playClick()}
            className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.98] whitespace-nowrap"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>Download Android APK Project (.zip)</span>
          </a>

          {/* Primary Action 2: Direct Home Screen Install (PWA) */}
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                void install();
              }}
              className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 transition-transform active:scale-[0.98] whitespace-nowrap"
            >
              <Smartphone className="h-4 w-4 shrink-0" />
              <span>Install App to Home Screen Now</span>
            </button>
          )}

          {!isInstalled && isIOS && (
            <div className="rounded-2xl border border-white/10 bg-[#0D1021] p-3.5 text-xs text-slate-300">
              On iPhone: tap Safari <strong>Share</strong> then <strong>Add to Home Screen</strong> for full-screen portrait play.
            </div>
          )}
        </div>

        {/* Configured AdMob IDs Summary */}
        <div className="mt-6 space-y-2.5 border-t border-white/10 pt-5">
          <div className="text-xs font-semibold text-slate-200">
            Configured Live Google AdMob IDs
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0D1021] p-3 text-xs space-y-2">
            <div>
              <div className="text-slate-400">App ID (AndroidManifest.xml)</div>
              <div className="font-mono text-[11px] text-amber-300 break-all tabular-nums">
                {ADMOB_CONFIG.APP_ID_ANDROID}
              </div>
            </div>
            <div className="border-t border-white/5 pt-2">
              <div className="text-slate-400">Banner Ad (Bottom Always)</div>
              <div className="font-mono text-[11px] text-sky-300 break-all tabular-nums">
                {ADMOB_CONFIG.BANNER_AD_ID}
              </div>
            </div>
            <div className="border-t border-white/5 pt-2">
              <div className="text-slate-400">Interstitial Ad (Every 3 Game Overs)</div>
              <div className="font-mono text-[11px] text-emerald-300 break-all tabular-nums">
                {ADMOB_CONFIG.INTERSTITIAL_AD_ID}
              </div>
            </div>
            <div className="border-t border-white/5 pt-2">
              <div className="text-slate-400">App Open Ad (Launch &amp; Resume)</div>
              <div className="font-mono text-[11px] text-violet-300 break-all tabular-nums">
                {ADMOB_CONFIG.APP_OPEN_AD_ID}
              </div>
            </div>
          </div>
        </div>

        {/* Cloud GitHub Actions + Local Gradle APK Instructions */}
        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-slate-200 space-y-1.5">
            <div className="font-semibold text-emerald-300">
              GitHub Actions Cloud APK Builder Included
            </div>
            <p className="text-slate-300 leading-relaxed">
              Push this project to GitHub or open <strong>Actions → Build APK → Run workflow</strong>. It builds the web assets, runs Gradle <code className="font-mono text-white">assembleDebug</code> with JDK 17 &amp; SDK 34, and uploads <code className="font-mono text-white">ColorStack3D-APK-RealAds</code> under Artifacts.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              One-Step Local APK Build Script
            </span>
            <button
              type="button"
              onClick={() => void handleCopyCommand()}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/15 whitespace-nowrap shrink-0"
            >
              {copiedCmd ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedCmd ? 'Copied' : 'Copy Cmd'}</span>
            </button>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#0D1021] p-3 font-mono text-[11px] text-slate-300">
            {buildCommand}
          </pre>
          <p className="text-xs text-slate-400 leading-relaxed">
            Output APK: <code className="font-mono text-slate-200">./ColorStack3D-APK-RealAds.apk</code> with all live AdMob IDs pre-configured in <code className="font-mono text-slate-200">AndroidManifest.xml</code>, <code className="font-mono text-slate-200">activity_main.xml</code>, and <code className="font-mono text-slate-200">MainActivity.java</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
