/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Coins,
  Download,
  Globe,
  LogIn,
  LogOut,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trophy,
  Vibrate,
  VibrateOff,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  computeProgressionLevel,
  DropFeedback,
  GamePhase,
  LevelProgressionInfo,
  ProgressionTier,
  StackTowerEngine,
} from './game/StackTowerEngine';
import { soundEngine } from './audio/soundEngine';
import { hapticEngine } from './audio/hapticEngine';
import { admobService } from './services/admobService';
import { AdMobBannerBar } from './components/AdMobBannerBar';
import { AdMobInterstitialModal } from './components/AdMobInterstitialModal';
import { ApkBuildModal } from './components/ApkBuildModal';
import { EarnMoneyPage } from './components/EarnMoneyPage';
import { WithdrawPage } from './components/WithdrawPage';
import { AdminPage } from './components/AdminPage';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  formatScoreDate,
  HighScoreEntry,
  highScoreService,
} from './services/highScoreService';
import {
  fetchGlobalTop100Once,
  GlobalLeaderboardEntry,
  parseLeaderboardError,
  sanitizeDisplayName,
  signInWithGoogleForLeaderboard,
  signOutLeaderboardUser,
  subscribeAuthState,
  subscribeGlobalTop100,
  syncPersonalBestToGlobal,
} from './services/globalLeaderboardService';
import {
  addLocalCoins,
  applyManualReferralCode,
  capturePendingReferralCodeFromUrl,
  claimDailyBonus,
  convertCoinsToUsd,
  DAILY_REWARD_CENTS,
  DAILY_REWARD_COINS,
  ensureUserProfileOnAuth,
  flushGuestCoinsToCloud,
  formatCoins,
  formatUsd,
  getLocalCoins,
  InvitedFriendEntry,
  isUserAdmin,
  REWARD_PER_INVITE_CENTS,
  subscribeInvitedFriends,
  subscribeUserProfile,
  subscribeUserWithdrawRequests,
  syncGameplayCoinsToCloud,
  UserProfile,
  WithdrawRequestEntry,
} from './services/referralService';

type LeaderboardTab = 'local' | 'global';
type AppRoute = 'game' | 'earn' | 'withdraw' | 'admin';

function resolveRouteFromPathname(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/admin') return 'admin';
  if (clean === '/withdraw') return 'withdraw';
  if (clean === '/earn') return 'earn';
  return 'game';
}

function routeToPathname(route: AppRoute): string {
  if (route === 'admin') return '/admin';
  if (route === 'withdraw') return '/withdraw';
  if (route === 'earn') return '/earn';
  return '/';
}

function tierColorClass(tier: ProgressionTier): string {
  switch (tier) {
    case 'Insane':
      return 'text-rose-300';
    case 'Hard':
      return 'text-amber-300';
    case 'Medium':
      return 'text-sky-300';
    default:
      return 'text-emerald-300';
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<StackTowerEngine | null>(null);

  const [activeRoute, setActiveRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined' ? resolveRouteFromPathname(window.location.pathname) : 'game',
  );
  const [pendingRefCode, setPendingRefCode] = useState<string | null>(() =>
    capturePendingReferralCodeFromUrl(),
  );

  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => highScoreService.getBestScore());
  const [combo, setCombo] = useState(0);
  const [levelInfo, setLevelInfo] = useState<LevelProgressionInfo>(() =>
    computeProgressionLevel(0, 4.6),
  );
  const [lastMaxCombo, setLastMaxCombo] = useState(0);
  const [runCoins, setRunCoins] = useState(0);
  const [lastRunCoins, setLastRunCoins] = useState(0);
  const [localGuestCoins, setLocalGuestCoins] = useState(() => getLocalCoins());
  const [isNewBest, setIsNewBest] = useState(false);
  const [feedback, setFeedback] = useState<DropFeedback | null>(null);
  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [hapticsMuted, setHapticsMuted] = useState(() => hapticEngine.isMuted());

  const [topScores, setTopScores] = useState<HighScoreEntry[]>(() =>
    highScoreService.getTopScores(),
  );
  const [placedScoreId, setPlacedScoreId] = useState<string | null>(null);

  // Firebase Auth, User Referral Profile & Global Top 100 Leaderboard state
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>('local');
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [invitedFriends, setInvitedFriends] = useState<InvitedFriendEntry[]>([]);
  const [userWithdrawals, setUserWithdrawals] = useState<WithdrawRequestEntry[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [dailyClaimNotice, setDailyClaimNotice] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [globalScores, setGlobalScores] = useState<GlobalLeaderboardEntry[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [showInterstitial, setShowInterstitial] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);

  const { isInstallable, isInstalled, install } = usePWAInstall();

  const prevBestRef = useRef(bestScore);
  const phaseRef = useRef<GamePhase>('idle');
  phaseRef.current = phase;
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;
  const userProfileRef = useRef<UserProfile | null>(null);
  userProfileRef.current = userProfile;
  const interstitialTimerRef = useRef<number | null>(null);
  const dailyNoticeTimerRef = useRef<number | null>(null);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = showInterstitial || showApkModal;

  const showWalletToast = useCallback((message: string) => {
    setDailyClaimNotice(message);
    if (dailyNoticeTimerRef.current !== null) {
      window.clearTimeout(dailyNoticeTimerRef.current);
    }
    dailyNoticeTimerRef.current = window.setTimeout(() => {
      dailyNoticeTimerRef.current = null;
      setDailyClaimNotice(null);
    }, 5000);
  }, []);

  const showDailyRewardToast = useCallback(
    (isNewSignup: boolean) => {
      const bonusStr = formatUsd(DAILY_REWARD_CENTS);
      showWalletToast(
        isNewSignup
          ? `Welcome bonus +${bonusStr} USD & +${DAILY_REWARD_COINS} Coins credited!`
          : `Daily bonus +${bonusStr} USD & +${DAILY_REWARD_COINS} Coins credited!`,
      );
    },
    [showWalletToast],
  );

  const handleApplyRefCode = useCallback((rawCode: string): boolean => {
    const applied = applyManualReferralCode(rawCode);
    if (applied) {
      setPendingRefCode(applied);
      return true;
    }
    return false;
  }, []);

  const navigateTo = useCallback((nextRoute: AppRoute) => {
    setActiveRoute((prevRoute) => {
      if (prevRoute === nextRoute) return prevRoute;
      if (nextRoute !== 'game') {
        setPhase('idle');
        setFeedback(null);
      }
      if (typeof window !== 'undefined') {
        const targetPath = routeToPathname(nextRoute);
        if (window.location.pathname !== targetPath) {
          if (nextRoute === 'game') {
            window.history.replaceState({}, '', `${targetPath}${window.location.search}`);
          } else {
            window.history.pushState({}, '', `${targetPath}${window.location.search}`);
          }
        }
      }
      return nextRoute;
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveRoute(resolveRouteFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const clearPendingInterstitialTimer = useCallback(() => {
    if (interstitialTimerRef.current !== null) {
      window.clearTimeout(interstitialTimerRef.current);
      interstitialTimerRef.current = null;
    }
  }, []);

  const syncScoreToCloud = useCallback(async (candidateScore: number, candidateCombo: number) => {
    if (candidateScore < 1) return;
    setGlobalSyncing(true);
    setGlobalError(null);
    try {
      const res = await syncPersonalBestToGlobal(candidateScore, candidateCombo);
      if (res.cloudBestScore > 0) {
        setBestScore((prev) => {
          const next = Math.max(prev, res.cloudBestScore);
          engineRef.current?.setBestScore(next);
          return next;
        });
      }
    } catch (err) {
      setGlobalError(parseLeaderboardError(err));
    } finally {
      setGlobalSyncing(false);
    }
  }, []);

  // Initialize AdMob Banner once on app boot
  useEffect(() => {
    admobService.initializeAndShowBanner().catch(() => {});
  }, []);

  // Track Firebase Auth state & bootstrap /users/{uid} + ?ref=CODE referral credit on signup
  useEffect(() => {
    const unsubAuth = subscribeAuthState((user, ready) => {
      setCurrentUser(user);
      setAuthReady(ready);
      if (!user) {
        setUserProfile(null);
        setInvitedFriends([]);
        setUserWithdrawals([]);
        setDailyClaimNotice(null);
        setReferralLoading(false);
      }
    });
    return () => {
      unsubAuth();
      if (dailyNoticeTimerRef.current !== null) {
        window.clearTimeout(dailyNoticeTimerRef.current);
        dailyNoticeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!authReady || !currentUser) return;

    let cancelled = false;
    let unsubProfile: (() => void) | null = null;
    let unsubFriends: (() => void) | null = null;
    let unsubWithdraws: (() => void) | null = null;

    setReferralLoading(true);
    setReferralError(null);

    ensureUserProfileOnAuth(currentUser)
      .then((bootstrapRes) => {
        if (cancelled) return;
        if (bootstrapRes.profile) {
          setUserProfile(bootstrapRes.profile);
          setPendingRefCode(null);
        }
        if (bootstrapRes.claimedDailyBonus) {
          showDailyRewardToast(bootstrapRes.isNewSignup);
        }

        if (getLocalCoins() > 0) {
          void flushGuestCoinsToCloud(
            bootstrapRes.profile?.updatedAtMs ?? Date.now(),
            (remaining) => {
              if (!cancelled) {
                setLocalGuestCoins(remaining);
              }
            },
          ).catch(() => {});
        }

        unsubProfile = subscribeUserProfile(
          currentUser.uid,
          (liveProfile) => {
            if (cancelled) return;
            setUserProfile(liveProfile);
            setReferralLoading(false);
          },
          (errMsg) => {
            if (cancelled) return;
            setReferralError(errMsg);
            setReferralLoading(false);
          },
        );

        unsubFriends = subscribeInvitedFriends(
          currentUser.uid,
          (friends) => {
            if (cancelled) return;
            setInvitedFriends(friends);
          },
          (errMsg) => {
            if (cancelled) return;
            setReferralError(errMsg);
          },
        );

        unsubWithdraws = subscribeUserWithdrawRequests(
          currentUser.uid,
          (reqs) => {
            if (cancelled) return;
            setUserWithdrawals(reqs);
          },
          (errMsg) => {
            if (cancelled) return;
            setReferralError(errMsg);
          },
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setReferralError(parseLeaderboardError(err));
        setReferralLoading(false);
      });

    return () => {
      cancelled = true;
      unsubProfile?.();
      unsubFriends?.();
      unsubWithdraws?.();
    };
  }, [authReady, currentUser]);

  // Load or subscribe to Global Top 100 when viewing Global tab on Game Over
  useEffect(() => {
    if (
      activeRoute !== 'game' ||
      phase !== 'gameover' ||
      leaderboardTab !== 'global' ||
      !authReady
    ) {
      return;
    }

    let cancelled = false;
    setGlobalError(null);
    setGlobalLoading(true);

    if (currentUser) {
      const unsub = subscribeGlobalTop100(
        (entries) => {
          if (cancelled) return;
          setGlobalScores(entries);
          setGlobalLoading(false);
        },
        (friendlyErr) => {
          if (cancelled) return;
          setGlobalError(friendlyErr);
          setGlobalLoading(false);
        },
      );
      return () => {
        cancelled = true;
        unsub();
      };
    }

    fetchGlobalTop100Once()
      .then((entries) => {
        if (cancelled) return;
        setGlobalScores(entries);
        setGlobalLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setGlobalError(parseLeaderboardError(err));
        setGlobalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoute, phase, leaderboardTab, authReady, currentUser]);

  // Initialize 3D Three.js Engine whenever activeRoute === 'game'
  useEffect(() => {
    if (activeRoute !== 'game') return;

    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new StackTowerEngine(container, {
      onScoreChange: (newScore, newBest, newCombo, nextLevelInfo, nextRunCoins) => {
        if (newScore === 0) {
          prevBestRef.current = newBest;
          setIsNewBest(false);
        } else if (newScore > prevBestRef.current) {
          setIsNewBest(true);
        }
        setScore(newScore);
        setBestScore(newBest);
        setCombo(newCombo);
        setLevelInfo(nextLevelInfo);
        setRunCoins(nextRunCoins);
      },
      onPhaseChange: (nextPhase) => {
        phaseRef.current = nextPhase;
        setPhase(nextPhase);
        if (nextPhase !== 'playing') {
          setFeedback(null);
        }
      },
      onDropFeedback: (fb) => {
        setFeedback(fb);
      },
      onGameOver: async (finalScore, _best, maxCombo, finalRunCoins) => {
        setLastMaxCombo(maxCombo);
        setLastRunCoins(finalRunCoins);
        const saved = highScoreService.recordScore(finalScore, maxCombo);
        setTopScores(saved.topScores);
        setPlacedScoreId(saved.placedEntryId);
        const localBest = saved.topScores.length > 0 ? saved.topScores[0].score : finalScore;
        const localBestCombo =
          saved.topScores.length > 0 ? saved.topScores[0].maxCombo : maxCombo;
        if (localBest > 0) {
          setBestScore(localBest);
        }

        // Credit earned Gold Coins to cloud wallet (if signed in) or local guest storage
        if (finalRunCoins > 0) {
          if (currentUserRef.current) {
            void syncGameplayCoinsToCloud(
              finalRunCoins,
              userProfileRef.current?.updatedAtMs ?? 0,
            ).catch(() => {
              // Preserve earned coins locally if temporary network/cooldown failure occurs
              setLocalGuestCoins(addLocalCoins(finalRunCoins));
            });
          } else {
            setLocalGuestCoins(addLocalCoins(finalRunCoins));
          }
        }

        // Automatically sync personal best to Global Top 100 if user is signed in
        void syncScoreToCloud(
          Math.max(finalScore, localBest),
          finalScore >= localBest ? maxCombo : localBestCombo,
        );

        const result = await admobService.recordGameOverAndMaybeShowInterstitial();
        if (result.showWebSimulation) {
          clearPendingInterstitialTimer();
          interstitialTimerRef.current = window.setTimeout(() => {
            interstitialTimerRef.current = null;
            if (phaseRef.current === 'gameover') {
              setShowInterstitial(true);
            }
          }, 450);
        }
      },
    });

    engineRef.current = engine;

    return () => {
      clearPendingInterstitialTimer();
      engine.dispose();
      engineRef.current = null;
    };
  }, [activeRoute, clearPendingInterstitialTimer, syncScoreToCloud]);

  const startFreshRun = useCallback(() => {
    clearPendingInterstitialTimer();
    soundEngine.playClick();
    engineRef.current?.startNewGame();
  }, [clearPendingInterstitialTimer]);

  // Keyboard accessibility (Space / Enter to drop or restart when on Game route)
  useEffect(() => {
    if (activeRoute !== 'game') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || modalOpenRef.current) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'BUTTON' || activeTag === 'A' || activeTag === 'INPUT') return;
        e.preventDefault();
        if (phase === 'gameover') {
          startFreshRun();
        } else {
          engineRef.current?.handleTapAction();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRoute, phase, startFreshRun]);

  const handlePlayfieldTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (modalOpenRef.current) return;
      if (phase === 'gameover') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      engineRef.current?.handleTapAction();
    },
    [phase],
  );

  const handleRestart = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      startFreshRun();
    },
    [startFreshRun],
  );

  const performGoogleSignIn = useCallback(async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setGlobalError(null);
    setReferralError(null);
    try {
      const user = await signInWithGoogleForLeaderboard();
      if (!user) return;
      // Profile creation, daily bonus toast, and guest coin flush are handled by the
      // authoritative onAuthStateChanged effect above. Sync personal best score here:
      const bestLocalEntry = highScoreService.getTopScores()[0];
      const bestScoreCandidate = Math.max(score, bestScore, bestLocalEntry?.score ?? 0);
      const bestComboCandidate =
        score >= (bestLocalEntry?.score ?? 0)
          ? lastMaxCombo
          : (bestLocalEntry?.maxCombo ?? lastMaxCombo);

      if (bestScoreCandidate > 0) {
        await syncScoreToCloud(bestScoreCandidate, bestComboCandidate);
      }
    } catch (err) {
      const parsed = parseLeaderboardError(err);
      setGlobalError(parsed);
      setReferralError(parsed);
    } finally {
      setAuthBusy(false);
    }
  }, [authBusy, bestScore, lastMaxCombo, score, syncScoreToCloud]);

  const handleManualDailyClaim = useCallback(async () => {
    if (!userProfile) return;
    setReferralError(null);
    try {
      const claimed = await claimDailyBonus(userProfile);
      if (claimed) {
        showDailyRewardToast(false);
      }
    } catch (err) {
      setReferralError(parseLeaderboardError(err));
    }
  }, [showDailyRewardToast, userProfile]);

  const handleConvertCoins = useCallback(async () => {
    if (!userProfile) return;
    setReferralError(null);
    try {
      const { coinsSpent, centsAdded } = await convertCoinsToUsd(userProfile);
      showWalletToast(
        `Exchanged ${formatCoins(coinsSpent)} Coins for +${formatUsd(centsAdded)} USD!`,
      );
    } catch (err) {
      setReferralError(parseLeaderboardError(err));
    }
  }, [showWalletToast, userProfile]);

  const handleGoogleSignInClick = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      soundEngine.playClick();
      void performGoogleSignIn();
    },
    [performGoogleSignIn],
  );

  const performSignOut = useCallback(async () => {
    try {
      await signOutLeaderboardUser();
    } catch {
      // Ignore sign-out errors
    }
  }, []);

  const handleSignOutClick = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      soundEngine.playClick();
      void performSignOut();
    },
    [performSignOut],
  );

  const handleSelectTab = useCallback(
    (tab: LeaderboardTab, e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      soundEngine.playClick();
      setLeaderboardTab(tab);
    },
    [],
  );

  const handleToggleMute = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleToggleHaptics = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    const nextMuted = hapticEngine.toggleMute();
    setHapticsMuted(nextMuted);
  }, []);

  const handleOpenApkModal = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    soundEngine.playClick();
    setShowApkModal(true);
  }, []);

  const handleQuickInstall = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      soundEngine.playClick();
      install();
    },
    [install],
  );

  const playerGlobalRankIndex = currentUser
    ? globalScores.findIndex((item) => item.userId === currentUser.uid)
    : -1;

  const totalWalletCoins = userProfile ? userProfile.coins : localGuestCoins;

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#131629] text-white">
      {activeRoute === 'earn' ? (
        <EarnMoneyPage
          user={currentUser}
          profile={userProfile}
          localGuestCoins={localGuestCoins}
          pendingRefCode={pendingRefCode}
          onApplyRefCode={handleApplyRefCode}
          invitedFriends={invitedFriends}
          loading={referralLoading}
          error={referralError}
          dailyClaimNotice={dailyClaimNotice}
          onClaimDailyBonus={handleManualDailyClaim}
          onConvertCoins={handleConvertCoins}
          onBackToGame={() => navigateTo('game')}
          onGoToWithdraw={() => navigateTo('withdraw')}
          onGoToAdmin={() => navigateTo('admin')}
          onGoogleLogin={performGoogleSignIn}
        />
      ) : activeRoute === 'withdraw' ? (
        <WithdrawPage
          user={currentUser}
          profile={userProfile}
          requests={userWithdrawals}
          onBackToEarn={() => navigateTo('earn')}
          onGoogleLogin={performGoogleSignIn}
        />
      ) : activeRoute === 'admin' ? (
        <AdminPage
          user={currentUser}
          authReady={authReady}
          onBackToGame={() => navigateTo('game')}
          onGoogleLogin={performGoogleSignIn}
          onSignOut={performSignOut}
        />
      ) : (
        /* Main Interactive Playfield + Isolated 3D WebGL Canvas */
        <div
          onPointerDown={handlePlayfieldTap}
          className="relative flex-1 w-full overflow-hidden cursor-pointer"
        >
          {/* Dedicated Isolated Three.js Canvas Mount */}
          <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

          {/* Semantic HUD Overlay Layer */}
          <div className="pointer-events-none relative z-10 mx-auto flex h-full w-full max-w-lg flex-col justify-between px-4 sm:px-5 pt-4 pb-5">
            {/* Top Bar: Brand + Earn Money / Utility Controls */}
            <header className="pointer-events-auto flex items-center justify-between gap-2">
              <span className="font-display text-lg font-extrabold tracking-tight text-white drop-shadow whitespace-nowrap shrink-0">
                Color Stack
              </span>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {isUserAdmin(currentUser) && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEngine.playClick();
                      navigateTo('admin');
                    }}
                    className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-white/15 px-2.5 text-xs font-semibold text-amber-300 hover:bg-white/25 active:scale-95 transition-transform whitespace-nowrap shrink-0"
                    aria-label="Open Admin Dashboard"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Admin</span>
                  </button>
                )}

                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEngine.playClick();
                    navigateTo('earn');
                  }}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-400/20 border border-emerald-300/30 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-400/30 active:scale-95 transition-transform whitespace-nowrap shrink-0 tabular-nums"
                >
                  <Wallet className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span>
                    {userProfile ? formatUsd(userProfile.balance) : 'Earn USD'}
                  </span>
                </button>

                {!isInstalled && isInstallable && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleQuickInstall}
                    className="hidden sm:flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-semibold text-white hover:bg-white/25 active:scale-95 transition-transform whitespace-nowrap shrink-0"
                  >
                    <Smartphone className="h-4 w-4 shrink-0" />
                    <span>Install</span>
                  </button>
                )}

                {!admobService.isNative() && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleOpenApkModal}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-semibold text-white hover:bg-white/25 active:scale-95 transition-transform whitespace-nowrap shrink-0"
                    aria-label="Download Android APK Project"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span>APK</span>
                  </button>
                )}

                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleToggleHaptics}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 active:scale-95 transition-transform shrink-0"
                  aria-label={hapticsMuted ? 'Enable haptic vibration' : 'Disable haptic vibration'}
                  title={hapticsMuted ? 'Vibration Off' : 'Vibration On'}
                >
                  {hapticsMuted ? (
                    <VibrateOff className="h-5 w-5 text-slate-300" />
                  ) : (
                    <Vibrate className="h-5 w-5" />
                  )}
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleToggleMute}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 active:scale-95 transition-transform shrink-0"
                  aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
                >
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              </div>
            </header>

            {/* Top-Center Score Display, Progression Level Tier, Gold Coins & Drop Popups */}
            <div className="relative mt-1 flex flex-col items-center text-center">
              {phase === 'idle' ? (
                <div className="flex flex-col items-center">
                  <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow-md [text-wrap:balance]">
                    Color Stack
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-medium text-slate-200/90 tabular-nums">
                    <span className={tierColorClass(levelInfo.tier)}>
                      Lv. {levelInfo.level} · {levelInfo.tier}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300">
                      Coins {formatCoins(totalWalletCoins)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Tap to stack blocks</span>
                    {bestScore > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Best {bestScore}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div
                    className={`font-display font-extrabold leading-none tracking-tight text-white drop-shadow-lg tabular-nums ${
                      phase === 'gameover' ? 'text-5xl sm:text-6xl' : 'text-7xl sm:text-8xl'
                    }`}
                    aria-live="polite"
                  >
                    {score}
                  </div>

                  {/* Clean unboxed HUD Level Progression Tier + Run Coins + Best + Active Perfect Streak */}
                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-200/90 tabular-nums">
                    <span className={tierColorClass(levelInfo.tier)}>
                      Lv. {levelInfo.level} · {levelInfo.tier}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300">+{runCoins} Coins</span>
                    <span aria-hidden="true">·</span>
                    <span>Best {bestScore}</span>
                    {combo > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-300">Perfect ×{combo}</span>
                      </>
                    )}
                  </div>

                  {/* Animated Perfect / Coin Pickup Floating Callout */}
                  {feedback && phase === 'playing' && (
                    <div
                      key={feedback.id}
                      className="animate-score-pop absolute top-28 left-1/2 whitespace-nowrap text-center"
                    >
                      {feedback.isPerfect ? (
                        <div className="font-display text-lg font-extrabold tracking-tight text-amber-300 drop-shadow-md tabular-nums">
                          {feedback.expanded
                            ? `Size Up! +${feedback.pointsAdded} · +${feedback.coinsAdded} Coins`
                            : feedback.combo > 1
                              ? `Perfect ×${feedback.combo}! +${feedback.pointsAdded} · +${feedback.coinsAdded} Coins`
                              : `Perfect! +${feedback.pointsAdded} · +${feedback.coinsAdded} Coins`}
                        </div>
                      ) : feedback.pickedUpCoin ? (
                        <div className="font-display text-base font-extrabold text-amber-300 drop-shadow tabular-nums">
                          Gold Coin! +{feedback.pointsAdded} · +{feedback.coinsAdded} Coins
                        </div>
                      ) : (
                        <div className="font-display text-base font-bold text-white/90 drop-shadow tabular-nums">
                          +{feedback.pointsAdded} · +{feedback.coinsAdded} Coin
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Thumb Zone: Start Login & Play Prompt OR Game Over Card */}
            <div className="flex flex-col items-center justify-end pb-1">
              {phase === 'idle' && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto flex w-full max-w-xs flex-col items-center gap-2.5"
                >
                  {dailyClaimNotice && (
                    <div className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-2.5 text-center text-xs font-semibold text-emerald-200 shadow-lg tabular-nums">
                      {dailyClaimNotice}
                    </div>
                  )}

                  {/* Google Login on Start (creates /users/{uid}, grants +$0.05 + 50 Coins daily bonus & redeems ?ref=CODE on signup) */}
                  {authReady && !currentUser && (
                    <div className="w-full rounded-2xl border border-white/15 bg-[#12162E]/90 p-3 text-center shadow-xl">
                      {pendingRefCode && (
                        <p className="mb-2 text-xs font-medium text-emerald-300 tabular-nums">
                          Invite code {pendingRefCode} ready · Sign in to activate
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={authBusy}
                        onClick={handleGoogleSignInClick}
                        className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/25 active:scale-[0.98] transition-transform disabled:opacity-60 whitespace-nowrap tabular-nums"
                      >
                        <LogIn className="h-4 w-4 shrink-0 text-amber-300" />
                        <span>
                          {authBusy
                            ? 'Signing in...'
                            : `Google Sign-In · +${formatUsd(DAILY_REWARD_CENTS)}/Day & ${formatUsd(REWARD_PER_INVITE_CENTS)}/Invite`}
                        </span>
                      </button>
                      {referralError && (
                        <p className="mt-2 text-[11px] leading-snug text-rose-200 break-words">
                          {referralError}
                        </p>
                      )}
                    </div>
                  )}

                  {currentUser && (
                    <div className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/15 bg-[#12162E]/90 px-3.5 py-2.5 text-xs">
                      <span className="truncate font-medium text-slate-200 tabular-nums">
                        {sanitizeDisplayName(currentUser.displayName)}
                        {userProfile
                          ? ` · ${formatUsd(userProfile.balance)} · ${formatCoins(userProfile.coins)} Coins`
                          : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          navigateTo('earn');
                        }}
                        className="shrink-0 font-bold text-emerald-300 hover:text-emerald-200 whitespace-nowrap"
                      >
                        Earn USD →
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleRestart}
                    className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-6 py-3.5 font-display text-lg font-extrabold text-slate-950 shadow-xl transition-transform active:scale-[0.97] whitespace-nowrap"
                  >
                    <Play className="h-5 w-5 fill-slate-950 shrink-0" />
                    <span>Tap to Start</span>
                  </button>
                </div>
              )}

              {phase === 'gameover' && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  className="pointer-events-auto flex max-h-[64dvh] w-full max-w-sm flex-col rounded-3xl border border-white/15 bg-[#12162E]/95 p-4 sm:p-5 text-center shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                      <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">
                        Game Over
                      </h2>
                      {lastRunCoins > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-300 tabular-nums">
                          <Coins className="h-3 w-3 shrink-0" />
                          <span>+{lastRunCoins} Coins earned</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2.5 tabular-nums">
                      <div className="text-right">
                        <span className="text-[11px] font-medium text-slate-400 mr-1">Score</span>
                        <span className="font-display text-xl font-extrabold text-white">
                          {score}
                        </span>
                      </div>
                      <span className="text-white/20" aria-hidden="true">
                        |
                      </span>
                      <div className="text-right">
                        <span className="text-[11px] font-medium text-slate-400 mr-1">
                          {isNewBest ? 'New Best!' : 'Best'}
                        </span>
                        <span
                          className={`font-display text-xl font-extrabold ${
                            isNewBest ? 'text-amber-300' : 'text-slate-200'
                          }`}
                        >
                          {bestScore}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Segmented Toggle: Local Top 5 vs Global Top 100 */}
                  <div
                    className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[#0B0E1D] p-1 border border-white/10 shrink-0"
                    role="tablist"
                    aria-label="Leaderboard Mode"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={leaderboardTab === 'local'}
                      onClick={(e) => handleSelectTab('local', e)}
                      className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                        leaderboardTab === 'local'
                          ? 'bg-white text-slate-950 shadow'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Trophy className="h-3.5 w-3.5 shrink-0" />
                      <span>Local Top 5</span>
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={leaderboardTab === 'global'}
                      onClick={(e) => handleSelectTab('global', e)}
                      className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                        leaderboardTab === 'global'
                          ? 'bg-white text-slate-950 shadow'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span>Global Top 100</span>
                    </button>
                  </div>

                  {/* Tab Panel Content */}
                  <div className="mt-2.5 flex min-h-0 flex-1 flex-col text-left">
                    {leaderboardTab === 'local' ? (
                      <>
                        <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-400 tabular-nums">
                          <span>Device History</span>
                          <span>{topScores.length}/5 saved</span>
                        </div>

                        {topScores.length === 0 ? (
                          <div className="rounded-xl border border-white/10 bg-[#0D1021] px-3 py-3 text-center text-xs text-slate-400">
                            Stack blocks to record your first Top 5 score
                          </div>
                        ) : (
                          <div
                            className="max-h-32 min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#0D1021] divide-y divide-white/10"
                            role="list"
                            aria-label="Local Top 5 High Scores"
                          >
                            {topScores.map((entry, idx) => {
                              const isCurrentRun = entry.id === placedScoreId;
                              return (
                                <div
                                  key={entry.id}
                                  role="listitem"
                                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs ${
                                    isCurrentRun ? 'bg-amber-400/10' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                      className={`w-6 shrink-0 font-mono font-semibold tabular-nums ${
                                        idx === 0 ? 'text-amber-300' : 'text-slate-400'
                                      }`}
                                    >
                                      #{idx + 1}
                                    </span>
                                    <div className="flex items-center gap-1.5 truncate text-slate-300 tabular-nums">
                                      <span>{formatScoreDate(entry.timestamp)}</span>
                                      {entry.maxCombo > 0 && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span>Streak ×{entry.maxCombo}</span>
                                        </>
                                      )}
                                      {isCurrentRun && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="font-semibold text-amber-300">
                                            Current
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <span
                                    className={`shrink-0 font-display text-sm font-bold tabular-nums ${
                                      isCurrentRun || idx === 0 ? 'text-amber-300' : 'text-white'
                                    }`}
                                  >
                                    {entry.score}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          {currentUser ? (
                            <>
                              <span className="truncate tabular-nums">
                                {sanitizeDisplayName(currentUser.displayName)}
                                {playerGlobalRankIndex >= 0 &&
                                  ` · Rank #${playerGlobalRankIndex + 1}`}
                                {globalSyncing && ' · Saving...'}
                              </span>
                              <button
                                type="button"
                                onClick={handleSignOutClick}
                                className="inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-slate-300 hover:bg-white/10 hover:text-white whitespace-nowrap"
                              >
                                <LogOut className="h-3 w-3 shrink-0" />
                                <span>Sign out</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <span>Worldwide Top 100</span>
                              <span className="tabular-nums">{globalScores.length} ranked</span>
                            </>
                          )}
                        </div>

                        {!currentUser && authReady && (
                          <button
                            type="button"
                            disabled={authBusy}
                            onClick={handleGoogleSignInClick}
                            className="mb-2 flex min-h-[40px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 active:scale-[0.98] transition-transform whitespace-nowrap"
                          >
                            <LogIn className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                            <span>
                              {bestScore > 0
                                ? `Sign in with Google to Post Best (${bestScore})`
                                : 'Sign in with Google to Join Leaderboard'}
                            </span>
                          </button>
                        )}

                        {globalError && (
                          <div className="mb-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] leading-snug text-rose-200 break-words">
                            {globalError}
                          </div>
                        )}

                        {globalLoading ? (
                          <div className="rounded-xl border border-white/10 bg-[#0D1021] px-3 py-4 text-center text-xs text-slate-400">
                            Loading global leaderboard...
                          </div>
                        ) : globalScores.length === 0 ? (
                          <div className="rounded-xl border border-white/10 bg-[#0D1021] px-3 py-3 text-center text-xs text-slate-400">
                            No global scores posted yet — be #1 on the leaderboard!
                          </div>
                        ) : (
                          <div
                            className="max-h-32 min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#0D1021] divide-y divide-white/10"
                            role="list"
                            aria-label="Top 100 Global Leaderboard"
                          >
                            {globalScores.map((entry, idx) => {
                              const isSelf = currentUser?.uid === entry.userId;
                              return (
                                <div
                                  key={entry.userId}
                                  role="listitem"
                                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs ${
                                    isSelf ? 'bg-amber-400/10' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                      className={`w-7 shrink-0 font-mono font-semibold tabular-nums ${
                                        idx === 0
                                          ? 'text-amber-300'
                                          : idx === 1
                                            ? 'text-slate-200'
                                            : idx === 2
                                              ? 'text-orange-300'
                                              : 'text-slate-400'
                                      }`}
                                    >
                                      #{idx + 1}
                                    </span>
                                    <div className="flex items-center gap-1.5 truncate text-slate-200 tabular-nums">
                                      <span className="truncate font-medium">
                                        {entry.displayName}
                                      </span>
                                      {entry.maxCombo > 0 && (
                                        <>
                                          <span className="text-slate-500" aria-hidden="true">
                                            ·
                                          </span>
                                          <span className="shrink-0 text-slate-400">
                                            ×{entry.maxCombo}
                                          </span>
                                        </>
                                      )}
                                      {isSelf && (
                                        <>
                                          <span className="text-slate-500" aria-hidden="true">
                                            ·
                                          </span>
                                          <span className="shrink-0 font-semibold text-amber-300">
                                            You
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <span
                                    className={`shrink-0 font-display text-sm font-bold tabular-nums ${
                                      isSelf || idx === 0 ? 'text-amber-300' : 'text-white'
                                    }`}
                                  >
                                    {entry.score}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Primary Play Again + Secondary Earn Money Actions */}
                  <div className="mt-3 flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        navigateTo('earn');
                      }}
                      className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-white/15 active:scale-[0.97] transition-transform whitespace-nowrap shrink-0"
                    >
                      <Wallet className="h-4 w-4 shrink-0" />
                      <span>Earn USD</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRestart}
                      className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 px-5 py-2.5 font-display text-base sm:text-lg font-extrabold text-slate-950 shadow-lg transition-transform hover:brightness-105 active:scale-[0.97] whitespace-nowrap"
                    >
                      <RotateCcw className="h-4 w-4 stroke-[2.5] shrink-0" />
                      <span>Play Again</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom AdMob Banner (ca-app-pub-3940256099942544/6300978111) */}
      <AdMobBannerBar />

      {/* AdMob Test Interstitial Modal (ca-app-pub-3940256099942544/1033173712 after every 3 game overs) */}
      <AdMobInterstitialModal
        isOpen={showInterstitial}
        onClose={() => setShowInterstitial(false)}
      />

      {/* Android APK Project Download & Setup Modal */}
      <ApkBuildModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
    </div>
  );
}
