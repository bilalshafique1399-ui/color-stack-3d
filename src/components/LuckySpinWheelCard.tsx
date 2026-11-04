import React, { useEffect, useRef, useState } from 'react';
import { Gift, Sparkles, Tv } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { SPIN_WHEEL_SEGMENTS } from '../services/localEarnStore';

interface LuckySpinWheelCardProps {
  canFreeSpin: boolean;
  extraSpins: number;
  rewardMultiplier: number;
  vipZeroAds: boolean;
  onSpinComplete: (segmentCoins: number, usedFreeSpin: boolean) => void;
  onRequestExtraSpinAd: () => void;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDegFromTop: number) {
  const rad = ((angleDegFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function buildWedgePath(
  cx: number,
  cy: number,
  radius: number,
  startDegFromTop: number,
  endDegFromTop: number,
): string {
  const start = polarToCartesian(cx, cy, radius, startDegFromTop);
  const end = polarToCartesian(cx, cy, radius, endDegFromTop);
  const largeArcFlag = endDegFromTop - startDegFromTop <= 180 ? '0' : '1';
  return [
    `M ${cx} ${cy}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export const LuckySpinWheelCard: React.FC<LuckySpinWheelCardProps> = ({
  canFreeSpin,
  extraSpins,
  rewardMultiplier,
  vipZeroAds,
  onSpinComplete,
  onRequestExtraSpinAd,
}) => {
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastWonCoins, setLastWonCoins] = useState<number | null>(null);

  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const safeMult = Math.max(1, rewardMultiplier);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleSpin = () => {
    if (spinning) return;
    const useFree = canFreeSpin;
    if (!useFree && extraSpins <= 0) {
      onRequestExtraSpinAd();
      return;
    }

    soundEngine.playClick();
    setSpinning(true);
    setLastWonCoins(null);

    const sliceCount = SPIN_WHEEL_SEGMENTS.length;
    const sliceDeg = 360 / sliceCount;
    const chosenIdx = Math.floor(Math.random() * sliceCount);
    const chosenSegment = SPIN_WHEEL_SEGMENTS[chosenIdx];

    const desiredMod = (360 - chosenIdx * sliceDeg) % 360;
    const jitter = (Math.random() - 0.5) * 20;
    const startAngle = angleRef.current;
    const currentMod = ((startAngle % 360) + 360) % 360;
    let deltaToTarget = desiredMod - currentMod;
    if (deltaToTarget < 0) deltaToTarget += 360;

    const fullRotations = (5 + Math.floor(Math.random() * 2)) * 360;
    const targetAngle = startAngle + fullRotations + deltaToTarget + jitter;

    const durationMs = 3600;
    const startTime = performance.now();
    let lastTickStep = Math.floor((startAngle + sliceDeg / 2) / sliceDeg);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3.6);
      const current = startAngle + (targetAngle - startAngle) * eased;

      angleRef.current = current;
      setWheelAngle(current);

      const currentTickStep = Math.floor((current + sliceDeg / 2) / sliceDeg);
      if (currentTickStep > lastTickStep) {
        lastTickStep = currentTickStep;
        soundEngine.playWheelTick();
      }

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        setSpinning(false);
        const totalWon = chosenSegment.coins * safeMult;
        setLastWonCoins(totalWon);
        soundEngine.playRewardFanfare();
        onSpinComplete(chosenSegment.coins, useFree);
      }
    };

    rafRef.current = window.requestAnimationFrame(step);
  };

  const sliceDeg = 360 / SPIN_WHEEL_SEGMENTS.length;
  const spinsAvailable = (canFreeSpin ? 1 : 0) + extraSpins;

  return (
    <div className="rounded-2xl bg-[#1C214E] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-extrabold text-white sm:text-lg">
            Lucky Spin Wheel
          </h3>
          <p className="mt-0.5 text-xs text-[#bbb] tabular-nums">
            1 Free Spin Daily • Top Slice: {100 * safeMult} Coins
            {safeMult > 1 ? ` (${safeMult}x Boost Active)` : ''}
          </p>
        </div>
        <span className="text-xs font-bold text-[#00D68F] tabular-nums">
          {spinsAvailable} {spinsAvailable === 1 ? 'Spin' : 'Spins'} Ready
        </span>
      </div>

      {/* SVG Wheel */}
      <div className="my-3 flex flex-col items-center justify-center">
        <div className="relative h-56 w-56 sm:h-64 sm:w-64">
          <svg viewBox="0 0 280 280" className="h-full w-full drop-shadow-2xl">
            <circle cx="140" cy="140" r="130" fill="#0F1226" stroke="#FFCC00" strokeWidth="5" />

            <g transform={`rotate(${wheelAngle.toFixed(2)} 140 140)`}>
              {SPIN_WHEEL_SEGMENTS.map((seg, idx) => {
                const startDeg = idx * sliceDeg - sliceDeg / 2;
                const endDeg = startDeg + sliceDeg;
                const midDeg = idx * sliceDeg;
                const labelPos = polarToCartesian(140, 140, 84, midDeg);
                const rimDot = polarToCartesian(140, 140, 122, startDeg);
                const displayVal = seg.coins * safeMult;

                return (
                  <g key={`${seg.label}_${idx}`}>
                    <path
                      d={buildWedgePath(140, 140, 122, startDeg, endDeg)}
                      fill={seg.color}
                      stroke="#14173A"
                      strokeWidth="2"
                    />
                    <circle cx={rimDot.x} cy={rimDot.y} r="3" fill="#FFF" />
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      fill="#0B0E20"
                      fontSize="14"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${midDeg} ${labelPos.x.toFixed(2)} ${labelPos.y.toFixed(
                        2,
                      )})`}
                    >
                      {displayVal}
                    </text>
                  </g>
                );
              })}
            </g>

            <circle cx="140" cy="140" r="24" fill="#14173A" stroke="#FFCC00" strokeWidth="4" />
            <circle cx="140" cy="140" r="9" fill="#00D68F" />

            <polygon
              points="140,26 128,4 152,4"
              fill="#FFCC00"
              stroke="#0F1226"
              strokeWidth="2.5"
            />
          </svg>
        </div>

        {lastWonCoins !== null && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-extrabold text-[#00D68F] tabular-nums">
            <Sparkles className="h-4 w-4 text-[#FFCC00]" />
            <span>Jackpot! You won +{lastWonCoins} Coins!</span>
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={spinning}
          onClick={handleSpin}
          className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 disabled:opacity-50 sm:text-sm"
        >
          <Gift className="h-4 w-4" />
          <span>
            {spinning
              ? 'Spinning...'
              : canFreeSpin
                ? 'Free Daily Spin'
                : extraSpins > 0
                  ? `Use Extra Spin (${extraSpins})`
                  : vipZeroAds
                    ? 'Instant VIP Spin'
                    : 'Watch Ad to Spin'}
          </span>
        </button>

        <button
          type="button"
          disabled={spinning}
          onClick={onRequestExtraSpinAd}
          className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-white px-4 py-2.5 text-xs font-extrabold text-black transition hover:bg-slate-100 disabled:opacity-50 sm:text-sm"
        >
          <Tv className="h-4 w-4 text-[#0F1226]" />
          <span>{vipZeroAds ? 'Free VIP +1 Spin' : 'Watch Ad (+1 Spin)'}</span>
        </button>
      </div>
    </div>
  );
};
