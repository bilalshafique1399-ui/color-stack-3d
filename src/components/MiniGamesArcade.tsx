import React, { useState } from 'react';
import { Dices, Palette, Sparkles } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import {
  EarnPlayState,
  getFreeMiniGamesRemaining,
  getRewardMultiplier,
  GuessPrismColor,
  isVipClubActive,
  MINI_GAME_EXTRA_COST_COINS,
  playGuessColorMiniGame,
  playLuckyNumberMiniGame,
} from '../services/localEarnStore';

interface MiniGamesArcadeProps {
  mode: 'lucky_number' | 'guess_color';
  earnState: EarnPlayState;
  onUpdateState: (nextState: EarnPlayState, toastMessage: string, won: boolean) => void;
}

const PRISM_OPTIONS: { id: GuessPrismColor; label: string; bgClass: string; borderClass: string }[] = [
  {
    id: 'pink',
    label: 'Neon Pink',
    bgClass: 'from-pink-500 to-rose-600',
    borderClass: 'border-pink-400',
  },
  {
    id: 'emerald',
    label: 'Emerald Mint',
    bgClass: 'from-emerald-400 to-teal-600',
    borderClass: 'border-emerald-300',
  },
  {
    id: 'gold',
    label: 'Royal Gold',
    bgClass: 'from-yellow-300 to-amber-500',
    borderClass: 'border-yellow-300',
  },
];

export const MiniGamesArcade: React.FC<MiniGamesArcadeProps> = ({
  mode,
  earnState,
  onUpdateState,
}) => {
  const [pickedNum, setPickedNum] = useState<number>(7);
  const [rolling, setRolling] = useState(false);
  const [lastRolledNum, setLastRolledNum] = useState<number | null>(null);
  const [numResultMsg, setNumResultMsg] = useState<string | null>(null);

  const [pickedColor, setPickedColor] = useState<GuessPrismColor>('emerald');
  const [revealingColor, setRevealingColor] = useState(false);
  const [lastDrawnColor, setLastDrawnColor] = useState<GuessPrismColor | null>(null);
  const [colorResultMsg, setColorResultMsg] = useState<string | null>(null);

  const vipActive = isVipClubActive(earnState);
  const freeLeft = getFreeMiniGamesRemaining(earnState);
  const mult = getRewardMultiplier(earnState);

  const handlePlayLuckyNumber = () => {
    if (rolling) return;
    soundEngine.playClick();
    setRolling(true);

    let ticks = 0;
    const tickInterval = window.setInterval(() => {
      ticks += 1;
      setLastRolledNum(1 + Math.floor(Math.random() * 9));
      soundEngine.playWheelTick();
      if (ticks >= 8) {
        window.clearInterval(tickInterval);
        const res = playLuckyNumberMiniGame(earnState, pickedNum);
        setRolling(false);
        if (res.ok) {
          setLastRolledNum(res.rolledNumber);
          setNumResultMsg(res.message);
          onUpdateState(res.nextState, res.message, res.won);
        } else {
          setNumResultMsg(res.message);
          onUpdateState(earnState, res.message, false);
        }
      }
    }, 85);
  };

  const handlePlayGuessColor = () => {
    if (revealingColor) return;
    soundEngine.playClick();
    setRevealingColor(true);

    const sequence: GuessPrismColor[] = ['pink', 'emerald', 'gold'];
    let ticks = 0;
    const tickInterval = window.setInterval(() => {
      setLastDrawnColor(sequence[ticks % 3]);
      ticks += 1;
      soundEngine.playWheelTick();
      if (ticks >= 7) {
        window.clearInterval(tickInterval);
        const res = playGuessColorMiniGame(earnState, pickedColor);
        setRevealingColor(false);
        if (res.ok) {
          setLastDrawnColor(res.drawnColor);
          setColorResultMsg(res.message);
          onUpdateState(res.nextState, res.message, res.won);
        } else {
          setColorResultMsg(res.message);
          onUpdateState(earnState, res.message, false);
        }
      }
    }, 90);
  };

  if (mode === 'lucky_number') {
    return (
      <div className="flex flex-1 flex-col items-center justify-between overflow-y-auto rounded-2xl bg-[#0F1226] p-4 text-center">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 font-display text-lg font-extrabold text-white">
            <Dices className="h-5 w-5 text-[#FFCC00]" />
            <span>Lucky Number (1 – 9)</span>
          </div>
          <p className="mt-1 text-xs text-[#bbb] tabular-nums">
            Exact Hit = <b className="text-[#00D68F]">+{45 * mult} Coins</b> • Close (±1) ={' '}
            <b className="text-[#FFCC00]">+{10 * mult} Coins</b>
          </p>
        </div>

        {/* Center Lucky Reel */}
        <div className="my-3 flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-[#FFCC00] bg-[#1C214E] font-display text-5xl font-black text-white shadow-xl tabular-nums">
            {lastRolledNum ?? '?'}
          </div>
          <span className="mt-2 text-xs text-[#bbb] tabular-nums">
            Your Pick: <b className="text-[#00D68F]">{pickedNum}</b> •{' '}
            {vipActive
              ? 'VIP Club: Unlimited Free Plays'
              : freeLeft > 0
                ? `${freeLeft} Free Daily Plays Left`
                : `Entry: ${MINI_GAME_EXTRA_COST_COINS} Coins`}
          </span>
        </div>

        {/* 1..9 Selector Grid */}
        <div className="w-full max-w-sm">
          <div className="grid grid-cols-9 gap-1.5 tabular-nums">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                disabled={rolling}
                onClick={() => {
                  soundEngine.playClick();
                  setPickedNum(num);
                }}
                className={`flex h-10 items-center justify-center rounded-lg border text-sm font-extrabold transition ${
                  pickedNum === num
                    ? 'border-[#00D68F] bg-[#00D68F] text-black'
                    : 'border-[#333866] bg-[#1C214E] text-white hover:border-white/40'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          {numResultMsg && (
            <p className="mt-2.5 text-xs font-bold text-[#00D68F]">{numResultMsg}</p>
          )}

          <button
            type="button"
            disabled={rolling}
            onClick={handlePlayLuckyNumber}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-sm font-extrabold text-black transition hover:brightness-105 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {rolling
                ? 'Rolling...'
                : vipActive || freeLeft > 0
                  ? `Roll Lucky Number (Free)`
                  : `Roll Lucky Number (${MINI_GAME_EXTRA_COST_COINS} Coins)`}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Guess Color Mode
  const activeRevealOption = PRISM_OPTIONS.find((o) => o.id === lastDrawnColor) ?? null;

  return (
    <div className="flex flex-1 flex-col items-center justify-between overflow-y-auto rounded-2xl bg-[#0F1226] p-4 text-center">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 font-display text-lg font-extrabold text-white">
          <Palette className="h-5 w-5 text-[#00D68F]" />
          <span>Guess Color Prism</span>
        </div>
        <p className="mt-1 text-xs text-[#bbb] tabular-nums">
          Match the hidden prism to win <b className="text-[#00D68F]">+{15 * mult} Coins</b> +
          Streak Bonus! (Current Streak: <b className="text-[#FFCC00]">×{earnState.colorGuessStreak}</b>)
        </p>
      </div>

      {/* Center Prism Cube */}
      <div className="my-3 flex flex-col items-center">
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-2xl border-2 shadow-xl transition ${
            activeRevealOption
              ? `bg-gradient-to-br ${activeRevealOption.bgClass} ${activeRevealOption.borderClass}`
              : 'border-[#333866] bg-[#1C214E]'
          }`}
        >
          <span className="font-display text-xs font-black uppercase tracking-wider text-white drop-shadow">
            {activeRevealOption ? activeRevealOption.label : 'HIDDEN'}
          </span>
        </div>
        <span className="mt-2 text-xs text-[#bbb] tabular-nums">
          {vipActive
            ? 'VIP Club: Unlimited Free Plays'
            : freeLeft > 0
              ? `${freeLeft} Free Daily Plays Left`
              : `Entry: ${MINI_GAME_EXTRA_COST_COINS} Coins`}
        </span>
      </div>

      {/* 3 Color Choices */}
      <div className="w-full max-w-sm">
        <div className="grid grid-cols-3 gap-2">
          {PRISM_OPTIONS.map((opt) => {
            const selected = pickedColor === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={revealingColor}
                onClick={() => {
                  soundEngine.playClick();
                  setPickedColor(opt.id);
                }}
                className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl border-2 bg-gradient-to-br ${
                  opt.bgClass
                } p-2 text-xs font-extrabold text-white shadow transition ${
                  selected ? 'border-white scale-[1.03]' : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                <span className="whitespace-nowrap drop-shadow">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {colorResultMsg && (
          <p className="mt-2.5 text-xs font-bold text-[#00D68F]">{colorResultMsg}</p>
        )}

        <button
          type="button"
          disabled={revealingColor}
          onClick={handlePlayGuessColor}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-sm font-extrabold text-black transition hover:brightness-105 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          <span>
            {revealingColor
              ? 'Revealing Prism...'
              : vipActive || freeLeft > 0
                ? 'Reveal Prism (Free)'
                : `Reveal Prism (${MINI_GAME_EXTRA_COST_COINS} Coins)`}
          </span>
        </button>
      </div>
    </div>
  );
};
