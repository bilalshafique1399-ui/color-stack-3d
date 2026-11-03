import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarCheck2,
  Check,
  Coins,
  Copy,
  LogIn,
  Send,
  Share2,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  buildReferralLink,
  CENTS_PER_EXCHANGE_BUNDLE,
  COINS_PER_EXCHANGE_BUNDLE,
  DAILY_REWARD_CENTS,
  DAILY_REWARD_COINS,
  formatCoins,
  formatCountdown,
  formatUsd,
  getDailyRewardStatus,
  InvitedFriendEntry,
  isUserAdmin,
  MIN_INVITES_TO_WITHDRAW,
  REWARD_PER_INVITE_CENTS,
  REWARD_PER_INVITE_COINS,
  UserProfile,
} from '../services/referralService';
import { formatScoreDate } from '../services/highScoreService';
import { soundEngine } from '../audio/soundEngine';

interface EarnMoneyPageProps {
  user: User | null;
  profile: UserProfile | null;
  localGuestCoins: number;
  invitedFriends: InvitedFriendEntry[];
  loading: boolean;
  error: string | null;
  dailyClaimNotice: string | null;
  onClaimDailyBonus: () => Promise<void>;
  onConvertCoins: () => Promise<void>;
  onBackToGame: () => void;
  onGoToWithdraw: () => void;
  onGoToAdmin: () => void;
  onGoogleLogin: () => Promise<void>;
}

export const EarnMoneyPage: React.FC<EarnMoneyPageProps> = ({
  user,
  profile,
  localGuestCoins,
  invitedFriends,
  loading,
  error,
  dailyClaimNotice,
  onClaimDailyBonus,
  onConvertCoins,
  onBackToGame,
  onGoToWithdraw,
  onGoToAdmin,
  onGoogleLogin,
}) => {
  const [copied, setCopied] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [convertingCoins, setConvertingCoins] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!user || !profile) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [user, profile]);

  const invitesCount = profile?.invitesCount ?? 0;
  const balance = profile?.balance ?? 0;
  const coins = profile ? profile.coins : localGuestCoins;
  const myCode = profile?.myCode ?? '------';
  const referralLink = profile ? buildReferralLink(profile.myCode) : '';
  const progressRatio = Math.min(1, invitesCount / MIN_INVITES_TO_WITHDRAW);
  const canWithdraw = invitesCount >= MIN_INVITES_TO_WITHDRAW;
  const remainingInvites = Math.max(0, MIN_INVITES_TO_WITHDRAW - invitesCount);

  const dailyRewardUsd = formatUsd(DAILY_REWARD_CENTS);
  const inviteRewardUsd = formatUsd(REWARD_PER_INVITE_CENTS);
  const goalPayoutUsd = formatUsd(MIN_INVITES_TO_WITHDRAW * REWARD_PER_INVITE_CENTS);
  const exchangeBundleUsd = formatUsd(CENTS_PER_EXCHANGE_BUNDLE);
  const dailyStatus = getDailyRewardStatus(profile, nowMs);

  const convertibleBundles = Math.floor(coins / COINS_PER_EXCHANGE_BUNDLE);
  const convertibleCoins = convertibleBundles * COINS_PER_EXCHANGE_BUNDLE;
  const convertibleCents = convertibleBundles * CENTS_PER_EXCHANGE_BUNDLE;
  const coinProgressRatio = Math.min(1, (coins % COINS_PER_EXCHANGE_BUNDLE) / COINS_PER_EXCHANGE_BUNDLE);

  const shareMessage = `Play Color Stack 3D worldwide, collect Gold Coins, and earn USD rewards! Join with my invite link: ${referralLink}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Play Color Stack 3D worldwide, collect Gold Coins, and earn USD rewards!')}`;

  const handleCopyLink = async () => {
    if (!referralLink) return;
    soundEngine.playClick();
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleDailyBonusClick = async () => {
    if (!profile || !dailyStatus.canClaim || claimingDaily) return;
    soundEngine.playClick();
    setClaimingDaily(true);
    try {
      await onClaimDailyBonus();
      setNowMs(Date.now());
    } finally {
      setClaimingDaily(false);
    }
  };

  const handleConvertCoinsClick = async () => {
    if (!profile || convertibleBundles < 1 || convertingCoins) return;
    soundEngine.playClick();
    setConvertingCoins(true);
    try {
      await onConvertCoins();
    } finally {
      setConvertingCoins(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#0F1326] text-white">
      {/* Sticky Top App Bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0F1326]/95 px-4 sm:px-6">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBackToGame();
            }}
            className="flex min-h-[44px] items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to Game</span>
          </button>

          <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
            Global Rewards &amp; Coins
          </span>

          <div className="flex items-center justify-end min-w-[44px] shrink-0">
            {isUserAdmin(user) && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onGoToAdmin();
                }}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-amber-300 hover:bg-white/15 transition-colors whitespace-nowrap"
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Admin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {!user ? (
          <div className="mx-auto max-w-md rounded-3xl border border-white/15 bg-[#161B36] p-6 sm:p-8 text-center">
            <div className="text-xs font-medium text-emerald-300 tabular-nums">
              Worldwide USD &amp; Gold Coins · +{dailyRewardUsd} + {DAILY_REWARD_COINS} Coins Daily
            </div>
            <h1 className="mt-1.5 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white [text-wrap:balance] tabular-nums">
              1 Invite = {inviteRewardUsd} + {REWARD_PER_INVITE_COINS} Coins
            </h1>
            {localGuestCoins > 0 && (
              <p className="mt-2.5 text-xs font-semibold text-amber-300 tabular-nums">
                You have {formatCoins(localGuestCoins)} Gold Coins saved on this device — sign in to sync them!
              </p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Sign in with Google to save your 3D gameplay Gold Coins, exchange {COINS_PER_EXCHANGE_BUNDLE} Coins for +{exchangeBundleUsd} USD, invite friends worldwide, and cash out via RedotPay, Binance Pay, USDT (TRC20), or PayPal.
            </p>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                void onGoogleLogin();
              }}
              className="mt-6 flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-6 py-3 font-display text-base font-extrabold text-slate-950 shadow-lg hover:bg-slate-100 active:scale-[0.98] transition-transform whitespace-nowrap"
            >
              <LogIn className="h-5 w-5 shrink-0" />
              <span>Continue with Google</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            {/* Left / Top Column: Referral Link, Daily Bonus, Gold Coins Vault, Stats & Withdraw */}
            <div className="space-y-5 lg:col-span-7">
              {dailyClaimNotice && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-xs sm:text-sm font-medium text-emerald-200 tabular-nums">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{dailyClaimNotice}</span>
                  </div>
                </div>
              )}

              {/* Top International Referral Link + Big Offer */}
              <section className="rounded-3xl border border-white/15 bg-[#161B36] p-5 sm:p-6">
                <div className="text-xs font-medium text-amber-300 tabular-nums">
                  Global Referral Code · {myCode}
                </div>
                <h1 className="mt-1 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white [text-wrap:balance] tabular-nums">
                  1 Invite = {inviteRewardUsd}
                </h1>
                <p className="mt-1.5 text-sm text-slate-300 tabular-nums">
                  Every friend worldwide who joins with Google adds +{inviteRewardUsd} USD and +{REWARD_PER_INVITE_COINS} Gold Coins instantly.
                </p>

                <div className="mt-5">
                  <label
                    htmlFor="my-referral-link"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    My International Referral Link
                  </label>
                  <div className="mt-1.5 flex items-center rounded-xl border border-white/15 bg-[#0D1021] px-3.5 py-2.5">
                    <input
                      id="my-referral-link"
                      type="text"
                      readOnly
                      value={loading && !profile ? 'Generating your referral link...' : referralLink}
                      className="w-full bg-transparent font-mono text-xs sm:text-sm text-slate-100 focus:outline-none truncate tabular-nums"
                    />
                  </div>

                  {/* Copy + WhatsApp + Telegram International Share Actions */}
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={!profile}
                      onClick={handleCopyLink}
                      className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/15 active:scale-[0.98] transition-transform disabled:opacity-50 whitespace-nowrap"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                          <span className="text-emerald-300">Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 shrink-0" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={profile ? whatsappHref : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => soundEngine.playClick()}
                      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-slate-950 hover:brightness-105 active:scale-[0.98] transition-transform whitespace-nowrap ${
                        !profile ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      <Share2 className="h-4 w-4 shrink-0" />
                      <span>WhatsApp</span>
                    </a>

                    <a
                      href={profile ? telegramHref : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => soundEngine.playClick()}
                      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-slate-950 hover:brightness-105 active:scale-[0.98] transition-transform whitespace-nowrap ${
                        !profile ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      <Send className="h-4 w-4 shrink-0" />
                      <span>Telegram</span>
                    </a>
                  </div>
                </div>
              </section>

              {/* Gold Coins Vault & Instant Coin-to-USD Exchange */}
              <section className="rounded-3xl border border-white/15 bg-[#161B36] p-5">
                <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-300 tabular-nums">
                      <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        Gold Coins Vault · {COINS_PER_EXCHANGE_BUNDLE} Coins = +{exchangeBundleUsd} USD
                      </span>
                    </div>
                    <div className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                      {formatCoins(coins)} Coins
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
                      Earn +1 Coin per block, +2 on Perfect drops, and +5 on 3D Gold Coins in the tower.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!profile || convertibleBundles < 1 || convertingCoins}
                    onClick={() => void handleConvertCoinsClick()}
                    className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-transform whitespace-nowrap shrink-0 tabular-nums ${
                      profile && convertibleBundles >= 1 && !convertingCoins
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-[0.98]'
                        : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    <ArrowRightLeft className="h-4 w-4 shrink-0" />
                    <span>
                      {convertingCoins
                        ? 'Converting...'
                        : convertibleBundles >= 1
                          ? `Exchange ${formatCoins(convertibleCoins)} → +${formatUsd(convertibleCents)}`
                          : `${COINS_PER_EXCHANGE_BUNDLE - (coins % COINS_PER_EXCHANGE_BUNDLE)} more to exchange`}
                    </span>
                  </button>
                </div>

                {convertibleBundles < 1 && (
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#0D1021]">
                    <div
                      className="h-full w-full origin-left bg-gradient-to-r from-amber-400 to-yellow-300 transition-transform duration-200"
                      style={{ transform: `scaleX(${coinProgressRatio.toFixed(4)})` }}
                    />
                  </div>
                )}
              </section>

              {/* 24-Hour Daily Sign-In Bonus (+$0.05 USD + 50 Coins) */}
              <section className="rounded-3xl border border-white/15 bg-[#161B36] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-300 tabular-nums">
                      <CalendarCheck2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        Daily Sign-In Bonus · +{dailyRewardUsd} &amp; +{DAILY_REWARD_COINS} Coins / 24h
                      </span>
                    </div>
                    <div className="mt-1 font-display text-lg font-bold text-white tabular-nums">
                      {!profile
                        ? 'Checking daily reward...'
                        : dailyStatus.canClaim
                          ? `Ready: +${dailyRewardUsd} USD + ${DAILY_REWARD_COINS} Coins`
                          : 'Daily bonus claimed'}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
                      {!profile
                        ? 'Tracked automatically in your global profile.'
                        : dailyStatus.canClaim
                          ? 'Awarded automatically on sign-in or tap Claim Bonus now.'
                          : `Next bonus unlocks in ${formatCountdown(dailyStatus.remainingMs)}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!profile || !dailyStatus.canClaim || claimingDaily}
                    onClick={() => void handleDailyBonusClick()}
                    className={`flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-xs font-extrabold transition-transform whitespace-nowrap shrink-0 tabular-nums ${
                      profile && dailyStatus.canClaim && !claimingDaily
                        ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 active:scale-[0.98]'
                        : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    {claimingDaily
                      ? 'Claiming...'
                      : dailyStatus.canClaim
                        ? `Claim +${dailyRewardUsd}`
                        : `Next in ${formatCountdown(dailyStatus.remainingMs)}`}
                  </button>
                </div>
              </section>

              {/* Progress Card ("0 / 50 Invites") & International USD Balance Card */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <section className="rounded-3xl border border-white/15 bg-[#161B36] p-5">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>Invite Goal</span>
                    <Users className="h-4 w-4 text-sky-300" aria-hidden="true" />
                  </div>
                  <div className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                    {invitesCount} / {MIN_INVITES_TO_WITHDRAW} Invites
                  </div>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#0D1021]">
                    <div
                      className="h-full w-full origin-left bg-gradient-to-r from-sky-400 to-emerald-400 transition-transform duration-200"
                      style={{ transform: `scaleX(${progressRatio.toFixed(4)})` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 tabular-nums">
                    {canWithdraw
                      ? 'Goal reached — international payouts unlocked!'
                      : `${remainingInvites} more invite${remainingInvites === 1 ? '' : 's'} to unlock withdrawal`}
                  </p>
                </section>

                <section className="rounded-3xl border border-white/15 bg-[#161B36] p-5">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>Available Balance (USD)</span>
                    <Wallet className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  </div>
                  <div className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-amber-300 tabular-nums">
                    {formatUsd(balance)}
                  </div>
                  <p className="mt-3 text-xs text-slate-400 tabular-nums">
                    RedotPay · Binance Pay · USDT · PayPal ({goalPayoutUsd}+ at {MIN_INVITES_TO_WITHDRAW} invites)
                  </p>
                </section>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  {error}
                </div>
              )}

              {/* Withdraw CTA Button (Disabled until 50 invites) */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={!canWithdraw}
                  onClick={() => {
                    if (!canWithdraw) return;
                    soundEngine.playClick();
                    onGoToWithdraw();
                  }}
                  className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-display text-base font-extrabold transition-transform whitespace-nowrap tabular-nums ${
                    canWithdraw
                      ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-lg hover:brightness-105 active:scale-[0.98]'
                      : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  <Wallet className="h-5 w-5 shrink-0" />
                  <span>
                    {canWithdraw
                      ? `Withdraw Worldwide (${formatUsd(balance)})`
                      : `Withdraw Locked (${invitesCount} / ${MIN_INVITES_TO_WITHDRAW} Invites)`}
                  </span>
                </button>
              </div>
            </div>

            {/* Right / Bottom Column: List of Invited Friends */}
            <section className="rounded-3xl border border-white/15 bg-[#161B36] p-5 sm:p-6 lg:col-span-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-white">
                  Invited Friends
                </h2>
                <span className="text-xs font-medium text-slate-400 tabular-nums">
                  {invitedFriends.length} joined
                </span>
              </div>

              {loading && invitedFriends.length === 0 ? (
                <div className="mt-4 space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-xl border border-white/5 bg-[#0D1021]/70"
                    />
                  ))}
                </div>
              ) : invitedFriends.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-[#0D1021] px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-300">
                    No friends invited yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed tabular-nums">
                    Share your link via WhatsApp or Telegram. Each friend who signs in adds +{inviteRewardUsd} USD and +{REWARD_PER_INVITE_COINS} Coins here.
                  </p>
                </div>
              ) : (
                <div
                  className="mt-4 max-h-96 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0D1021] divide-y divide-white/10"
                  role="list"
                  aria-label="Invited friends"
                >
                  {invitedFriends.map((friend, idx) => (
                    <div
                      key={friend.invitedUid}
                      role="listitem"
                      className="flex items-center justify-between gap-3 px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {idx + 1}. {friend.invitedName}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400 tabular-nums">
                          Joined {formatScoreDate(friend.createdAtMs)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <div className="font-display text-sm font-bold text-emerald-300">
                          +{formatUsd(friend.rewardCents)}
                        </div>
                        {friend.rewardCoins > 0 && (
                          <div className="text-[11px] font-medium text-amber-300">
                            +{friend.rewardCoins} Coins
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
