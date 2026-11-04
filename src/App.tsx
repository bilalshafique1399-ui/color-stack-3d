/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Award,
  Bell,
  Box,
  Check,
  Clock,
  Copy,
  Crown,
  DollarSign,
  Download,
  FileCheck2,
  Flame,
  Gamepad2,
  Gem,
  Gift,
  Heart,
  Lock,
  LogOut,
  Moon,
  Play,
  Rocket,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Target,
  Ticket,
  Trophy,
  Tv,
  User,
  Users,
  Vibrate,
  VibrateOff,
  Video,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  computeProgressionLevel,
  DropFeedback,
  GamePhase,
  LevelProgressionInfo,
  StackTowerEngine,
} from './game/StackTowerEngine';
import { soundEngine } from './audio/soundEngine';
import { hapticEngine } from './audio/hapticEngine';
import { ADMOB_CONFIG, admobService } from './services/admobService';
import { AdMobBannerBar } from './components/AdMobBannerBar';
import { AdMobInterstitialModal } from './components/AdMobInterstitialModal';
import { ApkBuildModal } from './components/ApkBuildModal';
import { LuckySpinWheelCard } from './components/LuckySpinWheelCard';
import { MiniGamesArcade } from './components/MiniGamesArcade';
import { CommunityAndBattlesPanel } from './components/CommunityAndBattlesPanel';
import { communityRealtimeService } from './services/communityRealtimeService';
import {
  getNotificationPermission,
  requestPushPermission,
  sendDeviceNotification,
} from './services/pushNotificationService';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  activateMonthlyVipClub,
  applyFriendReferralCode,
  AvatarId,
  BATTLE_PASS_COST_COINS,
  canUseFreeSpinToday,
  claimDailyLoginBonus,
  claimDailyMission,
  claimOfflineSleepCoins,
  claimSixHourPlayReward,
  claimTournamentWinnerBonus,
  claimVipClubDailyCoins,
  COINS_PER_INVITE,
  COINS_PER_LEVEL2_INVITE,
  coinsToUsdString,
  completeSpinWheel,
  CUBE_SKINS_CATALOG,
  DAILY_LOGIN_REWARDS,
  DAILY_MISSIONS_CATALOG,
  EarnPlayState,
  equipCubeSkin,
  formatPlayDuration,
  getActiveUser,
  getCountdownTo9PM,
  getMissionProgressValue,
  getMysteryBoxStatus,
  getNextLevelProgressPercent,
  getOfflineEarningsStatus,
  getPlayerLevel,
  getPlayerRank,
  getRewardMultiplier,
  getStreakMultiplier,
  getTodayDateKey,
  getTop100Leaderboard,
  getTournamentStandings,
  getVipClubDaysRemaining,
  INVITES_REQUIRED_FOR_WITHDRAW,
  isSkinUnlocked,
  isVipClubActive,
  loadEarnPlayState,
  loginLocalUser,
  logoutLocalUser,
  MIN_WITHDRAW_COINS,
  MissionId,
  openMysteryLuckyBox,
  PLAYTIME_REWARD_COINS,
  PLAYTIME_TARGET_SEC,
  postLatestWithdrawToProofWall,
  PROMO_CODES_CATALOG,
  ProofWallItem,
  redeemPromoCode,
  registerLevel2SubInvite,
  registerLocalUser,
  RESTART_COIN_COST,
  saveEarnPlayState,
  SEASONAL_EVENTS_CATALOG,
  SeasonalEventId,
  selectSeasonalEvent,
  submitWithdrawRequest,
  TOURNAMENT_PRIZE_COINS,
  unlockBattlePass,
  VIDEO_AD_REWARD_COINS,
  VIDEO_PROOF_WALL_ITEMS,
  VIP_CLUB_DAILY_FREE_COINS,
  VIP_CLUB_MONTHLY_COST_COINS,
  WithdrawMethod,
} from './services/localEarnStore';
import type { CubeSkinId } from './game/colorPalette';

type PageId = 'home' | 'earn' | 'ranks' | 'refer' | 'withdraw' | 'login';
type GameArcadeMode = 'stack3d' | 'lucky_number' | 'guess_color';
type EarnSubTab = 'spin' | 'vault' | 'missions' | 'timer';
type RanksSubTab = 'top100' | 'tournament' | 'battle' | 'chat';
type AdRewardAction = 'save_life' | 'life' | 'coins' | 'restart' | 'spin' | 'mystery';

interface GradientBarProps {
  percent: number;
  label: string;
}

const GradientProgressBar: React.FC<GradientBarProps> = ({ percent, label }) => {
  const gradId = useId();
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      className="my-2 h-3 w-full overflow-hidden rounded-full bg-[#333866]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <svg className="block h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF2D95" />
            <stop offset="100%" stopColor="#00D68F" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={`${clamped}%`} height="100%" rx="6" fill={`url(#${gradId})`} />
      </svg>
    </div>
  );
};

const AVATAR_OPTIONS: { id: AvatarId; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'crown', label: 'Crown', Icon: Crown },
  { id: 'flame', label: 'Flame', Icon: Flame },
  { id: 'gem', label: 'Diamond', Icon: Gem },
  { id: 'bolt', label: 'Bolt', Icon: Zap },
  { id: 'rocket', label: 'Rocket', Icon: Rocket },
  { id: 'star', label: 'Star', Icon: Star },
];

function getAvatarIcon(avatarId: AvatarId): React.FC<{ className?: string }> {
  const found = AVATAR_OPTIONS.find((a) => a.id === avatarId);
  return found ? found.Icon : Crown;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<StackTowerEngine | null>(null);

  const [activePage, setActivePage] = useState<PageId>('home');
  const [gameMode, setGameMode] = useState<GameArcadeMode>('stack3d');
  const [earnSubTab, setEarnSubTab] = useState<EarnSubTab>('spin');
  const [ranksSubTab, setRanksSubTab] = useState<RanksSubTab>('top100');
  const [leaderboardSort, setLeaderboardSort] = useState<'coins' | 'score'>('coins');

  const [earnState, setEarnState] = useState<EarnPlayState>(() => loadEarnPlayState());
  const earnStateRef = useRef<EarnPlayState>(earnState);
  earnStateRef.current = earnState;

  const [phase, setPhase] = useState<GamePhase>('idle');
  const phaseRef = useRef<GamePhase>('idle');
  phaseRef.current = phase;

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [, setLevelInfo] = useState<LevelProgressionInfo>(() =>
    computeProgressionLevel(0, 4.6),
  );
  const [runCoins, setRunCoins] = useState(0);
  const [lastRunScore, setLastRunScore] = useState(0);
  const [lastRunCoins, setLastRunCoins] = useState(0);
  const [feedback, setFeedback] = useState<DropFeedback | null>(null);

  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [hapticsMuted, setHapticsMuted] = useState(() => hapticEngine.isMuted());

  // Live 1s Ticker for 9 PM Tournament, 2h Mystery Box & 8h Offline Sleep Vault
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());
  const [countdown9PM, setCountdown9PM] = useState<string>(() => getCountdownTo9PM());

  // Modals
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [adRewardType, setAdRewardType] = useState<AdRewardAction>('life');
  const [adSecondsLeft, setAdSecondsLeft] = useState(15);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [selectedProofModal, setSelectedProofModal] = useState<ProofWallItem | null>(null);

  // Page 6: Login / Register & Push state
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authMsg, setAuthMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pushPermStatus, setPushPermStatus] = useState(() => getNotificationPermission());

  // Page 4: Refer & Level-2 Team state
  const [refInput, setRefInput] = useState('');
  const [refMsg, setRefMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [teamSubInput, setTeamSubInput] = useState('');
  const [teamMsg, setTeamMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Earn / Vault / Promo / Tournament / Skin feedback messages
  const [promoInput, setPromoInput] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mysteryMsg, setMysteryMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [claim6hMsg, setClaim6hMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dailyBonusMsg, setDailyBonusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tournamentMsg, setTournamentMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [skinMsg, setSkinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Page 1: Game notice
  const [gameNotice, setGameNotice] = useState<string | null>(null);

  // Page 5: Withdraw state
  const [payMethod, setPayMethod] = useState<WithdrawMethod>('EasyPaisa');
  const [payNumber, setPayNumber] = useState('');
  const [payAmount, setPayAmount] = useState('100000');
  const [withdrawMsg, setWithdrawMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Toast banner
  const [toastBanner, setToastBanner] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const notifiedMysteryRef = useRef<boolean>(false);

  const { isInstallable, isInstalled, install } = usePWAInstall();

  const showToast = useCallback((msg: string) => {
    setToastBanner(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setToastBanner(null);
    }, 3800);
  }, []);

  const showPage = useCallback((page: PageId) => {
    soundEngine.playClick();
    setActivePage(page);
  }, []);

  // Grant Ad / VIP Instant Reward helper (shared by Web 15s Ad Modal, VIP Zero-Ad Skip, AND Native Android AdMob Rewarded callback!)
  const grantRewardByType = useCallback(
    (rewardType: AdRewardAction, fromNativeAdMob: boolean = false) => {
      soundEngine.playRewardFanfare();

      if (rewardType === 'coins') {
        const mult = getRewardMultiplier(earnStateRef.current);
        const added = VIDEO_AD_REWARD_COINS * mult;
        setEarnState((prev) =>
          saveEarnPlayState({
            ...prev,
            coins: prev.coins + added,
            adsToday: prev.adsToday + 1,
          }),
        );
        showToast(
          `+${added} Coins added${fromNativeAdMob ? ' (AdMob Rewarded Ad)' : ''}!`,
        );
        return;
      }

      if (rewardType === 'spin') {
        setEarnState((prev) =>
          saveEarnPlayState({
            ...prev,
            extraSpins: prev.extraSpins + 1,
            adsToday: prev.adsToday + 1,
          }),
        );
        showToast('+1 Extra Lucky Spin unlocked! Spin the wheel now!');
        return;
      }

      if (rewardType === 'mystery') {
        const res = openMysteryLuckyBox(earnStateRef.current, true);
        const updated = saveEarnPlayState({
          ...res.nextState,
          adsToday: res.nextState.adsToday + 1,
        });
        setEarnState(updated);
        setMysteryMsg({ ok: res.ok, text: res.message });
        showToast(res.message);
        return;
      }

      if (rewardType === 'restart') {
        setEarnState((prev) =>
          saveEarnPlayState({
            ...prev,
            lives: prev.lives + 1,
            adsToday: prev.adsToday + 1,
          }),
        );
        setGameNotice(null);
        showToast(
          fromNativeAdMob
            ? '+1 Life Earned from AdMob Rewarded Ad — Restarting!'
            : '+1 Life — Restarting Game!',
        );
        if (activePage === 'home' && gameMode === 'stack3d') {
          engineRef.current?.startNewGame();
        }
        return;
      }

      if (rewardType === 'save_life') {
        setEarnState((prev) =>
          saveEarnPlayState({
            ...prev,
            lives: prev.lives + 1,
            adsToday: prev.adsToday + 1,
          }),
        );
        setGameNotice(null);
        if (activePage === 'home' && gameMode === 'stack3d' && phaseRef.current === 'gameover') {
          engineRef.current?.reviveCurrentRun();
          showToast(
            fromNativeAdMob
              ? 'Life Saved (AdMob Rewarded)! Continuing your tower!'
              : 'Life Saved! Continuing your tower!',
          );
        } else {
          showToast(
            fromNativeAdMob
              ? '+1 Life Earned from AdMob Rewarded Ad!'
              : '+1 Life added — Ready to Play!',
          );
        }
        return;
      }

      // Default: 'life' (Watch Ad = +1 Life)
      setEarnState((prev) =>
        saveEarnPlayState({
          ...prev,
          lives: prev.lives + 1,
          adsToday: prev.adsToday + 1,
        }),
      );
      setGameNotice(null);
      if (activePage === 'home' && gameMode === 'stack3d' && phaseRef.current === 'gameover') {
        engineRef.current?.reviveCurrentRun();
        showToast(
          fromNativeAdMob
            ? 'Life Saved (AdMob Rewarded)! Continuing your tower!'
            : 'Life Saved! Continuing your tower!',
        );
      } else {
        showToast(
          fromNativeAdMob
            ? '+1 Life Earned from AdMob Rewarded Ad!'
            : '+1 Life added — Ready to Play!',
        );
      }
    },
    [activePage, gameMode, showToast],
  );

  // Register global window.giveLifeFromAd(), window.giveRewardFromAd(type), window.onNativeRewardedAdUnavailable(type), and window.watchAdForLife() for Android Studio WebView AdMob Rewarded bridge!
  useEffect(() => {
    window.giveLifeFromAd = () => {
      grantRewardByType('save_life', true);
    };
    window.giveRewardFromAd = (rawType: string) => {
      const normalized: AdRewardAction =
        rawType === 'save_life' ||
        rawType === 'coins' ||
        rawType === 'restart' ||
        rawType === 'spin' ||
        rawType === 'mystery'
          ? rawType
          : 'life';
      grantRewardByType(normalized, true);
    };
    window.onNativeRewardedAdUnavailable = (rawType: string) => {
      const normalized: AdRewardAction =
        rawType === 'save_life' ||
        rawType === 'coins' ||
        rawType === 'restart' ||
        rawType === 'spin' ||
        rawType === 'mystery'
          ? rawType
          : 'life';
      setAdRewardType(normalized);
      setAdSecondsLeft(15);
      setAdModalOpen(true);
    };
    window.watchAdForLife = () => {
      if (admobService.triggerRewardedAd('save_life')) {
        return;
      }
      setAdRewardType('save_life');
      setAdSecondsLeft(15);
      setAdModalOpen(true);
    };

    return () => {
      delete window.giveLifeFromAd;
      delete window.giveRewardFromAd;
      delete window.onNativeRewardedAdUnavailable;
      delete window.watchAdForLife;
    };
  }, [grantRewardByType]);

  // Capture ?code= or ?ref= invite parameter & Offline Sleep Vault welcome toast on boot
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('code') || params.get('ref');
      if (urlCode && urlCode.trim()) {
        setRefInput(urlCode.trim().toUpperCase());
        showToast(`Invite code ${urlCode.trim().toUpperCase()} detected! Open Refer to apply.`);
        return;
      }
    } catch {
      // ignore
    }

    const offlineStatus = getOfflineEarningsStatus(earnStateRef.current);
    if (offlineStatus.pendingCoins >= 5) {
      showToast(
        `Welcome back! +${offlineStatus.pendingCoins} Offline Sleep Coins waiting in Earn → Vault!`,
      );
    }
  }, [showToast]);

  // Start WebSocket Community & Real-Time Battle Alert Push Listener
  useEffect(() => {
    communityRealtimeService.ensureStarted();
    const unsubBattleAlert = communityRealtimeService.onNewRemoteBattle((battle) => {
      const myName = getActiveUser(earnStateRef.current)?.name ?? 'Guest Stacker';
      if (battle.creator !== myName && earnStateRef.current.pushAlertsEnabled) {
        void sendDeviceNotification(
          'New 1v1 Score Challenge!',
          `${battle.creator} scored ${battle.targetScore}! Beat ${battle.code} for +50 Coins!`,
          `battle-${battle.code}`,
        );
      }
    });
    return unsubBattleAlert;
  }, []);

  // Initialize AdMob Banner + preload Interstitial & Rewarded Ad
  useEffect(() => {
    admobService
      .initializeAndShowBanner()
      .then(() => admobService.preloadInterstitial())
      .catch(() => {});
  }, []);

  // Live 1-second Playtime Counter + Countdown Clocks + Mystery Box Push Trigger
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowTickMs(now);
      setCountdown9PM(getCountdownTo9PM());

      // Fire real OS Push Notification once when 2h Mystery Box unlocks while pushAlertsEnabled is true
      const boxStatus = getMysteryBoxStatus(earnStateRef.current, now);
      if (!boxStatus.ready) {
        notifiedMysteryRef.current = false;
      } else if (
        boxStatus.ready &&
        !notifiedMysteryRef.current &&
        earnStateRef.current.lastMysteryBoxMs > 0 &&
        earnStateRef.current.pushAlertsEnabled
      ) {
        notifiedMysteryRef.current = true;
        void sendDeviceNotification(
          'Your Lucky Mystery Box is Ready!',
          'Open your 2-hour Mystery Box now to win up to 500 Coins!',
          'cs3d-mystery-ready',
        );
      }

      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      setEarnState((prev) => {
        const today = getTodayDateKey();
        const isNewDay = prev.playDay !== today;
        const nextPlaySec = isNewDay ? 1 : prev.playSec + 1;
        const updated: EarnPlayState = {
          ...prev,
          playDay: today,
          playSec: nextPlaySec,
        };
        if (isNewDay || nextPlaySec % 10 === 0 || nextPlaySec === PLAYTIME_TARGET_SEC) {
          return saveEarnPlayState(updated);
        }
        return updated;
      });
    }, 1000);

    const handleBeforeUnload = () => {
      saveEarnPlayState(earnStateRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // 15-second Sponsored Ad Countdown (Web fallback)
  useEffect(() => {
    if (!adModalOpen) return;
    setAdSecondsLeft(15);
    const timer = window.setInterval(() => {
      setAdSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [adModalOpen]);

  // Sync equipped 3D Cube Skin to live engine
  useEffect(() => {
    engineRef.current?.setSkin(earnState.selectedSkin);
  }, [earnState.selectedSkin]);

  // Mount interactive Three.js 3D StackTowerEngine when on Page 1 ('home') & mode === 'stack3d'
  useEffect(() => {
    if (activePage !== 'home' || gameMode !== 'stack3d') return;
    const container = canvasMountRef.current;
    if (!container) return;

    setPhase('idle');
    phaseRef.current = 'idle';
    setScore(0);
    setCombo(0);
    setRunCoins(0);
    setFeedback(null);

    const engine = new StackTowerEngine(container, {
      onScoreChange: (newScore, newBest, newCombo, nextLevelInfo, nextRunCoins) => {
        setScore(newScore);
        setCombo(newCombo);
        setLevelInfo(nextLevelInfo);
        const mult =
          getStreakMultiplier(earnStateRef.current.streakDays) *
          getRewardMultiplier(earnStateRef.current);
        setRunCoins(nextRunCoins * mult);

        if (newBest > earnStateRef.current.best) {
          setEarnState((prev) =>
            saveEarnPlayState({
              ...prev,
              best: Math.max(prev.best, newBest),
            }),
          );
        }
      },
      onPhaseChange: (nextPhase) => {
        phaseRef.current = nextPhase;
        setPhase(nextPhase);
      },
      onDropFeedback: (fb) => {
        setFeedback(fb);
        setEarnState((prev) => {
          const next = {
            ...prev,
            totalBlocksStacked: prev.totalBlocksStacked + 1,
            blocksToday: prev.blocksToday + 1,
            perfectsToday: prev.perfectsToday + (fb.isPerfect ? 1 : 0),
          };
          if (next.totalBlocksStacked % 5 === 0) {
            return saveEarnPlayState(next);
          }
          return next;
        });
      },
      onGameOver: (finalScore, engineBest, _maxCombo, baseEarnedRunCoins) => {
        const mult =
          getStreakMultiplier(earnStateRef.current.streakDays) *
          getRewardMultiplier(earnStateRef.current);
        const totalRunCoins = baseEarnedRunCoins * mult;

        setLastRunScore(finalScore);
        setLastRunCoins(totalRunCoins);
        setFeedback(null);

        const vipNoAds = isVipClubActive(earnStateRef.current);

        setEarnState((prev) => {
          const nextLives = Math.max(0, prev.lives - 1);
          const nextBest = Math.max(prev.best, engineBest, finalScore);
          const nextTodayBest = Math.max(prev.todayBestScore, finalScore);
          return saveEarnPlayState({
            ...prev,
            coins: prev.coins + totalRunCoins,
            lives: nextLives,
            best: nextBest,
            todayBestScore: nextTodayBest,
          });
        });

        setGameNotice('Game Over! Watch an Ad for +1 Life to Restart or use 10 Coins.');

        void admobService.gameOver(vipNoAds).then((adRes) => {
          if (adRes.showWebSimulation) {
            setShowInterstitial(true);
          }
        });
      },
    });

    engine.setSkin(earnStateRef.current.selectedSkin);
    engine.setBestScore(earnStateRef.current.best);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [activePage, gameMode]);

  // Keyboard Spacebar support on 3D Stack Game page
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activePage !== 'home' || gameMode !== 'stack3d' || e.code !== 'Space') return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') {
        return;
      }
      if (
        adModalOpen ||
        showInterstitial ||
        showApkModal ||
        showPrivacyModal ||
        selectedProofModal
      ) {
        return;
      }

      if (
        phaseRef.current === 'playing' ||
        phaseRef.current === 'idle' ||
        phaseRef.current === 'gameover'
      ) {
        e.preventDefault();
        if (phaseRef.current !== 'playing' && earnStateRef.current.lives <= 0) {
          setGameNotice('No Lives left! Watch Save Life Ad or use 10 Coins to Restart.');
          return;
        }
        if (phaseRef.current === 'gameover') {
          setGameNotice(null);
          engineRef.current?.startNewGame();
          return;
        }
        engineRef.current?.handleTapAction();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activePage,
    gameMode,
    adModalOpen,
    showInterstitial,
    showApkModal,
    showPrivacyModal,
    selectedProofModal,
  ]);

  const startSponsoredAd = useCallback(
    (type: AdRewardAction) => {
      soundEngine.playClick();

      // Monthly VIP Club ($5/mo): Zero Ads! Instant reward with 0s wait!
      if (isVipClubActive(earnStateRef.current)) {
        grantRewardByType(type, false);
        return;
      }

      // Inside Android Studio APK: call real AdMob Rewarded Ad (ca-app-pub-8318388001860392/6818862582)!
      if (admobService.triggerRewardedAd(type)) {
        return;
      }

      // In Web Browser preview: show 15-second Sponsored Ad simulation modal
      setAdRewardType(type);
      setAdSecondsLeft(15);
      setAdModalOpen(true);
      void admobService.preloadInterstitial();
    },
    [grantRewardByType],
  );

  const playGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (phaseRef.current === 'playing') {
      engine.handleTapAction();
      return;
    }

    if (earnStateRef.current.lives <= 0) {
      setGameNotice('No Lives left! Watch Save Life Ad (+1 Life) or use 10 Coins to Restart.');
      return;
    }

    setGameNotice(null);
    engine.startNewGame();
  }, []);

  const handleRestartWithCoins = useCallback(() => {
    soundEngine.playClick();
    const current = earnStateRef.current;
    if (current.coins < RESTART_COIN_COST) {
      setGameNotice(`Need ${RESTART_COIN_COST} Coins to Restart. Watch an Ad for +1 Life instead!`);
      showToast(`Not enough coins (${RESTART_COIN_COST} Coins required). Watch an Ad for +1 Life!`);
      return;
    }

    const updated = saveEarnPlayState({
      ...current,
      coins: current.coins - RESTART_COIN_COST,
      lives: Math.max(1, current.lives),
    });
    setEarnState(updated);
    setGameNotice(null);
    showToast(`-${RESTART_COIN_COST} Coins used — Game Restarted!`);
    engineRef.current?.startNewGame();
  }, [showToast]);

  const finishAd = useCallback(() => {
    if (adSecondsLeft > 0) return;
    setAdModalOpen(false);
    grantRewardByType(adRewardType, false);
  }, [adRewardType, adSecondsLeft, grantRewardByType]);

  // Daily Login Bonus Claim
  const handleClaimDailyLogin = () => {
    soundEngine.playClick();
    const res = claimDailyLoginBonus(earnState);
    setDailyBonusMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
      showToast(res.message);
    }
  };

  // Lucky Spin Complete
  const handleSpinComplete = useCallback(
    (segmentCoins: number, usedFreeSpin: boolean) => {
      setEarnState((prev) => {
        const res = completeSpinWheel(prev, segmentCoins, usedFreeSpin);
        showToast(`Lucky Spin! +${res.rewardEarned} Coins added to your wallet!`);
        return res.nextState;
      });
    },
    [showToast],
  );

  // Promo / Gift Code Redeem
  const handleRedeemPromo = (codeToRedeem?: string) => {
    soundEngine.playClick();
    const target = codeToRedeem ?? promoInput;
    const res = redeemPromoCode(earnState, target);
    setPromoMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
      setPromoInput('');
    }
    showToast(res.message);
  };

  // 2-Hour Mystery Lucky Box Open
  const handleOpenMysteryBox = () => {
    soundEngine.playClick();
    const res = openMysteryLuckyBox(earnState, false);
    setMysteryMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  // 8-Hour Offline Sleep Coins Collect
  const handleCollectOfflineCoins = () => {
    soundEngine.playClick();
    const res = claimOfflineSleepCoins(earnState);
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  // Seasonal Event Switch (Eid / Ramzan / New Year / Standard)
  const handleChangeSeasonalEvent = (eventId: SeasonalEventId) => {
    soundEngine.playClick();
    const res = selectSeasonalEvent(earnState, eventId);
    if (res.ok) {
      soundEngine.playCoinCollect();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  // Monthly VIP Club ($5 = 5,000 Coins)
  const handleJoinVipClub = () => {
    soundEngine.playClick();
    const res = activateMonthlyVipClub(earnState);
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  const handleClaimVipDailyCoins = () => {
    soundEngine.playClick();
    const res = claimVipClubDailyCoins(earnState);
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  // Push Notifications Enable & Test
  const handleEnablePushNotifications = async () => {
    soundEngine.playClick();
    const permRes = await requestPushPermission();
    setPushPermStatus(permRes.status);
    const next = saveEarnPlayState({
      ...earnState,
      pushAlertsEnabled: true,
    });
    setEarnState(next);
    showToast(permRes.message);
    if (permRes.granted) {
      await sendDeviceNotification(
        'Color Stack 3D Alerts Active!',
        'Your Spin Wheel, 2h Mystery Box & Friend Battle alerts are now ON!',
        'cs3d-welcome-push',
      );
    }
  };

  const handleSendTestPush = async () => {
    soundEngine.playClick();
    const canSpin = canUseFreeSpinToday(earnState);
    const bodyText = canSpin
      ? 'Your Free Lucky Spin is Ready! Tap to spin & win Coins now!'
      : 'Friend Ahmed is climbing the leaderboard! Jump back in & stack higher!';
    const delivered = await sendDeviceNotification('Color Stack 3D Reminder', bodyText, 'cs3d-test');
    if (delivered) {
      showToast('Push Notification sent to your device!');
    } else {
      showToast(`Smart Alert: ${bodyText}`);
    }
  };

  // Daily Mission Claim
  const handleClaimMission = (missionId: MissionId) => {
    soundEngine.playClick();
    const res = claimDailyMission(earnState, missionId);
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  // Equip 3D Cube Skin
  const handleEquipSkin = (skinId: CubeSkinId) => {
    soundEngine.playClick();
    const res = equipCubeSkin(earnState, skinId);
    setSkinMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playCoinCollect();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  // Select Avatar
  const handleSelectAvatar = (avatarId: AvatarId) => {
    soundEngine.playClick();
    const updated = saveEarnPlayState({
      ...earnState,
      avatarId,
    });
    setEarnState(updated);
    showToast('Avatar updated!');
  };

  // Unlock VIP Battle Pass ($1 = 1,000 Coins)
  const handleActivateBattlePass = () => {
    soundEngine.playClick();
    const res = unlockBattlePass(earnState);
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  // Claim Daily 9 PM Tournament $1.00 Bonus
  const handleClaimTournamentPrize = () => {
    soundEngine.playClick();
    const res = claimTournamentWinnerBonus(earnState);
    setTournamentMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  // Auth
  const handleDoRegister = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    const res = registerLocalUser(earnState, authName, authEmail, authPass);
    setAuthMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      setEarnState(res.nextState);
      engineRef.current?.setBestScore(res.nextState.best);
      engineRef.current?.setSkin(res.nextState.selectedSkin);
      setAuthPass('');
      showToast(res.message);
    }
  };

  const handleDoLogin = () => {
    soundEngine.playClick();
    const res = loginLocalUser(earnState, authEmail, authPass);
    setAuthMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      setEarnState(res.nextState);
      engineRef.current?.setBestScore(res.nextState.best);
      engineRef.current?.setSkin(res.nextState.selectedSkin);
      setAuthPass('');
      showToast(res.message);
    }
  };

  const handleLogout = () => {
    soundEngine.playClick();
    const next = logoutLocalUser(earnState);
    setEarnState(next);
    setAuthMsg({ ok: true, text: 'Logged out successfully.' });
    showToast('Logged out successfully.');
  };

  const activeUser = getActiveUser(earnState);
  const myCode = activeUser ? activeUser.code : 'LOGIN FIRST';

  const handleCopyCode = async () => {
    soundEngine.playClick();
    if (!activeUser) {
      setActivePage('login');
      setAuthMsg({ ok: false, text: 'Please Register or Login first to get your Refer Code.' });
      return;
    }

    try {
      await navigator.clipboard.writeText(activeUser.code);
      setCopiedCode(true);
      showToast(`Code copied: ${activeUser.code}`);
      window.setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setRefMsg({ ok: true, text: `Your Code: ${activeUser.code}` });
    }
  };

  const handleShareCode = async () => {
    soundEngine.playClick();
    if (!activeUser) {
      setActivePage('login');
      setAuthMsg({ ok: false, text: 'Please Register or Login first to share your Invite Link.' });
      return;
    }

    const inviteOrigin =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://colorstack3d.app/invite';
    const shareUrl = `${inviteOrigin}?code=${activeUser.code}`;
    const shareText = `Play Color Stack 3D & Earn USD! Use my Refer Code ${activeUser.code} for +20 Coins (plus Level-2 Team Bonus!): ${shareUrl}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Color Stack 3D',
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(`Invite link copied: ${shareUrl}`);
    } catch {
      setRefMsg({ ok: true, text: `Share this link: ${shareUrl}` });
    }
  };

  const handleApplyRef = () => {
    soundEngine.playClick();
    const res = applyFriendReferralCode(earnState, refInput);
    setRefMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playCoinCollect();
      setEarnState(res.nextState);
      setRefInput('');
      showToast(res.message);
    }
  };

  const handleClaimLevel2SubInvite = () => {
    soundEngine.playClick();
    const parentCode = earnState.refs.find((r) => r.level !== 2)?.code ?? '';
    const res = registerLevel2SubInvite(earnState, parentCode, teamSubInput);
    setTeamMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
      setTeamSubInput('');
    }
    showToast(res.message);
  };

  const handleClaim6h = () => {
    soundEngine.playClick();
    const res = claimSixHourPlayReward(earnState);
    setClaim6hMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
      showToast(res.message);
    }
  };

  const handleRequestWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    const amt = parseInt(payAmount, 10);
    const res = submitWithdrawRequest(earnState, payMethod, payNumber, amt);
    setWithdrawMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
      setPayNumber('');
      setPayAmount('100000');
      showToast(res.message);

      // Broadcast celebration to Live Community Chat!
      const sender = activeUser ? activeUser.name : 'Verified Player';
      communityRealtimeService.sendChatMessage({
        sender,
        tier: getPlayerRank(res.nextState.coins + amt),
        avatarId: earnState.avatarId,
        text: `Just submitted a $${(amt / 1000).toFixed(2)} USD withdrawal via ${payMethod}!`,
        kind: 'payout',
      });
    }
  };

  const handlePostWithdrawToWall = () => {
    soundEngine.playClick();
    const res = postLatestWithdrawToProofWall(earnState);
    if (res.ok) {
      soundEngine.playRewardFanfare();
      setEarnState(res.nextState);
    }
    showToast(res.message);
  };

  const handleToggleSound = () => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
    if (!nextMuted) soundEngine.playClick();
  };

  const handleToggleHaptics = () => {
    const nextMuted = hapticEngine.toggleMute();
    setHapticsMuted(nextMuted);
    if (!nextMuted) hapticEngine.vibrateTap();
  };

  // Derived progression & economy metrics
  const playerLevel = getPlayerLevel(earnState);
  const levelProgressPct = getNextLevelProgressPercent(earnState.totalBlocksStacked);
  const playerRank = getPlayerRank(earnState.coins);
  const streakMultiplier = getStreakMultiplier(earnState.streakDays);
  const rewardMult = getRewardMultiplier(earnState);
  const totalRunMultiplier = streakMultiplier * rewardMult;
  const vipClubActive = isVipClubActive(earnState, nowTickMs);
  const vipClubDaysLeft = getVipClubDaysRemaining(earnState, nowTickMs);
  const equippedSkinSpec =
    CUBE_SKINS_CATALOG.find((s) => s.id === earnState.selectedSkin) ?? CUBE_SKINS_CATALOG[0];
  const activeEventSpec =
    SEASONAL_EVENTS_CATALOG.find((e) => e.id === earnState.activeSeasonalEvent) ??
    SEASONAL_EVENTS_CATALOG[0];

  const level1Refs = useMemo(
    () => earnState.refs.filter((r) => r.level !== 2),
    [earnState.refs],
  );
  const level2Refs = useMemo(
    () => earnState.refs.filter((r) => r.level === 2),
    [earnState.refs],
  );
  const refCount = level1Refs.length;
  const refPercent = Math.min(100, (refCount / INVITES_REQUIRED_FOR_WITHDRAW) * 100);
  const withdrawLocked = refCount < INVITES_REQUIRED_FOR_WITHDRAW;

  const todayKey = getTodayDateKey();
  const is6hClaimedToday = earnState.claimed6hDay === todayKey;
  const playPercent = Math.min(100, (earnState.playSec / PLAYTIME_TARGET_SEC) * 100);
  const is6hReady = earnState.playSec >= PLAYTIME_TARGET_SEC && !is6hClaimedToday;

  const isLoginBonusClaimedToday = earnState.lastLoginBonusDate === todayKey;
  const isVipDailyClaimedToday = earnState.lastVipDailyDate === todayKey;
  const canFreeSpin = canUseFreeSpinToday(earnState);

  const mysteryStatus = getMysteryBoxStatus(earnState, nowTickMs);
  const offlineStatus = getOfflineEarningsStatus(earnState, nowTickMs);

  const usdBalance = coinsToUsdString(earnState.coins);
  const SelectedAvatarIcon = getAvatarIcon(earnState.avatarId);

  const top100Rows = useMemo(
    () => getTop100Leaderboard(earnState, leaderboardSort),
    [earnState, leaderboardSort],
  );
  const yourRankRow = useMemo(() => top100Rows.find((r) => r.isYou) ?? null, [top100Rows]);
  const tournamentRows = useMemo(() => getTournamentStandings(earnState), [earnState]);
  const isTournamentClaimedToday = earnState.claimedTournamentDay === todayKey;

  const allProofWallItems = useMemo(
    () => [...earnState.userProofWall, ...VIDEO_PROOF_WALL_ITEMS],
    [earnState.userProofWall],
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#0F1226] text-white">
      {/* FIXED TOP HEADER (56px) */}
      <header className="z-20 flex h-[56px] shrink-0 items-center justify-between border-b border-[#2A2E5A] bg-[#14173A] px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/pwa-192x192.png"
            alt="Color Stack 3D"
            referrerPolicy="no-referrer"
            className="h-9 w-9 shrink-0 rounded-lg border border-white/15 object-cover"
          />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-extrabold leading-tight text-white sm:text-lg">
              Color Stack 3D
            </div>
            <span className="block truncate text-xs font-normal text-[#aaa] tabular-nums">
              {activeUser ? activeUser.name : 'Guest'} • {playerRank} • ${usdBalance} USD
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => showPage('login')}
            className="flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-white px-3 py-2 text-xs font-extrabold text-black transition hover:bg-slate-100 active:scale-95"
          >
            <SelectedAvatarIcon className="h-3.5 w-3.5 text-[#0F1226]" />
            <span>{vipClubActive ? 'VIP' : `Lv.${playerLevel}`}</span>
          </button>
          <button
            type="button"
            onClick={() => showPage('earn')}
            className="min-h-[38px] whitespace-nowrap rounded-[10px] bg-[#00D68F] px-3.5 py-2 text-xs font-extrabold text-black transition hover:brightness-105 active:scale-95"
          >
            Earn USD
          </button>
        </div>
      </header>

      {/* FLOATING TOAST FEEDBACK */}
      {toastBanner && (
        <div className="pointer-events-none fixed inset-x-0 top-[64px] z-40 mx-auto flex max-w-md justify-center px-3">
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-[#00D68F]/40 bg-[#14173A]/95 px-4 py-2.5 text-xs font-bold text-[#00D68F] shadow-xl backdrop-blur-md">
            <span>{toastBanner}</span>
            <button
              type="button"
              onClick={() => setToastBanner(null)}
              className="text-slate-300 hover:text-white"
              aria-label="Close message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PAGE 1: GAME FULL SCREEN (3-IN-1: 3D STACK, LUCKY NUM, GUESS COLOR) */}
      {/* =================================================================== */}
      {activePage === 'home' && (
        <main className="flex flex-1 flex-col overflow-hidden p-2.5 sm:p-3">
          <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-2xl bg-[#1C214E] p-3">
            {/* Top Stats Bar */}
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold sm:text-sm tabular-nums">
              <div className="truncate">
                Lv. {playerLevel} • Coins{' '}
                <span className="text-[#00D68F]">{earnState.coins.toLocaleString()}</span> • Lives{' '}
                <span className="text-[#FF5A7A]">{earnState.lives}</span>
              </div>
              <div className="shrink-0">
                Best: <b className="text-[#FFCC00]">{earnState.best}</b> •{' '}
                <span className="text-orange-300">
                  {earnState.streakDays}d ({totalRunMultiplier}x)
                </span>
              </div>
            </div>

            {/* Compact 3-in-1 Arcade Switcher */}
            <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-[#0F1226] p-1">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setGameMode('stack3d');
                }}
                className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-extrabold transition sm:text-xs ${
                  gameMode === 'stack3d'
                    ? 'bg-[#00D68F] text-black'
                    : 'text-[#bbb] hover:text-white'
                }`}
              >
                3D Stack
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setGameMode('lucky_number');
                }}
                className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-extrabold transition sm:text-xs ${
                  gameMode === 'lucky_number'
                    ? 'bg-[#00D68F] text-black'
                    : 'text-[#bbb] hover:text-white'
                }`}
              >
                Lucky Number
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setGameMode('guess_color');
                }}
                className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-extrabold transition sm:text-xs ${
                  gameMode === 'guess_color'
                    ? 'bg-[#00D68F] text-black'
                    : 'text-[#bbb] hover:text-white'
                }`}
              >
                Guess Color
              </button>
            </div>

            {gameMode === 'stack3d' ? (
              <>
                {/* Full-Height Interactive 3D Game Area */}
                <div
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    playGame();
                  }}
                  className="relative flex-1 w-full cursor-pointer select-none overflow-hidden rounded-2xl bg-black touch-manipulation"
                >
                  <div ref={canvasMountRef} className="h-full w-full" />

                  {/* Quick Audio/Haptic Mute Buttons */}
                  <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleToggleSound}
                      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-xs hover:bg-black/75"
                    >
                      {muted ? (
                        <VolumeX className="h-4 w-4 text-[#FF5A7A]" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleHaptics}
                      aria-label={hapticsMuted ? 'Enable vibration' : 'Disable vibration'}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-xs hover:bg-black/75"
                    >
                      {hapticsMuted ? (
                        <VibrateOff className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Vibrate className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Score Display */}
                  <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center text-center">
                    <div className="font-display text-[42px] font-black leading-none text-white drop-shadow-md tabular-nums">
                      {score}
                    </div>
                    {phase === 'playing' && (
                      <div className="mt-1 text-xs font-bold text-[#00D68F] drop-shadow tabular-nums">
                        +{runCoins} Coins
                        {totalRunMultiplier > 1 ? ` (${totalRunMultiplier}x)` : ''}
                        {combo >= 2 ? ` • Perfect ×${combo}` : ''}
                      </div>
                    )}
                  </div>

                  {/* Floating Perfect / Coin Feedback */}
                  {feedback && phase === 'playing' && (
                    <div
                      key={feedback.id}
                      className="animate-score-pop pointer-events-none absolute left-1/2 top-1/3 z-10 -translate-x-1/2 text-center"
                    >
                      <div className="font-display text-base font-extrabold text-white drop-shadow">
                        {feedback.expanded
                          ? 'MEGA EXPAND!'
                          : feedback.isPerfect
                            ? `PERFECT ×${feedback.combo}`
                            : `+${feedback.pointsAdded}`}
                      </div>
                      <div className="text-xs font-bold text-[#00D68F] tabular-nums">
                        +{feedback.coinsAdded * totalRunMultiplier} Coins
                      </div>
                    </div>
                  )}

                  {/* Idle Prompt Box */}
                  {phase === 'idle' && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-center px-3 text-center">
                      <div className="rounded-[10px] bg-black/85 px-4 py-2.5 backdrop-blur-xs">
                        <b className="block text-sm font-extrabold text-white">
                          {earnState.lives > 0 ? 'TAP TO START 3D STACK' : 'NO LIVES LEFT (0)'}
                        </b>
                        <span className="text-xs text-[#bbb]">
                          Tap at the right time to stack blocks &amp; earn coins
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Game Over Overlay */}
                  {phase === 'gameover' && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 p-4 text-center backdrop-blur-xs">
                      <div className="font-display text-2xl font-black text-white">GAME OVER</div>
                      <p className="mt-1 text-xs text-[#bbb] tabular-nums">
                        Score: <b className="text-white">{lastRunScore}</b> • Earned:{' '}
                        <b className="text-[#00D68F]">+{lastRunCoins} Coins</b> • Best:{' '}
                        <b className="text-[#FFCC00]">{earnState.best}</b>
                      </p>
                      <div className="mt-3.5 flex w-full max-w-xs gap-2">
                        <button
                          type="button"
                          onClick={() => startSponsoredAd('save_life')}
                          className="flex-1 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-3 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 active:scale-95"
                        >
                          {vipClubActive ? 'VIP Save Life' : 'Watch Save Life'}
                        </button>
                        {earnState.lives > 0 ? (
                          <button
                            type="button"
                            onClick={playGame}
                            className="flex-1 whitespace-nowrap rounded-[10px] bg-white px-3 py-2.5 text-xs font-extrabold text-black transition hover:bg-slate-100 active:scale-95"
                          >
                            Play Again ({earnState.lives} Left)
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRestartWithCoins}
                            disabled={earnState.coins < RESTART_COIN_COST}
                            className="flex-1 whitespace-nowrap rounded-[10px] bg-white px-3 py-2.5 text-xs font-extrabold text-black transition hover:bg-slate-100 disabled:opacity-50 active:scale-95"
                          >
                            Restart (10 Coins)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Controls inside Game Card */}
                <div className="mt-2.5 flex gap-2">
                  {phase === 'gameover' ? (
                    earnState.lives > 0 ? (
                      <button
                        type="button"
                        onClick={playGame}
                        className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-3.5 py-2 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        <span>Play Again ({earnState.lives} Lives)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRestartWithCoins}
                        disabled={earnState.coins < RESTART_COIN_COST}
                        className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-3.5 py-2 text-xs font-extrabold text-black transition hover:brightness-105 disabled:opacity-50 sm:text-sm"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        <span>Restart (10 Coins)</span>
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={playGame}
                      className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-3.5 py-2 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>{phase === 'playing' ? 'Tap to Stack' : 'Tap to Start'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => startSponsoredAd(phase === 'gameover' ? 'save_life' : 'life')}
                    className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-white px-3.5 py-2 text-xs font-extrabold text-black transition hover:bg-slate-100 sm:text-sm"
                  >
                    <Heart className="h-4 w-4 fill-[#FF5A7A] text-[#FF5A7A]" />
                    <span>
                      {vipClubActive
                        ? 'Free VIP +1 Life'
                        : phase === 'gameover'
                          ? 'Watch Save Life'
                          : 'Watch Ad = +1 Life'}
                    </span>
                  </button>
                </div>

                <p className="mt-1.5 truncate text-xs text-[#bbb]">
                  {gameNotice ||
                    `${activeEventSpec.name} (${activeEventSpec.badge}) • Skin: ${equippedSkinSpec.name}`}
                </p>
              </>
            ) : (
              <MiniGamesArcade
                mode={gameMode}
                earnState={earnState}
                onUpdateState={(nextState, msg, won) => {
                  if (won) soundEngine.playRewardFanfare();
                  setEarnState(nextState);
                  showToast(msg);
                }}
              />
            )}
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* PAGE 2: EARN (SPIN, VAULT & PROMO CODES, MISSIONS, 6H $5 BONUS)     */}
      {/* =================================================================== */}
      {activePage === 'earn' && (
        <main className="flex-1 overflow-y-auto p-3">
          <div className="mx-auto max-w-2xl space-y-3">
            {/* Wallet & 4-Tab Sub-Navigation */}
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-white">
                    Earn USD &amp; Rewards Hub
                  </h2>
                  <p className="mt-0.5 text-xs text-[#bbb] tabular-nums">
                    Wallet:{' '}
                    <b className="text-[#00D68F]">
                      {earnState.coins.toLocaleString()} Coins (${usdBalance} USD)
                    </b>{' '}
                    • Multiplier: <b className="text-[#FFCC00]">{rewardMult}x Active</b>
                  </p>
                </div>
                {vipClubActive && (
                  <span className="text-xs font-extrabold text-[#00D68F]">
                    VIP Club ({vipClubDaysLeft}d)
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-[#0F1226] p-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setEarnSubTab('spin');
                  }}
                  className={`min-h-[36px] whitespace-nowrap rounded-lg px-1.5 py-2 text-[11px] font-extrabold transition sm:text-xs ${
                    earnSubTab === 'spin'
                      ? 'bg-[#00D68F] text-black'
                      : 'text-[#bbb] hover:text-white'
                  }`}
                >
                  Spin &amp; Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setEarnSubTab('vault');
                  }}
                  className={`min-h-[36px] whitespace-nowrap rounded-lg px-1.5 py-2 text-[11px] font-extrabold transition sm:text-xs ${
                    earnSubTab === 'vault'
                      ? 'bg-[#00D68F] text-black'
                      : 'text-[#bbb] hover:text-white'
                  }`}
                >
                  Vault &amp; Codes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setEarnSubTab('missions');
                  }}
                  className={`min-h-[36px] whitespace-nowrap rounded-lg px-1.5 py-2 text-[11px] font-extrabold transition sm:text-xs ${
                    earnSubTab === 'missions'
                      ? 'bg-[#00D68F] text-black'
                      : 'text-[#bbb] hover:text-white'
                  }`}
                >
                  Missions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setEarnSubTab('timer');
                  }}
                  className={`min-h-[36px] whitespace-nowrap rounded-lg px-1.5 py-2 text-[11px] font-extrabold transition sm:text-xs ${
                    earnSubTab === 'timer'
                      ? 'bg-[#00D68F] text-black'
                      : 'text-[#bbb] hover:text-white'
                  }`}
                >
                  6H $5
                </button>
              </div>
            </div>

            {/* SUB-TAB 1: SPIN WHEEL, 7-DAY LOGIN & SEASONAL EVENT */}
            {earnSubTab === 'spin' && (
              <>
                {/* Seasonal Event Banner & Switcher (Eid / Ramzan / New Year) */}
                <div className="rounded-2xl border border-[#FFCC00]/35 bg-[#1C214E] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-extrabold text-[#FFCC00]">
                        Seasonal Festival: {activeEventSpec.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#bbb]">{activeEventSpec.description}</p>
                    </div>
                    <Moon className="h-5 w-5 shrink-0 text-[#FFCC00]" />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {SEASONAL_EVENTS_CATALOG.map((ev) => {
                      const active = earnState.activeSeasonalEvent === ev.id;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => handleChangeSeasonalEvent(ev.id)}
                          className={`min-h-[36px] whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-extrabold transition ${
                            active
                              ? 'border-[#FFCC00] bg-[#FFCC00] text-black'
                              : 'border-[#333866] bg-[#0F1226] text-[#bbb] hover:text-white'
                          }`}
                        >
                          {ev.id === 'eid'
                            ? 'Eid 2x'
                            : ev.id === 'ramzan'
                              ? 'Ramzan Skin'
                              : ev.id === 'newyear'
                                ? 'New Year 2x'
                                : 'Standard'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <LuckySpinWheelCard
                  canFreeSpin={canFreeSpin}
                  extraSpins={earnState.extraSpins}
                  rewardMultiplier={rewardMult}
                  vipZeroAds={vipClubActive}
                  onSpinComplete={handleSpinComplete}
                  onRequestExtraSpinAd={() => startSponsoredAd('spin')}
                />

                {/* 7-Day Daily Login Bonus Calendar */}
                <div className="rounded-2xl bg-[#1C214E] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-extrabold text-white">
                        7-Day Daily Login Bonus
                      </h3>
                      <p className="mt-0.5 text-xs text-[#bbb]">
                        Log in daily for escalating coin drops • Day 7 = {100 * rewardMult} Coins
                      </p>
                    </div>
                    <Flame className="h-5 w-5 shrink-0 text-orange-400" />
                  </div>

                  <div className="mt-3 grid grid-cols-7 gap-1.5 text-center tabular-nums">
                    {DAILY_LOGIN_REWARDS.map((baseCoins, idx) => {
                      const dayNum = idx + 1;
                      const activeDay = earnState.loginBonusDay;
                      const isCurrentTarget = dayNum === activeDay && !isLoginBonusClaimedToday;
                      const isDone =
                        dayNum < activeDay ||
                        (isLoginBonusClaimedToday &&
                          ((activeDay === 1 && dayNum === 7) || dayNum === activeDay - 1));
                      const displayReward = baseCoins * rewardMult;

                      return (
                        <div
                          key={dayNum}
                          className={`rounded-xl border p-2 ${
                            isCurrentTarget
                              ? 'border-[#00D68F] bg-[#00D68F]/15 text-white'
                              : isDone
                                ? 'border-[#00D68F]/40 bg-[#0F1226] text-[#00D68F]'
                                : 'border-[#333866] bg-[#0F1226] text-[#bbb]'
                          }`}
                        >
                          <div className="text-[10px] font-bold">D{dayNum}</div>
                          <div className="mt-0.5 text-xs font-extrabold text-white">
                            +{displayReward}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {dailyBonusMsg && (
                    <p
                      className={`mt-2.5 text-xs font-semibold ${
                        dailyBonusMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                      }`}
                    >
                      {dailyBonusMsg.text}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={isLoginBonusClaimedToday}
                    onClick={handleClaimDailyLogin}
                    className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  >
                    <Gift className="h-4 w-4" />
                    <span>
                      {isLoginBonusClaimedToday
                        ? 'Today’s Login Bonus Claimed'
                        : `Claim Day ${earnState.loginBonusDay} Bonus (+${
                            DAILY_LOGIN_REWARDS[earnState.loginBonusDay - 1] * rewardMult
                          } Coins)`}
                    </span>
                  </button>

                  <p className="mt-2.5 text-xs text-[#bbb] tabular-nums">
                    Active Streak: <b className="text-white">{earnState.streakDays} Day(s)</b> • 3+
                    Days = <b className="text-[#00D68F]">2x Run Coins</b> • 7+ Days ={' '}
                    <b className="text-[#FFCC00]">3x Run Coins</b>
                  </p>
                </div>
              </>
            )}

            {/* SUB-TAB 2: VAULT & CODES (2H MYSTERY BOX, 8H OFFLINE COINS, PROMO CODES) */}
            {earnSubTab === 'vault' && (
              <>
                {/* 2-Hour Lucky Mystery Box */}
                <div className="rounded-2xl bg-[#1C214E] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-extrabold text-white sm:text-lg">
                        Lucky Mystery Box (Every 2 Hours)
                      </h3>
                      <p className="mt-0.5 text-xs text-[#bbb] tabular-nums">
                        Surprise mystery drop from {5 * rewardMult} Coins up to{' '}
                        <b className="text-[#FFCC00]">{500 * rewardMult} Coins Jackpot</b>!
                      </p>
                    </div>
                    <Box className="h-6 w-6 shrink-0 text-[#FFCC00]" />
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-[#333866] bg-[#0F1226] p-3 text-xs sm:text-sm tabular-nums">
                    <span>Box Status:</span>
                    <b className={mysteryStatus.ready ? 'text-[#00D68F]' : 'text-[#FFCC00]'}>
                      {mysteryStatus.ready
                        ? 'UNLOCKED — Open Now!'
                        : `Unlocks in ${mysteryStatus.formattedCountdown}`}
                    </b>
                  </div>

                  {mysteryMsg && (
                    <p
                      className={`mt-2 text-xs font-semibold ${
                        mysteryMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                      }`}
                    >
                      {mysteryMsg.text}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!mysteryStatus.ready}
                      onClick={handleOpenMysteryBox}
                      className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 disabled:opacity-50 sm:text-sm"
                    >
                      <Gift className="h-4 w-4" />
                      <span>{mysteryStatus.ready ? 'Open Mystery Box' : 'Cooling Down...'}</span>
                    </button>

                    {!mysteryStatus.ready && (
                      <button
                        type="button"
                        onClick={() => startSponsoredAd('mystery')}
                        className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-white px-4 py-2.5 text-xs font-extrabold text-black transition hover:bg-slate-100 sm:text-sm"
                      >
                        <Tv className="h-4 w-4 text-[#0F1226]" />
                        <span>
                          {vipClubActive ? 'VIP Instant Open' : 'Watch Ad to Open Now'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Offline Earning — Sleep Vault (8 Hours = 50 Coins) */}
                <div className="rounded-2xl bg-[#1C214E] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-extrabold text-white sm:text-lg">
                        Offline Sleep Vault (8h Auto-Miner)
                      </h3>
                      <p className="mt-0.5 text-xs text-[#bbb] tabular-nums">
                        Earns coins automatically even when the app is closed! Max capacity:{' '}
                        <b className="text-white">{offlineStatus.maxCoins} Coins</b> per 8 hours.
                      </p>
                    </div>
                    <Moon className="h-5 w-5 shrink-0 text-[#00D68F]" />
                  </div>

                  <GradientProgressBar
                    percent={offlineStatus.percentFull}
                    label="Offline Sleep Vault Capacity"
                  />

                  <div className="flex items-center justify-between text-xs text-white sm:text-sm tabular-nums">
                    <span>
                      Stored: <b className="text-[#00D68F]">+{offlineStatus.pendingCoins} Coins</b>{' '}
                      / {offlineStatus.maxCoins}
                    </span>
                    <span className="text-[#bbb]">{offlineStatus.cappedHours}h / 8.0h</span>
                  </div>

                  <button
                    type="button"
                    disabled={offlineStatus.pendingCoins < 1}
                    onClick={handleCollectOfflineCoins}
                    className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 disabled:opacity-50 sm:text-sm"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {offlineStatus.pendingCoins >= 1
                        ? `Collect +${offlineStatus.pendingCoins} Offline Coins`
                        : 'Generating Offline Coins...'}
                    </span>
                  </button>
                </div>

                {/* Gift Code / Promo Code Redemption */}
                <div className="rounded-2xl bg-[#1C214E] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-extrabold text-white sm:text-lg">
                        Redeem Gift / Promo Code
                      </h3>
                      <p className="mt-0.5 text-xs text-[#bbb]">
                        Enter YouTube / TikTok creator promo codes for instant free coins!
                      </p>
                    </div>
                    <Ticket className="h-5 w-5 shrink-0 text-[#FFCC00]" />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Enter Code e.g. EID100 or RAMZAN50"
                      className="min-w-0 flex-1 rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#00D68F]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRedeemPromo()}
                      className="min-h-[42px] shrink-0 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
                    >
                      Redeem
                    </button>
                  </div>

                  {/* Quick Tap Promo Codes */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {PROMO_CODES_CATALOG.map((p) => {
                      const used = earnState.redeemedPromoCodes.includes(p.code);
                      return (
                        <button
                          key={p.code}
                          type="button"
                          disabled={used}
                          onClick={() => handleRedeemPromo(p.code)}
                          className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                            used
                              ? 'border-[#333866] bg-[#0F1226] text-[#666] line-through'
                              : 'border-[#333866] bg-[#0F1226] text-[#00D68F] hover:border-[#00D68F]'
                          }`}
                        >
                          {p.code} (+{p.baseCoins})
                        </button>
                      );
                    })}
                  </div>

                  {promoMsg && (
                    <p
                      className={`mt-2 text-xs font-semibold ${
                        promoMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                      }`}
                    >
                      {promoMsg.text}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* SUB-TAB 3: DAILY MISSIONS + MONTHLY VIP CLUB + BATTLE PASS */}
            {earnSubTab === 'missions' && (
              <>
                {/* Monthly VIP Club ($5/mo = 5,000 Coins) */}
                <div className="rounded-2xl border border-[#00D68F]/45 bg-[#1C214E] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-extrabold text-[#00D68F] sm:text-lg">
                        Monthly VIP Club ($5.00 / mo = 5,000 Coins)
                      </h3>
                      <p className="mt-0.5 text-xs text-[#bbb]">
                        • +100 Free Coins Every Day • 1-Hour Express Withdrawals • Zero Forced Ads
                        (Instant Ad Rewards!) • Unlimited Free Mini-Games
                      </p>
                    </div>
                    <Crown className="h-6 w-6 shrink-0 text-[#00D68F]" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {vipClubActive ? (
                      <button
                        type="button"
                        disabled={isVipDailyClaimedToday}
                        onClick={handleClaimVipDailyCoins}
                        className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 disabled:opacity-50 sm:text-sm"
                      >
                        <Gift className="h-4 w-4" />
                        <span>
                          {isVipDailyClaimedToday
                            ? `VIP Daily +${VIP_CLUB_DAILY_FREE_COINS} Claimed (${vipClubDaysLeft}d left)`
                            : `Claim +${VIP_CLUB_DAILY_FREE_COINS} Daily VIP Coins`}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleJoinVipClub}
                        className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
                      >
                        <Crown className="h-4 w-4" />
                        <span>
                          Join Monthly VIP Club ({VIP_CLUB_MONTHLY_COST_COINS.toLocaleString()}{' '}
                          Coins)
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Daily Missions */}
                <div className="rounded-2xl bg-[#1C214E] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-extrabold text-white">
                        Daily Missions
                      </h3>
                      <p className="mt-0.5 text-xs text-[#bbb]">
                        Complete simple tasks every day to collect bonus coins.
                      </p>
                    </div>
                    <Target className="h-5 w-5 shrink-0 text-[#00D68F]" />
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {DAILY_MISSIONS_CATALOG.map((mission) => {
                      const currentVal = getMissionProgressValue(earnState, mission.id);
                      const pct = Math.min(100, (currentVal / mission.target) * 100);
                      const isClaimed = earnState.claimedMissions.includes(mission.id);
                      const isComplete = currentVal >= mission.target;
                      const rewardAmt = mission.rewardCoins * rewardMult;

                      return (
                        <div
                          key={mission.id}
                          className="rounded-xl border border-[#333866] bg-[#0F1226] p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <b className="text-xs font-bold text-white sm:text-sm">
                              {mission.title}
                            </b>
                            <span className="shrink-0 text-xs font-extrabold text-[#00D68F] tabular-nums">
                              +{rewardAmt} Coins
                            </span>
                          </div>

                          <GradientProgressBar percent={pct} label={mission.title} />

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-[#bbb] tabular-nums">
                              Progress: {Math.min(currentVal, mission.target)} / {mission.target}
                            </span>

                            <button
                              type="button"
                              disabled={isClaimed || !isComplete}
                              onClick={() => handleClaimMission(mission.id)}
                              className="min-h-[34px] whitespace-nowrap rounded-lg bg-[#00D68F] px-3.5 py-1.5 text-xs font-extrabold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {isClaimed ? 'Claimed' : isComplete ? 'Claim Reward' : 'In Progress'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Watch Video Ad Quick Card */}
                <div className="rounded-2xl bg-[#1C214E] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <b className="block text-sm font-bold text-white sm:text-base">
                        {vipClubActive ? 'Instant VIP Bonus' : 'Watch Video Ad'} = +
                        {VIDEO_AD_REWARD_COINS * rewardMult} Coins
                      </b>
                      <span className="text-xs text-[#bbb] tabular-nums">
                        {vipClubActive
                          ? 'Zero-Ad VIP Club perk • Instant claim!'
                          : `AdMob Rewarded Slot • Ads watched today: ${earnState.adsToday}`}
                      </span>
                    </div>
                    <Tv className="h-5 w-5 shrink-0 text-[#00D68F]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => startSponsoredAd('coins')}
                    className="mt-3 min-h-[42px] whitespace-nowrap rounded-[10px] bg-[#00D68F] px-5 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
                  >
                    {vipClubActive
                      ? `Claim Free +${VIDEO_AD_REWARD_COINS * rewardMult} Coins`
                      : `Watch Ad (+${VIDEO_AD_REWARD_COINS * rewardMult} Coins)`}
                  </button>
                </div>

                {/* VIP Battle Pass ($1 = 1,000 Coins) */}
                <div className="rounded-2xl border border-[#FFCC00]/35 bg-[#1C214E] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-extrabold text-[#FFCC00]">
                        2x Battle Pass ($1.00 = 1,000 Coins)
                      </h3>
                      <p className="mt-0.5 text-xs text-[#bbb]">
                        Stacks with Seasonal Events to multiply Run Coins, Spin Wheel, Login &amp;
                        Mission rewards!
                      </p>
                    </div>
                    <Crown className="h-6 w-6 shrink-0 text-[#FFCC00]" />
                  </div>
                  <button
                    type="button"
                    disabled={earnState.battlePassActive}
                    onClick={handleActivateBattlePass}
                    className="mt-3 min-h-[42px] w-full whitespace-nowrap rounded-[10px] bg-[#FFCC00] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 disabled:opacity-60 sm:text-sm"
                  >
                    {earnState.battlePassActive
                      ? '2x Battle Pass Active'
                      : `Unlock 2x Battle Pass (${BATTLE_PASS_COST_COINS.toLocaleString()} Coins)`}
                  </button>
                </div>
              </>
            )}

            {/* SUB-TAB 4: DAILY PLAY 6 HOURS = $5.00 BONUS */}
            {earnSubTab === 'timer' && (
              <div className="rounded-2xl bg-[#1C214E] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-extrabold text-white">
                    Daily Play 6 Hours &amp; Earn $5.00
                  </h3>
                  <Clock className="h-5 w-5 shrink-0 text-[#00D68F]" />
                </div>
                <p className="mt-1 text-xs text-[#bbb] sm:text-sm">
                  Play 6 hours daily to earn {PLAYTIME_REWARD_COINS.toLocaleString()} Coins ($5.00
                  USD reward every day).
                </p>

                <p className="mt-4 text-sm text-white tabular-nums">
                  Today&apos;s Play Time: <b>{formatPlayDuration(earnState.playSec)}</b> / 6h 0m
                </p>

                <GradientProgressBar
                  percent={playPercent}
                  label="Daily 6 Hours Playtime Progress"
                />

                <p className="text-xs text-white sm:text-sm">
                  Status:{' '}
                  <span
                    className={
                      is6hReady || is6hClaimedToday ? 'font-bold text-[#00D68F]' : 'text-[#bbb]'
                    }
                  >
                    {is6hClaimedToday
                      ? 'Claimed Today ($5.00 added — resets tomorrow)'
                      : is6hReady
                        ? 'Reward Ready ($5.00 = 5,000 Coins)'
                        : `Locked (${Math.floor(playPercent)}% complete - unlocks after 6 hours)`}
                  </span>
                </p>

                {claim6hMsg && (
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      claim6hMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                    }`}
                  >
                    {claim6hMsg.text}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleClaim6h}
                  disabled={!is6hReady}
                  className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-3 text-sm font-extrabold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Gift className="h-4 w-4" />
                  <span>
                    {is6hClaimedToday
                      ? 'Claimed Today ($5.00)'
                      : is6hReady
                        ? 'Claim Daily $5.00 Reward (+5,000 Coins)'
                        : 'Claim Daily $5.00 Reward (Locked)'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* PAGE 3: RANKS, 9PM CUP, 1V1 FRIEND BATTLE & LIVE COMMUNITY CHAT     */}
      {/* =================================================================== */}
      {activePage === 'ranks' && (
        <main className="flex-1 overflow-y-auto p-3">
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-white">
                    Ranks, 1v1 Battles &amp; Live Chat
                  </h2>
                  <p className="mt-0.5 text-xs text-[#bbb] tabular-nums">
                    Global Rank: <b className="text-[#00D68F]">#{yourRankRow?.rank ?? 100}</b> •
                    Tier: <b className="text-[#FFCC00]">{playerRank}</b> • 1v1 Wins:{' '}
                    <b className="text-white">{earnState.battlesWon}</b>
                  </p>
                </div>
                <Trophy className="h-6 w-6 shrink-0 text-[#FFCC00]" />
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-[#0F1226] p-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setRanksSubTab('top100');
                  }}
                  className={`min-h-[36px] whitespace-nowrap rounded-lg px-1.5 py-2 text-[11px] font-extrabold transition sm:text-xs ${
                    ranksSubTab === 'top100'
                      ? 'bg-[#00D68F] text-black'
                      : 'text-[#bbb] hover:text-white'
                  }`}
                >
                  Top 100
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setRanksSubTab('tournament');
                  }}
                  className={`min-h-[36px] whitespace-nowrap rounded-lg px-1.5 py-2 text-[11px] font-extrabold transition sm:text-xs ${
                    ranksSubTab === 'tournament'
                      ? 'bg-[#FFCC00] text-black'
                      : 'text-[#bbb] hover:text-white'
                  }`}
                >
                  9PM Cup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setRanksSubTab('battle');
                  }}
                  className={`min-h-[36px] whitespace-nowrap rounded-lg px-1.5 py-2 text-[11px] font-extrabold transition sm:text-xs ${
                    ranksSubTab === 'battle'
                      ? 'bg-[#00D68F] text-black'
                      : 'text-[#bbb] hover:text-white'
                  }`}
                >
                  1v1 Battle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setRanksSubTab('chat');
                  }}
                  className={`min-h-[36px] whitespace-nowrap rounded-lg px-1.5 py-2 text-[11px] font-extrabold transition sm:text-xs ${
                    ranksSubTab === 'chat'
                      ? 'bg-[#00D68F] text-black'
                      : 'text-[#bbb] hover:text-white'
                  }`}
                >
                  Live Chat
                </button>
              </div>
            </div>

            {ranksSubTab === 'top100' && (
              <div className="rounded-2xl bg-[#1C214E] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-base font-extrabold text-white">
                    Top 100 Players
                  </h3>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setLeaderboardSort('coins');
                      }}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        leaderboardSort === 'coins'
                          ? 'bg-white text-black'
                          : 'bg-[#0F1226] text-[#bbb] hover:text-white'
                      }`}
                    >
                      Most Coins
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setLeaderboardSort('score');
                      }}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        leaderboardSort === 'score'
                          ? 'bg-white text-black'
                          : 'bg-[#0F1226] text-[#bbb] hover:text-white'
                      }`}
                    >
                      Best Score
                    </button>
                  </div>
                </div>

                <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-xl border border-[#333866] bg-[#0F1226] px-3 py-1">
                  <table className="w-full text-xs sm:text-sm tabular-nums">
                    <thead>
                      <tr className="border-b border-[#333866] text-left text-[11px] text-[#bbb]">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Player</th>
                        <th className="py-2 pr-2">Rank</th>
                        <th className="py-2 pr-2 text-right">Best</th>
                        <th className="py-2 text-right">Coins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top100Rows.map((row) => (
                        <tr
                          key={`${row.rank}_${row.name}`}
                          className={`border-b border-[#333866]/60 ${
                            row.isYou ? 'bg-[#00D68F]/15 font-bold text-white' : 'text-slate-200'
                          }`}
                        >
                          <td className="py-2 pr-2 font-extrabold text-[#FFCC00]">#{row.rank}</td>
                          <td className="max-w-[125px] truncate py-2 pr-2">{row.name}</td>
                          <td className="py-2 pr-2 text-[11px] text-[#bbb]">{row.tier}</td>
                          <td className="py-2 pr-2 text-right text-white">{row.bestScore}</td>
                          <td className="py-2 text-right font-bold text-[#00D68F]">
                            {row.coins.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {ranksSubTab === 'tournament' && (
              <div className="rounded-2xl bg-[#1C214E] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-extrabold text-[#FFCC00] sm:text-lg">
                      Daily 9:00 PM Championship
                    </h3>
                    <p className="mt-0.5 text-xs text-[#bbb]">
                      Rank #1 Today at 9:00 PM wins{' '}
                      <b className="text-white">
                        +{TOURNAMENT_PRIZE_COINS.toLocaleString()} Coins ($1.00 Bonus)
                      </b>
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-[#00D68F] tabular-nums">
                    Ends in {countdown9PM}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-[#333866] bg-[#0F1226] p-3 text-xs sm:text-sm tabular-nums">
                  Your Today&apos;s Best Score:{' '}
                  <b className="text-[#FFCC00]">{earnState.todayBestScore}</b> • All-Time Best:{' '}
                  <b className="text-white">{earnState.best}</b>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-[#333866] bg-[#0F1226] px-3 py-1">
                  <table className="w-full text-xs sm:text-sm tabular-nums">
                    <thead>
                      <tr className="border-b border-[#333866] text-left text-[11px] text-[#bbb]">
                        <th className="py-2 pr-2">Pos</th>
                        <th className="py-2 pr-2">Contender</th>
                        <th className="py-2 text-right">Today&apos;s Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournamentRows.map((row) => (
                        <tr
                          key={`${row.rank}_${row.name}`}
                          className={`border-b border-[#333866]/60 ${
                            row.isYou ? 'bg-[#00D68F]/15 font-bold text-white' : 'text-slate-200'
                          }`}
                        >
                          <td className="py-2 pr-2 font-extrabold text-[#FFCC00]">#{row.rank}</td>
                          <td className="py-2 pr-2">{row.name}</td>
                          <td className="py-2 text-right font-bold text-[#00D68F]">
                            {row.todayScore}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {tournamentMsg && (
                  <p
                    className={`mt-2.5 text-xs font-semibold ${
                      tournamentMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                    }`}
                  >
                    {tournamentMsg.text}
                  </p>
                )}

                <div className="mt-3.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGameMode('stack3d');
                      showPage('home');
                    }}
                    className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-white px-4 py-2.5 text-xs font-extrabold text-black transition hover:bg-slate-100 sm:text-sm"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Play Tournament Run</span>
                  </button>

                  <button
                    type="button"
                    disabled={isTournamentClaimedToday}
                    onClick={handleClaimTournamentPrize}
                    className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#FFCC00] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 disabled:opacity-50 sm:text-sm"
                  >
                    <Trophy className="h-4 w-4" />
                    <span>
                      {isTournamentClaimedToday ? 'Claimed Today ($1.00)' : 'Claim $1.00 #1 Prize'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {(ranksSubTab === 'battle' || ranksSubTab === 'chat') && (
              <CommunityAndBattlesPanel
                mode={ranksSubTab === 'battle' ? 'battle' : 'chat'}
                earnState={earnState}
                onUpdateState={setEarnState}
                onShowToast={showToast}
                onJumpToGame={() => {
                  setGameMode('stack3d');
                  showPage('home');
                }}
              />
            )}
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* PAGE 4: REFER + LEVEL 2 TEAM INCOME (+5 COINS PER SUB-INVITE)       */}
      {/* =================================================================== */}
      {activePage === 'refer' && (
        <main className="flex-1 overflow-y-auto p-3">
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <h2 className="font-display text-lg font-extrabold text-white">
                Refer &amp; Level-2 Team Income
              </h2>

              <p className="mt-2 text-sm text-white">
                Your Code: <b className="font-mono text-base text-[#00D68F]">{myCode}</b>
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-white px-3.5 py-2.5 text-xs font-extrabold text-black transition hover:bg-slate-100 sm:text-sm"
                >
                  {copiedCode ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleShareCode()}
                  className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-3.5 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share Invite Link</span>
                </button>
              </div>

              {/* 2-Tier Commission Summary */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs tabular-nums">
                <div className="rounded-xl border border-[#333866] bg-[#0F1226] p-3">
                  <span className="text-[#bbb]">Level 1 Direct Invites</span>
                  <b className="mt-0.5 block text-sm font-extrabold text-white">
                    {refCount} Friends (+{COINS_PER_INVITE} Coins ea.)
                  </b>
                </div>
                <div className="rounded-xl border border-[#333866] bg-[#0F1226] p-3">
                  <span className="text-[#bbb]">Level 2 Team Network</span>
                  <b className="mt-0.5 block text-sm font-extrabold text-[#FFCC00]">
                    {level2Refs.length} Sub-Team (+{COINS_PER_LEVEL2_INVITE} Coins ea.)
                  </b>
                </div>
              </div>

              <GradientProgressBar percent={refPercent} label="50 Invites Progress" />

              <p className="text-xs text-white sm:text-sm tabular-nums">
                <b>
                  {refCount} / {INVITES_REQUIRED_FOR_WITHDRAW} Direct Invites
                </b>{' '}
                —{' '}
                <span className={withdrawLocked ? 'text-[#bbb]' : 'font-bold text-[#00D68F]'}>
                  {withdrawLocked
                    ? 'Withdraw Locked (Unlocks at 50 Direct Invites)'
                    : 'Withdraw Unlocked — Ready to Cash Out!'}
                </span>
              </p>

              {/* Apply Level-1 Friend Code */}
              <div className="mt-3.5">
                <input
                  type="text"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                  placeholder="Enter Friend's Refer Code (+20 Coins)"
                  className="w-full rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#00D68F]"
                />
                <button
                  type="button"
                  onClick={handleApplyRef}
                  className="mt-2 min-h-[42px] w-full whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-sm font-extrabold text-black transition hover:brightness-105"
                >
                  Apply Level-1 Refer Code
                </button>
              </div>

              {refMsg && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    refMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                  }`}
                >
                  {refMsg.text}
                </p>
              )}
            </div>

            {/* Level-2 Team Sub-Invite Claim Card */}
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <h3 className="font-display text-base font-extrabold text-[#FFCC00]">
                Level-2 Team Commission (+{COINS_PER_LEVEL2_INVITE} Coins)
              </h3>
              <p className="mt-0.5 text-xs text-[#bbb]">
                When your invited friend invites their friend, enter their friend&apos;s code below
                (or let them register on this device) to earn +{COINS_PER_LEVEL2_INVITE} Team Coins!
              </p>

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={teamSubInput}
                  onChange={(e) => setTeamSubInput(e.target.value.toUpperCase())}
                  placeholder="Friend's Invited Member Code"
                  className="min-w-0 flex-1 rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#FFCC00]"
                />
                <button
                  type="button"
                  onClick={handleClaimLevel2SubInvite}
                  className="min-h-[42px] shrink-0 whitespace-nowrap rounded-[10px] bg-[#FFCC00] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
                >
                  Claim +5
                </button>
              </div>

              {teamMsg && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    teamMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                  }`}
                >
                  {teamMsg.text}
                </p>
              )}

              <h4 className="mt-4 font-display text-sm font-bold text-white">
                Referral &amp; Team Network Ledger
              </h4>
              <table className="mt-2 w-full text-xs sm:text-sm tabular-nums">
                <tbody>
                  {earnState.refs.length === 0 ? (
                    <tr>
                      <td className="border-b border-[#333866] py-2 text-[#bbb]">
                        No referrals yet — share your code above!
                      </td>
                    </tr>
                  ) : (
                    earnState.refs.map((r, idx) => (
                      <tr key={r.id} className="border-b border-[#333866]">
                        <td className="py-2 pr-2 text-[#bbb]">#{idx + 1}</td>
                        <td className="py-2 pr-2 font-mono font-semibold text-white">{r.name}</td>
                        <td className="py-2 pr-2 text-[11px] text-[#FFCC00]">
                          {r.level === 2 ? 'Level 2 Team' : 'Level 1 Direct'}
                        </td>
                        <td className="py-2 text-right font-bold text-[#00D68F]">
                          +{r.coinsEarned} Coins
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* PAGE 5: WITHDRAW + VIDEO & SCREENSHOT PROOF WALL                    */}
      {/* =================================================================== */}
      {activePage === 'withdraw' && (
        <main className="flex-1 overflow-y-auto p-3">
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-extrabold text-white">
                  Withdraw — EasyPaisa / JazzCash / RedotPay
                </h2>
                {vipClubActive && (
                  <span className="text-xs font-extrabold text-[#00D68F]">
                    1-Hour VIP Express Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#bbb] sm:text-sm">
                Minimum Withdraw: $100 = {MIN_WITHDRAW_COINS.toLocaleString()} Coins. Unlocks after{' '}
                {INVITES_REQUIRED_FOR_WITHDRAW} Direct Invites.
              </p>

              <form onSubmit={handleRequestWithdraw} className="mt-3 space-y-2.5">
                <select
                  aria-label="Payment Method"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as WithdrawMethod)}
                  className="w-full rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white outline-none focus:border-[#00D68F]"
                >
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="RedotPay">RedotPay</option>
                </select>

                <input
                  type="text"
                  value={payNumber}
                  onChange={(e) => setPayNumber(e.target.value)}
                  placeholder="EasyPaisa / JazzCash Number or RedotPay Email / ID"
                  className="w-full rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#00D68F]"
                />

                <input
                  type="number"
                  min={MIN_WITHDRAW_COINS}
                  step={1000}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Amount in Coins - e.g 100000"
                  className="w-full rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#00D68F] tabular-nums"
                />

                {withdrawMsg && (
                  <p
                    className={`text-xs font-semibold ${
                      withdrawMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                    }`}
                  >
                    {withdrawMsg.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={withdrawLocked}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-3 text-xs font-extrabold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                >
                  {withdrawLocked ? (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>
                        Withdraw Locked — {INVITES_REQUIRED_FOR_WITHDRAW} Invites Required (
                        {refCount}/{INVITES_REQUIRED_FOR_WITHDRAW})
                      </span>
                    </>
                  ) : (
                    <span>
                      {vipClubActive
                        ? 'Request 1-Hour VIP Express Withdraw'
                        : 'Request Withdraw'}
                    </span>
                  )}
                </button>
              </form>

              <p className="mt-2.5 text-xs text-[#bbb]">
                {vipClubActive
                  ? 'VIP Express Priority: Payout arrives within 1 hour.'
                  : 'Standard Payout: Arrives in 24-48 hours (Join Monthly VIP Club for 1-hour express!).'}
              </p>

              {/* Personal Withdraw History */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-white">
                    Your Withdraw History
                  </h3>
                  {earnState.withdraws.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePostWithdrawToWall}
                      className="whitespace-nowrap rounded-lg bg-white px-2.5 py-1 text-[11px] font-extrabold text-black"
                    >
                      Post Receipt to Proof Wall
                    </button>
                  )}
                </div>

                {earnState.withdraws.length === 0 ? (
                  <p className="text-xs text-[#bbb]">No withdraw requests yet</p>
                ) : (
                  earnState.withdraws.map((w) => (
                    <div
                      key={w.id}
                      className="rounded-xl border border-white/10 bg-[#0F1226] p-3 text-xs text-slate-200 tabular-nums"
                    >
                      <span className="font-bold text-white">{w.method}</span> —{' '}
                      {w.amount.toLocaleString()} Coins (${w.usd.toFixed(2)}) — {w.number} —{' '}
                      <b className="text-[#00D68F]">{w.status}</b> —{' '}
                      <span className="text-[#bbb]">{w.date}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Video & Receipt Proof Wall */}
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-extrabold text-white sm:text-lg">
                    Video &amp; Receipt Proof Wall
                  </h3>
                  <p className="mt-0.5 text-xs text-[#bbb]">
                    Verified community payout clips &amp; payment slips across JazzCash, EasyPaisa
                    &amp; RedotPay.
                  </p>
                </div>
                <Award className="h-6 w-6 shrink-0 text-[#00D68F]" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {allProofWallItems.map((proof) => (
                  <div
                    key={proof.id}
                    className="flex flex-col justify-between rounded-xl border border-[#333866] bg-[#0F1226] p-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <b className="truncate text-xs font-extrabold text-white sm:text-sm">
                          {proof.player}
                        </b>
                        <span className="shrink-0 text-xs font-black text-[#00D68F] tabular-nums">
                          ${proof.usd.toFixed(2)}
                        </span>
                      </div>

                      <div className="mt-1 text-[11px] text-[#bbb] tabular-nums">
                        {proof.method} • {proof.txRef} • {proof.timeAgo}
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-slate-200">
                        &ldquo;{proof.caption}&rdquo;
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[#333866]/60 pt-2">
                      <span className="text-[11px] text-[#FFCC00]">{proof.payoutSpeed}</span>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setSelectedProofModal(proof);
                        }}
                        className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-white px-2.5 py-1 text-[11px] font-extrabold text-black transition hover:bg-slate-100"
                      >
                        {proof.mediaType === 'Video Proof' ? (
                          <Video className="h-3.5 w-3.5 text-[#0F1226]" />
                        ) : (
                          <FileCheck2 className="h-3.5 w-3.5 text-[#0F1226]" />
                        )}
                        <span>{proof.durationLabel}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-[#1C214E] p-4">
              <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-white">
                <ShieldCheck className="h-5 w-5 text-[#00D68F]" />
                <span>We Don&apos;t Break Hearts</span>
              </h3>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-[#bbb] sm:text-sm">
                <li>• No hidden charges</li>
                <li>• Coins will never be deleted</li>
                <li>• Withdraw status always visible — Pending / Approved / Paid</li>
              </ul>
            </div>
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* PAGE 6: PROFILE, SKINS, MONTHLY VIP CLUB, PUSH ALERTS & LOGIN       */}
      {/* =================================================================== */}
      {activePage === 'login' && (
        <main className="flex-1 overflow-y-auto p-3">
          <div className="mx-auto max-w-2xl space-y-3">
            {/* Player Profile, Avatar & Rank Progression */}
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#00D68F]/40 bg-[#0F1226] text-[#00D68F]">
                  <SelectedAvatarIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base font-extrabold text-white sm:text-lg">
                    {activeUser ? activeUser.name : 'Guest Stacker'}
                  </div>
                  <p className="text-xs text-[#bbb] tabular-nums">
                    Level {playerLevel} • <b className="text-[#FFCC00]">{playerRank} Rank</b> •{' '}
                    {earnState.streakDays}d Streak ({streakMultiplier}x)
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-[#bbb] tabular-nums">
                  <span>Progress to Level {playerLevel + 1}</span>
                  <span>
                    {levelProgressPct}% ({earnState.totalBlocksStacked} Blocks Stacked)
                  </span>
                </div>
                <GradientProgressBar
                  percent={levelProgressPct}
                  label="Player Level XP Progress"
                />
              </div>

              {/* Selectable Avatars */}
              <div className="mt-3">
                <div className="text-xs font-bold text-white">Choose Avatar</div>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.map(({ id, label, Icon }) => {
                    const selected = earnState.avatarId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSelectAvatar(id)}
                        aria-label={`Select ${label} avatar`}
                        className={`flex h-11 flex-col items-center justify-center rounded-xl border transition ${
                          selected
                            ? 'border-[#00D68F] bg-[#00D68F]/20 text-[#00D68F]'
                            : 'border-[#333866] bg-[#0F1226] text-[#bbb] hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Monthly VIP Club ($5 = 5,000 Coins) */}
            <div className="rounded-2xl border border-[#00D68F]/45 bg-[#1C214E] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-extrabold text-[#00D68F]">
                    Monthly VIP Club ($5.00 / mo = 5,000 Coins)
                  </h3>
                  <p className="mt-0.5 text-xs text-[#bbb]">
                    Get +100 Free Coins daily, 1-Hour Express Withdrawals, Zero Forced Ads &amp;
                    Free Mini-Games!
                  </p>
                </div>
                <Crown className="h-5 w-5 shrink-0 text-[#00D68F]" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {vipClubActive ? (
                  <button
                    type="button"
                    disabled={isVipDailyClaimedToday}
                    onClick={handleClaimVipDailyCoins}
                    className="min-h-[42px] w-full whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 disabled:opacity-55 sm:text-sm"
                  >
                    {isVipDailyClaimedToday
                      ? `VIP Club Active (${vipClubDaysLeft}d left) — Daily +100 Claimed`
                      : `Claim Today's +${VIP_CLUB_DAILY_FREE_COINS} VIP Coins`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleJoinVipClub}
                    className="min-h-[42px] w-full whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
                  >
                    Join Monthly VIP Club ({VIP_CLUB_MONTHLY_COST_COINS.toLocaleString()} Coins)
                  </button>
                )}
              </div>
            </div>

            {/* 3D Cube Skins Selector (Including Ramzan Crescent Skin!) */}
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-extrabold text-white">
                    3D Cube Skins (5 Unlockable)
                  </h3>
                  <p className="mt-0.5 text-xs text-[#bbb]">
                    Equip metallic, crystalline, molten &amp; seasonal Ramzan 3D skins!
                  </p>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-[#FFCC00]" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {CUBE_SKINS_CATALOG.map((skin) => {
                  const unlocked = isSkinUnlocked(earnState, skin.id);
                  const equipped = earnState.selectedSkin === skin.id;

                  return (
                    <div
                      key={skin.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                        equipped
                          ? 'border-[#00D68F] bg-[#00D68F]/10'
                          : 'border-[#333866] bg-[#0F1226]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br ${skin.previewClass} shadow-md`}
                        />
                        <div className="min-w-0">
                          <b className="block truncate text-xs font-extrabold text-white sm:text-sm">
                            {skin.name}
                          </b>
                          <span className="block truncate text-[11px] text-[#bbb]">
                            {skin.subtitle}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleEquipSkin(skin.id)}
                        disabled={equipped}
                        className={`min-h-[34px] shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                          equipped
                            ? 'bg-[#00D68F] text-black'
                            : unlocked
                              ? 'bg-white text-black hover:bg-slate-100'
                              : 'bg-[#1C214E] text-[#bbb]'
                        }`}
                      >
                        {equipped
                          ? 'Equipped'
                          : unlocked
                            ? 'Equip'
                            : skin.id === 'ramzan'
                              ? 'RAMZAN50'
                              : `Lv. ${skin.unlockLevel}`}
                      </button>
                    </div>
                  );
                })}
              </div>

              {skinMsg && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    skinMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                  }`}
                >
                  {skinMsg.text}
                </p>
              )}
            </div>

            {/* Push Notification Reminders */}
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-extrabold text-white">
                    Push Notification Reminders
                  </h3>
                  <p className="mt-0.5 text-xs text-[#bbb]">
                    Get notified when your Free Spin, 2-Hour Mystery Box, or Friend Battle is ready!
                    (Status: <b className="text-white">{pushPermStatus}</b>)
                  </p>
                </div>
                <Bell className="h-5 w-5 shrink-0 text-[#FFCC00]" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleEnablePushNotifications()}
                  className="min-h-[40px] flex-1 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-3.5 py-2 text-xs font-extrabold text-black transition hover:brightness-105"
                >
                  {earnState.pushAlertsEnabled ? 'Push Reminders Active' : 'Enable Push Alerts'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendTestPush()}
                  className="min-h-[40px] flex-1 whitespace-nowrap rounded-[10px] bg-white px-3.5 py-2 text-xs font-extrabold text-black transition hover:bg-slate-100"
                >
                  Send Test Notification
                </button>
              </div>
            </div>

            {/* Login / Register - Simple */}
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <h2 className="font-display text-lg font-extrabold text-white">
                Login / Register — Simple
              </h2>
              <p className="mt-1 text-xs text-[#bbb] sm:text-sm">
                Login with Email + Password. Saved locally on your phone.
              </p>

              {activeUser ? (
                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5 rounded-xl border border-white/10 bg-[#0F1226] p-3.5 text-xs sm:text-sm">
                    <div>
                      Name: <b className="text-white">{activeUser.name}</b>
                    </div>
                    <div>
                      Email: <b className="text-slate-200">{activeUser.email}</b>
                    </div>
                    <div>
                      Your Refer Code:{' '}
                      <b className="font-mono text-[#00D68F]">{activeUser.code}</b>
                    </div>
                    <div className="tabular-nums">
                      Wallet:{' '}
                      <b className="text-[#00D68F]">
                        {earnState.coins.toLocaleString()} Coins (${usdBalance} USD)
                      </b>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-[42px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-white px-4 py-2.5 text-sm font-extrabold text-black transition hover:bg-slate-100"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDoRegister} className="mt-3 space-y-2.5">
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Name (For Register)"
                    className="w-full rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#00D68F]"
                  />
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#00D68F]"
                  />
                  <input
                    type="password"
                    value={authPass}
                    onChange={(e) => setAuthPass(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#00D68F]"
                  />

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="min-h-[42px] flex-1 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-sm font-extrabold text-black transition hover:brightness-105"
                    >
                      Register
                    </button>
                    <button
                      type="button"
                      onClick={handleDoLogin}
                      className="min-h-[42px] flex-1 whitespace-nowrap rounded-[10px] bg-white px-4 py-2.5 text-sm font-extrabold text-black transition hover:bg-slate-100"
                    >
                      Login
                    </button>
                  </div>
                </form>
              )}

              {authMsg && (
                <p
                  className={`mt-3 text-xs font-semibold ${
                    authMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                  }`}
                >
                  {authMsg.text}
                </p>
              )}
            </div>

            {/* Privacy Policy & Support (Play Store Ready) */}
            <div className="rounded-2xl bg-[#1C214E] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-white">
                    Privacy Policy &amp; Support
                  </h3>
                  <p className="mt-0.5 text-xs text-[#bbb]">
                    Offline-ready gameplay • Support: bilalshafique1399@gmail.com
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#00D68F]" />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setShowPrivacyModal(true);
                  }}
                  className="flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-[10px] bg-white px-4 py-2 text-xs font-extrabold text-black hover:bg-slate-100"
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span>Read Privacy Policy</span>
                </button>
                <a
                  href="/privacy-policy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-[10px] border border-white/15 bg-[#0F1226] px-4 py-2 text-xs font-bold text-white hover:bg-white/5"
                >
                  <span>Privacy Policy Page</span>
                </a>
              </div>
            </div>

            {/* App & Android APK Download Options (Web Only) */}
            {!admobService.isNative() && (
              <div className="rounded-2xl bg-[#1C214E] p-4">
                <h3 className="font-display text-sm font-bold text-white">
                  Mobile App &amp; Android APK (Google AdMob Production Ready)
                </h3>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setShowApkModal(true);
                    }}
                    className="flex min-h-[42px] items-center gap-2 whitespace-nowrap rounded-[10px] border border-white/15 bg-[#0F1226] px-4 py-2 text-xs font-bold text-white hover:bg-white/5"
                  >
                    <Smartphone className="h-4 w-4 text-[#00D68F]" />
                    <span>Android APK Project</span>
                  </button>

                  {isInstallable && !isInstalled && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        void install();
                      }}
                      className="flex min-h-[42px] items-center gap-2 whitespace-nowrap rounded-[10px] bg-white px-4 py-2 text-xs font-extrabold text-black hover:bg-slate-100"
                    >
                      <Download className="h-4 w-4" />
                      <span>Install App</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* FIXED 6-TAB BOTTOM NAVIGATION BAR (70px)                            */}
      {/* =================================================================== */}
      <footer className="z-20 shrink-0 border-t border-[#2A2E5A] bg-[#14173A]">
        <nav
          aria-label="Bottom Navigation"
          className="mx-auto grid h-[70px] w-full max-w-3xl grid-cols-6 items-center"
        >
          <button
            type="button"
            onClick={() => showPage('home')}
            className={`flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] transition active:scale-95 ${
              activePage === 'home' ? 'font-extrabold text-[#00D68F]' : 'text-[#aaa] hover:text-white'
            }`}
          >
            <Gamepad2 className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Game</span>
          </button>

          <button
            type="button"
            onClick={() => showPage('earn')}
            className={`flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] transition active:scale-95 ${
              activePage === 'earn' ? 'font-extrabold text-[#00D68F]' : 'text-[#aaa] hover:text-white'
            }`}
          >
            <DollarSign className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Earn</span>
          </button>

          <button
            type="button"
            onClick={() => showPage('ranks')}
            className={`flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] transition active:scale-95 ${
              activePage === 'ranks' ? 'font-extrabold text-[#00D68F]' : 'text-[#aaa] hover:text-white'
            }`}
          >
            <Trophy className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Ranks</span>
          </button>

          <button
            type="button"
            onClick={() => showPage('refer')}
            className={`flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] transition active:scale-95 ${
              activePage === 'refer' ? 'font-extrabold text-[#00D68F]' : 'text-[#aaa] hover:text-white'
            }`}
          >
            <Users className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Refer</span>
          </button>

          <button
            type="button"
            onClick={() => showPage('withdraw')}
            className={`flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] transition active:scale-95 ${
              activePage === 'withdraw'
                ? 'font-extrabold text-[#00D68F]'
                : 'text-[#aaa] hover:text-white'
            }`}
          >
            <Wallet className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Withdraw</span>
          </button>

          <button
            type="button"
            onClick={() => showPage('login')}
            className={`flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] transition active:scale-95 ${
              activePage === 'login'
                ? 'font-extrabold text-[#00D68F]'
                : 'text-[#aaa] hover:text-white'
            }`}
          >
            <User className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Profile</span>
          </button>
        </nav>

        <AdMobBannerBar vipZeroAds={vipClubActive} />
      </footer>

      {/* =================================================================== */}
      {/* 15-SECOND SPONSORED REWARD VIDEO MODAL (WEB / OFFLINE FALLBACK)     */}
      {/* =================================================================== */}
      {adModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Sponsored Reward Video"
        >
          <div className="w-full max-w-[420px] rounded-[18px] bg-[#1C214E] p-4 shadow-2xl">
            <div className="rounded-xl bg-black p-5 text-center" data-ad-unit-id={ADMOB_CONFIG.REWARDED_AD_ID}>
              <h2 className="font-display text-xl font-extrabold text-white">
                Sponsored Reward Video
              </h2>
              <p className="mt-2 text-sm text-slate-200">
                {adSecondsLeft > 0
                  ? 'Watch the full sponsored video to unlock your reward...'
                  : 'Reward Unlocked! Tap below to claim'}
              </p>
              <div className="my-3 font-display text-5xl font-black text-[#00D68F] tabular-nums">
                {adSecondsLeft}
              </div>
              <p className="text-xs text-[#bbb]">
                Reward:{' '}
                {adRewardType === 'coins'
                  ? `+${VIDEO_AD_REWARD_COINS * rewardMult} Coins`
                  : adRewardType === 'spin'
                    ? '+1 Extra Lucky Spin'
                    : adRewardType === 'mystery'
                      ? 'Instant Mystery Lucky Box'
                      : adRewardType === 'save_life'
                        ? 'Save Life & Continue Tower'
                        : '+1 Life (Watch Save Life)'}
              </p>
              <button
                type="button"
                disabled={adSecondsLeft > 0}
                onClick={finishAd}
                className="mt-4 min-h-[42px] w-full whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-sm font-extrabold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {adSecondsLeft > 0 ? `Wait ${adSecondsLeft}s...` : 'Claim Reward'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* IN-APP PRIVACY POLICY MODAL                                         */}
      {/* =================================================================== */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Privacy Policy"
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#14173A] p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-extrabold text-white">
                Privacy Policy — Color Stack 3D
              </h2>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-300 hover:text-white"
                aria-label="Close Privacy Policy"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-300">
              <p className="text-[11px] text-slate-400">
                Last updated: November 4, 2026 • Package: com.colorstack3d.game / com.colorstack3d.app
              </p>
              <p>
                <strong className="text-white">Local Gameplay Data:</strong> Color Stack 3D is playable offline and does not require an external account. High scores, coins, unlocked skins, and settings are stored locally on your device. We do not collect contacts, photos, microphone, or precise GPS location.
              </p>
              <p>
                <strong className="text-white">Advertising (Google AdMob):</strong> Our Android app displays ads via Google Mobile Ads SDK (Google AdMob), which may use your Android Advertising ID for ad delivery and fraud prevention under Google&apos;s Privacy Policy. You can manage ad preferences anytime in Android Settings → Google → Ads.
              </p>
              <p>
                <strong className="text-white">Contact:</strong> Questions? Reach us at{' '}
                <span className="font-semibold text-[#00D68F]">bilalshafique1399@gmail.com</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPrivacyModal(false)}
              className="mt-4 min-h-[42px] w-full whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VERIFIED PAYOUT RECEIPT / VIDEO PROOF VIEWER MODAL                  */}
      {/* =================================================================== */}
      {selectedProofModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Verified Payout Proof"
          onClick={() => setSelectedProofModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#00D68F]/40 bg-[#14173A] p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#00D68F]">
                {selectedProofModal.mediaType}
              </span>
              <button
                type="button"
                onClick={() => setSelectedProofModal(null)}
                className="text-slate-300 hover:text-white"
                aria-label="Close proof"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-[#333866] bg-[#0F1226] p-4 text-center tabular-nums">
              <div className="font-display text-3xl font-black text-[#00D68F]">
                ${selectedProofModal.usd.toFixed(2)} USD
              </div>
              <div className="mt-1 text-xs font-bold text-white">
                Paid via {selectedProofModal.method} • STATUS: PAID
              </div>
              <div className="mt-3 space-y-1 border-t border-[#333866] pt-3 text-left text-xs text-[#bbb]">
                <div className="flex justify-between">
                  <span>Recipient:</span>
                  <b className="text-white">{selectedProofModal.player}</b>
                </div>
                <div className="flex justify-between">
                  <span>Transaction ID:</span>
                  <b className="font-mono text-white">{selectedProofModal.txRef}</b>
                </div>
                <div className="flex justify-between">
                  <span>Arrival Speed:</span>
                  <b className="text-[#FFCC00]">{selectedProofModal.payoutSpeed}</b>
                </div>
                <div className="flex justify-between">
                  <span>Verified:</span>
                  <b className="text-[#00D68F]">{selectedProofModal.timeAgo}</b>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs italic text-slate-200">
              &ldquo;{selectedProofModal.caption}&rdquo;
            </p>

            <button
              type="button"
              onClick={() => setSelectedProofModal(null)}
              className="mt-4 min-h-[42px] w-full whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black"
            >
              Close Verified Slip
            </button>
          </div>
        </div>
      )}

      {/* Every-3-Game-Overs Web Interstitial Simulation */}
      <AdMobInterstitialModal
        isOpen={showInterstitial}
        onClose={() => {
          setShowInterstitial(false);
          admobService.handleWebInterstitialDismissed();
        }}
      />

      {/* Android APK Project Download Modal */}
      <ApkBuildModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
    </div>
  );
}
