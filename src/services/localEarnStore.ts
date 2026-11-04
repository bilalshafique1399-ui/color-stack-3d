import type { CubeSkinId } from '../game/colorPalette';

export type WithdrawMethod = 'EasyPaisa' | 'JazzCash' | 'RedotPay';
export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
export type AvatarId = 'crown' | 'flame' | 'gem' | 'bolt' | 'rocket' | 'star';
export type MissionId = 'stack_50' | 'watch_5_ads' | 'invite_1' | 'perfect_10';
export type SeasonalEventId = 'eid' | 'ramzan' | 'newyear' | 'standard';
export type GuessPrismColor = 'pink' | 'emerald' | 'gold';

export interface ReferralEntry {
  id: string;
  code: string;
  name: string;
  coinsEarned: number;
  date: string;
  level?: 1 | 2;
}

export interface WithdrawEntry {
  id: string;
  method: WithdrawMethod;
  number: string;
  amount: number;
  usd: number;
  status: string;
  date: string;
}

export interface ProofWallItem {
  id: string;
  player: string;
  tier: RankTier;
  method: WithdrawMethod;
  usd: number;
  txRef: string;
  payoutSpeed: string;
  mediaType: 'Video Proof' | 'Receipt Screenshot';
  durationLabel: string;
  caption: string;
  timeAgo: string;
}

export interface PlayerProgressFields {
  coins: number;
  lives: number;
  best: number;
  playSec: number;
  playDay: string;
  claimed6hDay: string | null;
  totalBlocksStacked: number;
  avatarId: AvatarId;
  selectedSkin: CubeSkinId;
  ramzanSkinUnlocked: boolean;
  battlePassActive: boolean;
  // Consecutive Streak & 7-Day Login Bonus
  streakDays: number;
  lastActiveDate: string | null;
  loginBonusDay: number; // 1..7
  lastLoginBonusDate: string | null;
  // Spin Wheel
  lastFreeSpinDate: string | null;
  extraSpins: number;
  // Daily Missions
  missionsDay: string;
  blocksToday: number;
  adsToday: number;
  invitesToday: number;
  perfectsToday: number;
  claimedMissions: MissionId[];
  // Daily 9 PM Tournament
  tournamentDay: string;
  todayBestScore: number;
  claimedTournamentDay: string | null;
  // Next-Level Feature 1: Promo / Gift Codes
  redeemedPromoCodes: string[];
  // Next-Level Feature 2: 3-in-1 Mini-Games
  miniGamesDay: string;
  freeMiniGamesUsedToday: number;
  colorGuessStreak: number;
  // Next-Level Feature 3: 1v1 Friend Battles
  completedBattleCodes: string[];
  battlesWon: number;
  // Next-Level Feature 4: Offline Sleep Earnings (8h = 50 Coins)
  lastOfflineClaimMs: number;
  // Next-Level Feature 5: Push Notification Reminders
  pushAlertsEnabled: boolean;
  // Next-Level Feature 6: 2-Hour Mystery Lucky Box
  lastMysteryBoxMs: number;
  // Next-Level Feature 7: Seasonal Event (Eid / Ramzan / New Year)
  activeSeasonalEvent: SeasonalEventId;
  // Next-Level Feature 8: Monthly VIP Club ($5 = 5,000 Coins)
  vipClubExpiresMs: number;
  lastVipDailyDate: string | null;
  // Next-Level Feature 9: User-shared Proof Wall items
  userProofWall: ProofWallItem[];
  // Next-Level Feature 10: Referral Level 2 Team Income (+5 Coins)
  referredByCode: string | null;
  teamLevel2Count: number;
  teamLevel2Coins: number;
  // Lists
  refs: ReferralEntry[];
  withdraws: WithdrawEntry[];
}

export interface LocalUserAccount extends PlayerProgressFields {
  name: string;
  email: string;
  pass: string;
  code: string;
}

export interface EarnPlayState extends PlayerProgressFields {
  users: LocalUserAccount[];
  current: string | null; // logged-in email
}

export const STORAGE_KEY = 'cs3d_v3';
const LEGACY_STORAGE_KEY = 'cs3d_v2';

export const PLAYTIME_TARGET_SEC = 21600; // 6 hours = 21,600 seconds
export const PLAYTIME_REWARD_COINS = 5000; // $5.00 daily bonus (5,000 Coins)
export const INVITES_REQUIRED_FOR_WITHDRAW = 50;
export const COINS_PER_INVITE = 20; // Level 1 Direct Invite = +20 Coins ($0.02)
export const COINS_PER_LEVEL2_INVITE = 5; // Level 2 Team Invite = +5 Coins
export const MIN_WITHDRAW_COINS = 100000; // $100.00 (100,000 Coins)
export const COINS_PER_USD = 1000;
export const RESTART_COIN_COST = 10;
export const VIDEO_AD_REWARD_COINS = 10;
export const BATTLE_PASS_COST_COINS = 1000; // $1.00 Battle Pass
export const VIP_CLUB_MONTHLY_COST_COINS = 5000; // $5.00 Monthly VIP Club
export const VIP_CLUB_DAILY_FREE_COINS = 100; // +100 Coins daily for VIP Club
export const TOURNAMENT_PRIZE_COINS = 1000; // $1.00 Daily 9 PM Winner Bonus
export const FRIEND_BATTLE_PRIZE_COINS = 50; // +50 Coins for winning 1v1 Friend Battle
export const MINI_GAME_FREE_DAILY_ROUNDS = 3;
export const MINI_GAME_EXTRA_COST_COINS = 5;
export const OFFLINE_MAX_HOURS = 8;
export const OFFLINE_MAX_COINS = 50; // 8 hours = 50 Coins base
export const MYSTERY_BOX_COOLDOWN_MS = 2 * 60 * 60 * 1000; // Every 2 hours

export const DAILY_LOGIN_REWARDS = [10, 20, 35, 50, 65, 80, 100] as const;

export interface PromoCodeSpec {
  code: string;
  baseCoins: number;
  title: string;
  unlocksRamzanSkin?: boolean;
}

export const PROMO_CODES_CATALOG: PromoCodeSpec[] = [
  { code: 'EID100', baseCoins: 100, title: 'Eid Mubarak Gift' },
  {
    code: 'RAMZAN50',
    baseCoins: 50,
    title: 'Ramzan Kareem Gift + Crescent 3D Skin',
    unlocksRamzanSkin: true,
  },
  { code: 'NEWYEAR100', baseCoins: 100, title: 'New Year Celebration Drop' },
  { code: 'TIKTOK100', baseCoins: 100, title: 'TikTok Creator Promo' },
  { code: 'YOUTUBE100', baseCoins: 100, title: 'YouTube Community Promo' },
  { code: 'STACK50', baseCoins: 50, title: 'Welcome Stacker Gift' },
];

export interface SeasonalEventSpec {
  id: SeasonalEventId;
  name: string;
  badge: string;
  description: string;
  multiplier: number;
}

export const SEASONAL_EVENTS_CATALOG: SeasonalEventSpec[] = [
  {
    id: 'eid',
    name: 'Eid Mubarak 2x Fest',
    badge: '2x All Rewards',
    description: 'Eid Celebration! Gameplay, Spin, Mini-Games & Mystery Box rewards are DOUBLED (2x)!',
    multiplier: 2,
  },
  {
    id: 'ramzan',
    name: 'Ramzan Crescent Event',
    badge: 'Crescent Skin + 2x',
    description: 'Unlocks the Emerald & Gold Ramzan Crescent 3D Cube Skin + 2x Festival Bonus!',
    multiplier: 2,
  },
  {
    id: 'newyear',
    name: 'New Year Mega Rush',
    badge: '2x All Rewards',
    description: 'New Year Mega Rush! Earn 2x Double Coins across runs, spins & mystery boxes!',
    multiplier: 2,
  },
  {
    id: 'standard',
    name: 'Standard Season',
    badge: '1x Base Rate',
    description: 'Standard non-event coin rate.',
    multiplier: 1,
  },
];

export interface SpinSegment {
  coins: number;
  color: string;
  label: string;
}

export const SPIN_WHEEL_SEGMENTS: SpinSegment[] = [
  { coins: 5, color: '#FF2D95', label: '5' },
  { coins: 25, color: '#00D68F', label: '25' },
  { coins: 10, color: '#FFCC00', label: '10' },
  { coins: 50, color: '#4A90FF', label: '50' },
  { coins: 15, color: '#FF2D95', label: '15' },
  { coins: 100, color: '#00D68F', label: '100' },
  { coins: 20, color: '#FFCC00', label: '20' },
  { coins: 40, color: '#4A90FF', label: '40' },
];

export interface SkinCatalogItem {
  id: CubeSkinId;
  name: string;
  unlockLevel: number;
  subtitle: string;
  previewClass: string;
  seasonalTag?: string;
}

export const CUBE_SKINS_CATALOG: SkinCatalogItem[] = [
  {
    id: 'classic',
    name: 'Classic Prism',
    unlockLevel: 1,
    subtitle: 'Vibrant Rainbow Blocks',
    previewClass: 'from-pink-500 to-amber-400',
  },
  {
    id: 'ramzan',
    name: 'Ramzan Crescent',
    unlockLevel: 1,
    subtitle: 'Emerald Jade & Lantern Gold (Ramzan Event / RAMZAN50)',
    previewClass: 'from-emerald-400 to-yellow-300',
    seasonalTag: 'Seasonal',
  },
  {
    id: 'gold',
    name: 'Golden Cube',
    unlockLevel: 5,
    subtitle: '24K Metallic Gold Finish',
    previewClass: 'from-yellow-300 to-amber-600',
  },
  {
    id: 'diamond',
    name: 'Diamond Cube',
    unlockLevel: 10,
    subtitle: 'Crystalline Ice Clearcoat',
    previewClass: 'from-cyan-200 to-indigo-500',
  },
  {
    id: 'fire',
    name: 'Fire Cube',
    unlockLevel: 20,
    subtitle: 'Glowing Molten Magma',
    previewClass: 'from-orange-400 to-rose-600',
  },
];

export interface DailyMissionSpec {
  id: MissionId;
  title: string;
  target: number;
  rewardCoins: number;
}

export const DAILY_MISSIONS_CATALOG: DailyMissionSpec[] = [
  {
    id: 'stack_50',
    title: 'Stack 50 Blocks Today',
    target: 50,
    rewardCoins: 50,
  },
  {
    id: 'watch_5_ads',
    title: 'Watch 5 Sponsored Ads Today',
    target: 5,
    rewardCoins: 30,
  },
  {
    id: 'invite_1',
    title: 'Invite 1 Friend Today',
    target: 1,
    rewardCoins: 20,
  },
  {
    id: 'perfect_10',
    title: 'Land 10 Perfect Stacks Today',
    target: 10,
    rewardCoins: 40,
  },
];

export const VIDEO_PROOF_WALL_ITEMS: ProofWallItem[] = [
  {
    id: 'vp_1',
    player: 'Ahmed K. (Lahore)',
    tier: 'Diamond',
    method: 'JazzCash',
    usd: 100,
    txRef: 'JC-88492019',
    payoutSpeed: '45 mins (VIP Express)',
    mediaType: 'Video Proof',
    durationLabel: '0:19 Clip',
    caption: 'Received $100.00 straight into JazzCash with Monthly VIP Club 1-hour payout!',
    timeAgo: '2h ago',
  },
  {
    id: 'vp_2',
    player: 'Fatima Z. (Karachi)',
    tier: 'Gold',
    method: 'EasyPaisa',
    usd: 100,
    txRef: 'EP-55301944',
    payoutSpeed: '18 hours',
    mediaType: 'Receipt Screenshot',
    durationLabel: 'Verified Slip',
    caption: 'Completed 50 referrals + daily 6-hour play bonus. Full $100 EasyPaisa received!',
    timeAgo: '5h ago',
  },
  {
    id: 'vp_3',
    player: 'Bilal M. (Islamabad)',
    tier: 'Diamond',
    method: 'RedotPay',
    usd: 125,
    txRef: 'RDP-9920418',
    payoutSpeed: '38 mins (VIP Express)',
    mediaType: 'Video Proof',
    durationLabel: '0:24 Clip',
    caption: 'Level-2 Team Referral income + Eid 2x event pushed me over 125,000 Coins fast!',
    timeAgo: 'Yesterday',
  },
  {
    id: 'vp_4',
    player: 'Usman R. (Multan)',
    tier: 'Gold',
    method: 'EasyPaisa',
    usd: 100,
    txRef: 'EP-44120987',
    payoutSpeed: '22 hours',
    mediaType: 'Receipt Screenshot',
    durationLabel: 'Verified Slip',
    caption: '100% genuine payout — status went from Pending to Paid within one day.',
    timeAgo: 'Yesterday',
  },
];

export function getTodayDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function getYesterdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getTodayDateKey(d);
}

function encodePass(raw: string): string {
  try {
    return typeof window !== 'undefined' ? window.btoa(unescape(encodeURIComponent(raw))) : raw;
  } catch {
    return raw;
  }
}

export function generateUserCode(name: string, existingCodes: Set<string>): string {
  const prefix = (name || 'USER')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'U');
  for (let i = 0; i < 30; i++) {
    const candidate = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `${prefix}${Date.now().toString().slice(-4)}`;
}

export function isVipClubActive(
  state: Pick<PlayerProgressFields, 'vipClubExpiresMs'>,
  nowMs: number = Date.now(),
): boolean {
  return state.vipClubExpiresMs > nowMs;
}

export function getVipClubDaysRemaining(
  state: Pick<PlayerProgressFields, 'vipClubExpiresMs'>,
  nowMs: number = Date.now(),
): number {
  if (state.vipClubExpiresMs <= nowMs) return 0;
  return Math.max(1, Math.ceil((state.vipClubExpiresMs - nowMs) / (24 * 60 * 60 * 1000)));
}

export function getSeasonalMultiplier(
  state: Pick<PlayerProgressFields, 'activeSeasonalEvent'>,
): number {
  const found = SEASONAL_EVENTS_CATALOG.find((e) => e.id === state.activeSeasonalEvent);
  return found ? found.multiplier : 1;
}

export function getPlayerLevel(
  state: Pick<PlayerProgressFields, 'totalBlocksStacked' | 'best'>,
): number {
  const fromBlocks = Math.floor(Math.max(0, state.totalBlocksStacked) / 18);
  const fromBest = Math.floor(Math.max(0, state.best - 50) / 20);
  return Math.max(1, 1 + fromBlocks + fromBest);
}

export function getNextLevelProgressPercent(totalBlocksStacked: number): number {
  return Math.round(((Math.max(0, totalBlocksStacked) % 18) / 18) * 100);
}

export function getPlayerRank(coins: number): RankTier {
  if (coins >= 25000) return 'Diamond';
  if (coins >= 5000) return 'Gold';
  if (coins >= 1000) return 'Silver';
  return 'Bronze';
}

export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 3;
  if (streakDays >= 3) return 2;
  return 1;
}

export function getRewardMultiplier(
  state: Pick<PlayerProgressFields, 'battlePassActive' | 'activeSeasonalEvent'>,
): number {
  const bp = state.battlePassActive ? 2 : 1;
  const eventMult = getSeasonalMultiplier(state);
  return bp * eventMult;
}

function createDefaultProgress(): PlayerProgressFields {
  let initialBest = 59;
  if (typeof window !== 'undefined') {
    try {
      const legacyBest = parseInt(
        window.localStorage.getItem('color_stack_best_score') || '59',
        10,
      );
      if (Number.isFinite(legacyBest) && legacyBest > initialBest) {
        initialBest = legacyBest;
      }
    } catch {
      // ignore
    }
  }
  const today = getTodayDateKey();
  // Start offline claim 2 hours ago by default on a fresh install so user immediately sees offline passive coins working
  const defaultOfflineStart = Date.now() - 2 * 60 * 60 * 1000;

  return {
    coins: 32,
    lives: 3,
    best: initialBest,
    playSec: 240,
    playDay: today,
    claimed6hDay: null,
    totalBlocksStacked: 0,
    avatarId: 'crown',
    selectedSkin: 'classic',
    ramzanSkinUnlocked: false,
    battlePassActive: false,
    streakDays: 1,
    lastActiveDate: today,
    loginBonusDay: 1,
    lastLoginBonusDate: null,
    lastFreeSpinDate: null,
    extraSpins: 0,
    missionsDay: today,
    blocksToday: 0,
    adsToday: 0,
    invitesToday: 0,
    perfectsToday: 0,
    claimedMissions: [],
    tournamentDay: today,
    todayBestScore: 0,
    claimedTournamentDay: null,
    redeemedPromoCodes: [],
    miniGamesDay: today,
    freeMiniGamesUsedToday: 0,
    colorGuessStreak: 0,
    completedBattleCodes: [],
    battlesWon: 0,
    lastOfflineClaimMs: defaultOfflineStart,
    pushAlertsEnabled: false,
    lastMysteryBoxMs: 0,
    activeSeasonalEvent: 'eid',
    vipClubExpiresMs: 0,
    lastVipDailyDate: null,
    userProofWall: [],
    referredByCode: null,
    teamLevel2Count: 0,
    teamLevel2Coins: 0,
    refs: [],
    withdraws: [],
  };
}

function createDefaultState(): EarnPlayState {
  return {
    ...createDefaultProgress(),
    users: [],
    current: null,
  };
}

function normalizeRefs(rawRefs: unknown): ReferralEntry[] {
  if (!Array.isArray(rawRefs)) return [];
  return rawRefs
    .map((item, idx): ReferralEntry | null => {
      if (typeof item === 'string' && item.trim()) {
        const clean = item.trim().toUpperCase();
        return {
          id: `ref_str_${idx}_${clean}`,
          code: clean,
          name: clean,
          coinsEarned: COINS_PER_INVITE,
          date: 'Verified',
          level: 1,
        };
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const code =
          typeof obj.code === 'string' && obj.code.trim()
            ? obj.code.trim().toUpperCase()
            : 'INVITE';
        const level = obj.level === 2 ? 2 : 1;
        return {
          id: typeof obj.id === 'string' ? obj.id : `ref_${idx}_${code}`,
          code,
          name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : code,
          coinsEarned:
            typeof obj.coinsEarned === 'number' && Number.isFinite(obj.coinsEarned)
              ? obj.coinsEarned
              : level === 2
                ? COINS_PER_LEVEL2_INVITE
                : COINS_PER_INVITE,
          date: typeof obj.date === 'string' ? obj.date : 'Verified',
          level,
        };
      }
      return null;
    })
    .filter((r): r is ReferralEntry => r !== null);
}

function normalizeWithdraws(rawWithdraws: unknown): WithdrawEntry[] {
  if (!Array.isArray(rawWithdraws)) return [];
  return rawWithdraws
    .map((item, idx): WithdrawEntry | null => {
      if (!item || typeof item === 'object' && item === null) return null;
      if (typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const methodRaw = typeof obj.method === 'string' ? obj.method : 'EasyPaisa';
      const method: WithdrawMethod =
        methodRaw === 'JazzCash' || methodRaw === 'RedotPay' ? methodRaw : 'EasyPaisa';
      const amount =
        typeof obj.amount === 'number' && Number.isFinite(obj.amount)
          ? Math.floor(obj.amount)
          : typeof obj.coins === 'number' && Number.isFinite(obj.coins)
            ? Math.floor(obj.coins)
            : MIN_WITHDRAW_COINS;
      const number =
        typeof obj.number === 'string'
          ? obj.number
          : typeof obj.account === 'string'
            ? obj.account
            : '';
      const status =
        typeof obj.status === 'string' && obj.status.trim()
          ? obj.status
          : 'Pending - Will arrive in 24-48h';
      const date =
        typeof obj.date === 'string'
          ? obj.date
          : typeof obj.createdAt === 'string'
            ? obj.createdAt
            : new Date().toLocaleString('en-US');

      return {
        id: typeof obj.id === 'string' ? obj.id : `wd_${idx}_${Date.now()}`,
        method,
        number,
        amount,
        usd: Number((amount / COINS_PER_USD).toFixed(2)),
        status,
        date,
      };
    })
    .filter((w): w is WithdrawEntry => w !== null);
}

function isValidAvatar(val: unknown): val is AvatarId {
  return (
    val === 'crown' ||
    val === 'flame' ||
    val === 'gem' ||
    val === 'bolt' ||
    val === 'rocket' ||
    val === 'star'
  );
}

function isValidSkin(val: unknown): val is CubeSkinId {
  return (
    val === 'classic' ||
    val === 'gold' ||
    val === 'diamond' ||
    val === 'fire' ||
    val === 'ramzan'
  );
}

function isValidSeasonalEvent(val: unknown): val is SeasonalEventId {
  return val === 'eid' || val === 'ramzan' || val === 'newyear' || val === 'standard';
}

function normalizeStringArray(raw: unknown, maxItems: number = 200): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((s) => s.trim().toUpperCase())
    .slice(0, maxItems);
}

function normalizeUserProofs(raw: unknown): ProofWallItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is ProofWallItem => Boolean(item && typeof item === 'object'))
    .slice(0, 20);
}

function normalizeProgress(
  obj: Record<string, unknown>,
  fallback: PlayerProgressFields,
): PlayerProgressFields {
  const today = getTodayDateKey();
  const yesterday = getYesterdayDateKey();

  const storedPlayDay = typeof obj.playDay === 'string' ? obj.playDay : today;
  const rawPlaySec =
    typeof obj.playSec === 'number' && Number.isFinite(obj.playSec)
      ? Math.max(0, Math.floor(obj.playSec))
      : fallback.playSec;

  const storedMissionsDay = typeof obj.missionsDay === 'string' ? obj.missionsDay : today;
  const sameMissionDay = storedMissionsDay === today;

  const storedTournamentDay = typeof obj.tournamentDay === 'string' ? obj.tournamentDay : today;
  const sameTournamentDay = storedTournamentDay === today;

  const storedMiniGamesDay = typeof obj.miniGamesDay === 'string' ? obj.miniGamesDay : today;
  const sameMiniGamesDay = storedMiniGamesDay === today;

  const lastActive = typeof obj.lastActiveDate === 'string' ? obj.lastActiveDate : today;
  const rawStreak =
    typeof obj.streakDays === 'number' && Number.isFinite(obj.streakDays)
      ? Math.max(1, Math.floor(obj.streakDays))
      : 1;
  let streakDays = rawStreak;
  if (lastActive === yesterday) {
    streakDays = rawStreak + 1;
  } else if (lastActive !== today) {
    streakDays = 1;
  }

  const lastLoginBonusDate =
    typeof obj.lastLoginBonusDate === 'string' ? obj.lastLoginBonusDate : null;
  let loginBonusDay =
    typeof obj.loginBonusDay === 'number' && Number.isFinite(obj.loginBonusDay)
      ? Math.min(7, Math.max(1, Math.floor(obj.loginBonusDay)))
      : 1;
  if (
    lastLoginBonusDate &&
    lastLoginBonusDate !== today &&
    lastLoginBonusDate !== yesterday
  ) {
    loginBonusDay = 1;
  }

  const validMissions: MissionId[] =
    sameMissionDay && Array.isArray(obj.claimedMissions)
      ? obj.claimedMissions.filter(
          (m): m is MissionId =>
            m === 'stack_50' || m === 'watch_5_ads' || m === 'invite_1' || m === 'perfect_10',
        )
      : [];

  return {
    coins:
      typeof obj.coins === 'number' && Number.isFinite(obj.coins)
        ? Math.max(0, Math.floor(obj.coins))
        : fallback.coins,
    lives:
      typeof obj.lives === 'number' && Number.isFinite(obj.lives)
        ? Math.max(0, Math.floor(obj.lives))
        : fallback.lives,
    best:
      typeof obj.best === 'number' && Number.isFinite(obj.best)
        ? Math.max(fallback.best, Math.floor(obj.best))
        : fallback.best,
    playSec: storedPlayDay === today ? rawPlaySec : 0,
    playDay: today,
    claimed6hDay: typeof obj.claimed6hDay === 'string' ? obj.claimed6hDay : null,
    totalBlocksStacked:
      typeof obj.totalBlocksStacked === 'number' && Number.isFinite(obj.totalBlocksStacked)
        ? Math.max(0, Math.floor(obj.totalBlocksStacked))
        : 0,
    avatarId: isValidAvatar(obj.avatarId) ? obj.avatarId : 'crown',
    selectedSkin: isValidSkin(obj.selectedSkin) ? obj.selectedSkin : 'classic',
    ramzanSkinUnlocked: Boolean(obj.ramzanSkinUnlocked),
    battlePassActive: Boolean(obj.battlePassActive),
    streakDays,
    lastActiveDate: today,
    loginBonusDay,
    lastLoginBonusDate,
    lastFreeSpinDate: typeof obj.lastFreeSpinDate === 'string' ? obj.lastFreeSpinDate : null,
    extraSpins:
      typeof obj.extraSpins === 'number' && Number.isFinite(obj.extraSpins)
        ? Math.max(0, Math.floor(obj.extraSpins))
        : 0,
    missionsDay: today,
    blocksToday:
      sameMissionDay && typeof obj.blocksToday === 'number' && Number.isFinite(obj.blocksToday)
        ? Math.max(0, Math.floor(obj.blocksToday))
        : 0,
    adsToday:
      sameMissionDay && typeof obj.adsToday === 'number' && Number.isFinite(obj.adsToday)
        ? Math.max(0, Math.floor(obj.adsToday))
        : 0,
    invitesToday:
      sameMissionDay && typeof obj.invitesToday === 'number' && Number.isFinite(obj.invitesToday)
        ? Math.max(0, Math.floor(obj.invitesToday))
        : 0,
    perfectsToday:
      sameMissionDay && typeof obj.perfectsToday === 'number' && Number.isFinite(obj.perfectsToday)
        ? Math.max(0, Math.floor(obj.perfectsToday))
        : 0,
    claimedMissions: validMissions,
    tournamentDay: today,
    todayBestScore:
      sameTournamentDay &&
      typeof obj.todayBestScore === 'number' &&
      Number.isFinite(obj.todayBestScore)
        ? Math.max(0, Math.floor(obj.todayBestScore))
        : 0,
    claimedTournamentDay:
      typeof obj.claimedTournamentDay === 'string' ? obj.claimedTournamentDay : null,
    redeemedPromoCodes: normalizeStringArray(obj.redeemedPromoCodes),
    miniGamesDay: today,
    freeMiniGamesUsedToday:
      sameMiniGamesDay &&
      typeof obj.freeMiniGamesUsedToday === 'number' &&
      Number.isFinite(obj.freeMiniGamesUsedToday)
        ? Math.max(0, Math.floor(obj.freeMiniGamesUsedToday))
        : 0,
    colorGuessStreak:
      typeof obj.colorGuessStreak === 'number' && Number.isFinite(obj.colorGuessStreak)
        ? Math.max(0, Math.floor(obj.colorGuessStreak))
        : 0,
    completedBattleCodes: normalizeStringArray(obj.completedBattleCodes),
    battlesWon:
      typeof obj.battlesWon === 'number' && Number.isFinite(obj.battlesWon)
        ? Math.max(0, Math.floor(obj.battlesWon))
        : 0,
    lastOfflineClaimMs:
      typeof obj.lastOfflineClaimMs === 'number' && Number.isFinite(obj.lastOfflineClaimMs)
        ? obj.lastOfflineClaimMs
        : fallback.lastOfflineClaimMs,
    pushAlertsEnabled: Boolean(obj.pushAlertsEnabled),
    lastMysteryBoxMs:
      typeof obj.lastMysteryBoxMs === 'number' && Number.isFinite(obj.lastMysteryBoxMs)
        ? Math.max(0, Math.floor(obj.lastMysteryBoxMs))
        : 0,
    activeSeasonalEvent: isValidSeasonalEvent(obj.activeSeasonalEvent)
      ? obj.activeSeasonalEvent
      : 'eid',
    vipClubExpiresMs:
      typeof obj.vipClubExpiresMs === 'number' && Number.isFinite(obj.vipClubExpiresMs)
        ? Math.max(0, Math.floor(obj.vipClubExpiresMs))
        : 0,
    lastVipDailyDate: typeof obj.lastVipDailyDate === 'string' ? obj.lastVipDailyDate : null,
    userProofWall: normalizeUserProofs(obj.userProofWall),
    referredByCode:
      typeof obj.referredByCode === 'string' && obj.referredByCode.trim()
        ? obj.referredByCode.trim().toUpperCase()
        : null,
    teamLevel2Count:
      typeof obj.teamLevel2Count === 'number' && Number.isFinite(obj.teamLevel2Count)
        ? Math.max(0, Math.floor(obj.teamLevel2Count))
        : 0,
    teamLevel2Coins:
      typeof obj.teamLevel2Coins === 'number' && Number.isFinite(obj.teamLevel2Coins)
        ? Math.max(0, Math.floor(obj.teamLevel2Coins))
        : 0,
    refs: normalizeRefs(obj.refs),
    withdraws: normalizeWithdraws(obj.withdraws),
  };
}

function normalizeState(raw: unknown): EarnPlayState {
  const fallback = createDefaultState();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;

  const users: LocalUserAccount[] = Array.isArray(obj.users)
    ? obj.users
        .filter((u): u is Record<string, unknown> => Boolean(u && typeof u === 'object'))
        .map((u) => {
          const name = typeof u.name === 'string' && u.name.trim() ? u.name.trim() : 'Player';
          const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
          const pass =
            typeof u.pass === 'string'
              ? u.pass
              : typeof u.password === 'string'
                ? encodePass(u.password)
                : '';
          const code =
            typeof u.code === 'string' && u.code.trim() ? u.code.trim().toUpperCase() : '';

          const prog = normalizeProgress(u, fallback);
          return {
            ...prog,
            name,
            email,
            pass,
            code,
          };
        })
        .filter((u) => u.email.length > 0)
    : [];

  const codeSet = new Set(users.map((u) => u.code).filter(Boolean));
  for (const u of users) {
    if (!u.code) {
      u.code = generateUserCode(u.name, codeSet);
      codeSet.add(u.code);
    }
  }

  const currentEmail =
    typeof obj.current === 'string' && obj.current.trim()
      ? obj.current.trim().toLowerCase()
      : null;

  const activeUser = currentEmail ? users.find((u) => u.email === currentEmail) ?? null : null;

  if (activeUser) {
    const { name: _n, email: _e, pass: _p, code: _c, ...userProgress } = activeUser;
    return {
      ...userProgress,
      users,
      current: activeUser.email,
    };
  }

  const guestProg = normalizeProgress(obj, fallback);
  return {
    ...guestProg,
    users,
    current: null,
  };
}

export function loadEarnPlayState(): EarnPlayState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const rawV3 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV3) {
      const loaded = normalizeState(JSON.parse(rawV3));
      return saveEarnPlayState(loaded);
    }
    const rawV2 = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawV2) {
      const migrated = normalizeState(JSON.parse(rawV2));
      return saveEarnPlayState(migrated);
    }
    const initial = createDefaultState();
    return saveEarnPlayState(initial);
  } catch {
    return createDefaultState();
  }
}

export function saveEarnPlayState(state: EarnPlayState): EarnPlayState {
  const { users, current, ...progressSnapshot } = state;

  const nextUsers = users.map((u) => {
    if (current && u.email === current) {
      return {
        ...u,
        ...progressSnapshot,
      };
    }
    return u;
  });

  const synced: EarnPlayState = {
    ...progressSnapshot,
    users: nextUsers,
    current,
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
      window.localStorage.setItem('color_stack_best_score', String(synced.best));
    } catch {
      // ignore storage quota errors
    }
  }
  return synced;
}

export function getActiveUser(state: EarnPlayState): LocalUserAccount | null {
  if (!state.current) return null;
  return state.users.find((u) => u.email === state.current) ?? null;
}

// ============================================================================
// NEXT-LEVEL FEATURE 1: GIFT CODE / PROMO CODE REDEMPTION
// ============================================================================
export function redeemPromoCode(
  state: EarnPlayState,
  rawCode: string,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) {
    return {
      ok: false,
      message: 'Enter a Gift / Promo Code (e.g. EID100, RAMZAN50, NEWYEAR100).',
      nextState: state,
    };
  }

  if (state.redeemedPromoCodes.includes(clean)) {
    return {
      ok: false,
      message: `Promo Code ${clean} has already been redeemed on this account.`,
      nextState: state,
    };
  }

  const spec = PROMO_CODES_CATALOG.find((p) => p.code === clean);
  if (!spec) {
    return {
      ok: false,
      message: `Invalid or expired Promo Code "${clean}". Try EID100 or RAMZAN50!`,
      nextState: state,
    };
  }

  const bpMult = state.battlePassActive ? 2 : 1;
  const reward = spec.baseCoins * bpMult;
  const unlockRamzan = Boolean(spec.unlocksRamzanSkin) || state.ramzanSkinUnlocked;

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + reward,
    ramzanSkinUnlocked: unlockRamzan,
    selectedSkin: spec.unlocksRamzanSkin ? 'ramzan' : state.selectedSkin,
    redeemedPromoCodes: [...state.redeemedPromoCodes, clean],
  });

  return {
    ok: true,
    message: `${spec.title} Redeemed! +${reward} Coins${
      spec.unlocksRamzanSkin ? ' & Ramzan Crescent 3D Skin equipped!' : ' added!'
    }`,
    nextState,
  };
}

// ============================================================================
// NEXT-LEVEL FEATURE 2: 3-IN-1 MINI-GAMES (LUCKY NUMBER & GUESS COLOR)
// ============================================================================
export function getFreeMiniGamesRemaining(state: EarnPlayState): number {
  if (isVipClubActive(state)) return 999;
  return Math.max(0, MINI_GAME_FREE_DAILY_ROUNDS - state.freeMiniGamesUsedToday);
}

export function playLuckyNumberMiniGame(
  state: EarnPlayState,
  pickedNumber: number,
): {
  ok: boolean;
  won: boolean;
  rolledNumber: number;
  netCoinsDelta: number;
  rewardCoins: number;
  message: string;
  nextState: EarnPlayState;
} {
  const vipFree = isVipClubActive(state);
  const hasFreeRound = vipFree || state.freeMiniGamesUsedToday < MINI_GAME_FREE_DAILY_ROUNDS;
  const entryCost = hasFreeRound ? 0 : MINI_GAME_EXTRA_COST_COINS;

  if (state.coins < entryCost) {
    return {
      ok: false,
      won: false,
      rolledNumber: 1,
      netCoinsDelta: 0,
      rewardCoins: 0,
      message: `Need ${entryCost} Coins to play an extra round (or unlock Monthly VIP Club for unlimited free plays!).`,
      nextState: state,
    };
  }

  const safePick = Math.min(9, Math.max(1, Math.floor(pickedNumber)));
  const rolledNumber = 1 + Math.floor(Math.random() * 9);
  const mult = getRewardMultiplier(state);

  let rewardCoins = 0;
  let won = false;
  if (rolledNumber === safePick) {
    rewardCoins = 45 * mult;
    won = true;
  } else if (Math.abs(rolledNumber - safePick) === 1) {
    rewardCoins = 10 * mult;
    won = true;
  }

  const netCoinsDelta = rewardCoins - entryCost;
  const nextState = saveEarnPlayState({
    ...state,
    coins: Math.max(0, state.coins + netCoinsDelta),
    freeMiniGamesUsedToday: vipFree
      ? state.freeMiniGamesUsedToday
      : state.freeMiniGamesUsedToday + 1,
  });

  const message =
    rolledNumber === safePick
      ? `EXACT HIT (${rolledNumber})! Jackpot +${rewardCoins} Coins!`
      : Math.abs(rolledNumber - safePick) === 1
        ? `Close Match! Rolled ${rolledNumber} (You picked ${safePick}) — Won +${rewardCoins} Coins!`
        : `Rolled ${rolledNumber} (You picked ${safePick}). Try again!`;

  return {
    ok: true,
    won,
    rolledNumber,
    netCoinsDelta,
    rewardCoins,
    message,
    nextState,
  };
}

export function playGuessColorMiniGame(
  state: EarnPlayState,
  pickedColor: GuessPrismColor,
): {
  ok: boolean;
  won: boolean;
  drawnColor: GuessPrismColor;
  rewardCoins: number;
  streak: number;
  message: string;
  nextState: EarnPlayState;
} {
  const vipFree = isVipClubActive(state);
  const hasFreeRound = vipFree || state.freeMiniGamesUsedToday < MINI_GAME_FREE_DAILY_ROUNDS;
  const entryCost = hasFreeRound ? 0 : MINI_GAME_EXTRA_COST_COINS;

  if (state.coins < entryCost) {
    return {
      ok: false,
      won: false,
      drawnColor: 'pink',
      rewardCoins: 0,
      streak: state.colorGuessStreak,
      message: `Need ${entryCost} Coins for an extra round (or Monthly VIP Club for unlimited free plays!).`,
      nextState: state,
    };
  }

  const options: GuessPrismColor[] = ['pink', 'emerald', 'gold'];
  const drawnColor = options[Math.floor(Math.random() * options.length)];
  const won = drawnColor === pickedColor;
  const nextStreak = won ? state.colorGuessStreak + 1 : 0;
  const mult = getRewardMultiplier(state);
  const baseWin = 15 + Math.min(20, (nextStreak - 1) * 5);
  const rewardCoins = won ? baseWin * mult : 0;

  const nextState = saveEarnPlayState({
    ...state,
    coins: Math.max(0, state.coins - entryCost + rewardCoins),
    freeMiniGamesUsedToday: vipFree
      ? state.freeMiniGamesUsedToday
      : state.freeMiniGamesUsedToday + 1,
    colorGuessStreak: nextStreak,
  });

  const pretty = (c: GuessPrismColor) =>
    c === 'pink' ? 'Neon Pink' : c === 'emerald' ? 'Emerald Mint' : 'Royal Gold';

  const message = won
    ? `MATCH! Prism was ${pretty(drawnColor)}! +${rewardCoins} Coins (Streak ×${nextStreak})!`
    : `Prism revealed ${pretty(drawnColor)}. Pick again to start a new streak!`;

  return {
    ok: true,
    won,
    drawnColor,
    rewardCoins,
    streak: nextStreak,
    message,
    nextState,
  };
}

// ============================================================================
// NEXT-LEVEL FEATURE 3: FRIEND VS FRIEND 1V1 SCORE BATTLE (+50 COINS)
// ============================================================================
export function createFriendBattleCode(state: EarnPlayState): {
  code: string;
  targetScore: number;
  creatorName: string;
} {
  const activeUser = getActiveUser(state);
  const creatorName = activeUser ? activeUser.name : 'Guest';
  const targetScore = Math.max(15, state.best);
  const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
  return {
    code: `BTL-${targetScore}-${suffix}`,
    targetScore,
    creatorName,
  };
}

export function parseFriendBattleCode(rawCode: string): {
  valid: boolean;
  normalizedCode: string;
  targetScore: number;
} {
  const clean = rawCode.trim().toUpperCase();
  const match = /^BTL-(\d{1,6})-([A-Z0-9]{2,8})$/.exec(clean);
  if (!match) {
    return { valid: false, normalizedCode: clean, targetScore: 0 };
  }
  const targetScore = Math.max(1, parseInt(match[1], 10));
  return {
    valid: true,
    normalizedCode: clean,
    targetScore,
  };
}

export function resolveFriendBattleChallenge(
  state: EarnPlayState,
  rawCode: string,
  challengerName?: string,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const parsed = parseFriendBattleCode(rawCode);
  if (!parsed.valid) {
    return {
      ok: false,
      message: 'Enter a valid Battle Code like BTL-45-K9P2 (or pick an Open Battle below).',
      nextState: state,
    };
  }

  if (state.completedBattleCodes.includes(parsed.normalizedCode)) {
    return {
      ok: false,
      message: `You already settled Battle ${parsed.normalizedCode}! Challenge another friend.`,
      nextState: state,
    };
  }

  const myScore = Math.max(state.best, state.todayBestScore);
  if (myScore <= parsed.targetScore) {
    return {
      ok: false,
      message: `${challengerName || 'Friend'} scored ${parsed.targetScore} (Your Best: ${myScore}). Stack ${
        parsed.targetScore + 1
      }+ blocks in 3D Stack to beat them & win +${FRIEND_BATTLE_PRIZE_COINS} Coins!`,
      nextState: state,
    };
  }

  const mult = state.battlePassActive ? 2 : 1;
  const prize = FRIEND_BATTLE_PRIZE_COINS * mult;

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + prize,
    battlesWon: state.battlesWon + 1,
    completedBattleCodes: [...state.completedBattleCodes, parsed.normalizedCode],
  });

  return {
    ok: true,
    message: `VICTORY! Your Best (${myScore}) crushed ${
      challengerName || "your friend's"
    } ${parsed.targetScore}! Won +${prize} Coins!`,
    nextState,
  };
}

// ============================================================================
// NEXT-LEVEL FEATURE 4: OFFLINE SLEEP EARNINGS (UP TO 8 HOURS = 50 COINS)
// ============================================================================
export function getOfflineEarningsStatus(
  state: EarnPlayState,
  nowMs: number = Date.now(),
): {
  elapsedSec: number;
  cappedHours: number;
  pendingCoins: number;
  maxCoins: number;
  percentFull: number;
} {
  const elapsedMs = Math.max(0, nowMs - state.lastOfflineClaimMs);
  const maxMs = OFFLINE_MAX_HOURS * 3600 * 1000;
  const ratio = Math.min(1, elapsedMs / maxMs);
  const mult = state.battlePassActive || isVipClubActive(state) ? 2 : 1;
  const maxCoins = OFFLINE_MAX_COINS * mult;
  const pendingCoins = Math.floor(ratio * maxCoins);

  return {
    elapsedSec: Math.floor(elapsedMs / 1000),
    cappedHours: Number((ratio * OFFLINE_MAX_HOURS).toFixed(1)),
    pendingCoins,
    maxCoins,
    percentFull: Math.round(ratio * 100),
  };
}

export function claimOfflineSleepCoins(state: EarnPlayState): {
  ok: boolean;
  rewardCoins: number;
  message: string;
  nextState: EarnPlayState;
} {
  const now = Date.now();
  const status = getOfflineEarningsStatus(state, now);
  if (status.pendingCoins < 1) {
    return {
      ok: false,
      rewardCoins: 0,
      message: 'Offline Vault is filling up (earns up to 50 Coins every 8 hours while away). Check back soon!',
      nextState: state,
    };
  }

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + status.pendingCoins,
    lastOfflineClaimMs: now,
  });

  return {
    ok: true,
    rewardCoins: status.pendingCoins,
    message: `Offline Sleep Vault Collected! +${status.pendingCoins} Coins added!`,
    nextState,
  };
}

// ============================================================================
// NEXT-LEVEL FEATURE 6: 2-HOUR LUCKY MYSTERY BOX (5 TO 500 COINS)
// ============================================================================
export function getMysteryBoxStatus(
  state: EarnPlayState,
  nowMs: number = Date.now(),
): {
  ready: boolean;
  remainingSec: number;
  formattedCountdown: string;
} {
  if (state.lastMysteryBoxMs <= 0) {
    return { ready: true, remainingSec: 0, formattedCountdown: 'Ready Now' };
  }
  const unlockAt = state.lastMysteryBoxMs + MYSTERY_BOX_COOLDOWN_MS;
  const diffMs = unlockAt - nowMs;
  if (diffMs <= 0) {
    return { ready: true, remainingSec: 0, formattedCountdown: 'Ready Now' };
  }
  const remSec = Math.ceil(diffMs / 1000);
  const h = Math.floor(remSec / 3600);
  const m = Math.floor((remSec % 3600) / 60);
  const s = remSec % 60;
  return {
    ready: false,
    remainingSec: remSec,
    formattedCountdown: `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(
      s,
    ).padStart(2, '0')}s`,
  };
}

export function openMysteryLuckyBox(
  state: EarnPlayState,
  bypassCooldownWithAd: boolean = false,
): {
  ok: boolean;
  rewardCoins: number;
  message: string;
  nextState: EarnPlayState;
} {
  const status = getMysteryBoxStatus(state);
  if (!status.ready && !bypassCooldownWithAd) {
    return {
      ok: false,
      rewardCoins: 0,
      message: `Next Mystery Box unlocks in ${status.formattedCountdown} (or Watch Ad to open instantly!).`,
      nextState: state,
    };
  }

  // Weighted mystery prizes from 5 Coins up to 500 Coins Jackpot
  const roll = Math.random() * 100;
  let basePrize = 10;
  if (roll < 28) basePrize = 5;
  else if (roll < 55) basePrize = 15;
  else if (roll < 76) basePrize = 30;
  else if (roll < 90) basePrize = 50;
  else if (roll < 96.5) basePrize = 100;
  else if (roll < 99.2) basePrize = 250;
  else basePrize = 500;

  const mult = getRewardMultiplier(state);
  const rewardCoins = basePrize * mult;

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + rewardCoins,
    lastMysteryBoxMs: Date.now(),
  });

  return {
    ok: true,
    rewardCoins,
    message: `MYSTERY BOX OPENED! Surprise Prize: +${rewardCoins} Coins!`,
    nextState,
  };
}

// ============================================================================
// NEXT-LEVEL FEATURE 7: SEASONAL EVENTS (EID / RAMZAN / NEW YEAR)
// ============================================================================
export function selectSeasonalEvent(
  state: EarnPlayState,
  eventId: SeasonalEventId,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const spec = SEASONAL_EVENTS_CATALOG.find((e) => e.id === eventId);
  if (!spec) {
    return { ok: false, message: 'Seasonal event not found.', nextState: state };
  }

  const unlockRamzan = eventId === 'ramzan' || state.ramzanSkinUnlocked;
  const nextSkin = eventId === 'ramzan' ? 'ramzan' : state.selectedSkin;

  const nextState = saveEarnPlayState({
    ...state,
    activeSeasonalEvent: eventId,
    ramzanSkinUnlocked: unlockRamzan,
    selectedSkin: nextSkin,
  });

  return {
    ok: true,
    message: `${spec.name} Active! (${spec.badge})`,
    nextState,
  };
}

// ============================================================================
// NEXT-LEVEL FEATURE 8: MONTHLY VIP CLUB ($5 = 5,000 COINS)
// ============================================================================
export function activateMonthlyVipClub(state: EarnPlayState): {
  ok: boolean;
  message: string;
  nextState: EarnPlayState;
} {
  const now = Date.now();
  if (isVipClubActive(state, now)) {
    return {
      ok: false,
      message: `Monthly VIP Club is already active (${getVipClubDaysRemaining(state, now)} days remaining)!`,
      nextState: state,
    };
  }

  if (state.coins < VIP_CLUB_MONTHLY_COST_COINS) {
    return {
      ok: false,
      message: `Need ${VIP_CLUB_MONTHLY_COST_COINS.toLocaleString()} Coins ($5.00 value) to join Monthly VIP Club.`,
      nextState: state,
    };
  }

  const today = getTodayDateKey();
  const alreadyGotDaily = state.lastVipDailyDate === today;
  const instantDailyBonus = alreadyGotDaily ? 0 : VIP_CLUB_DAILY_FREE_COINS;

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins - VIP_CLUB_MONTHLY_COST_COINS + instantDailyBonus,
    vipClubExpiresMs: now + 30 * 24 * 60 * 60 * 1000,
    lastVipDailyDate: today,
  });

  return {
    ok: true,
    message: `Welcome to Monthly VIP Club! Zero Ads, 1-Hour Express Withdrawals & +${VIP_CLUB_DAILY_FREE_COINS} Daily Coins activated!`,
    nextState,
  };
}

export function claimVipClubDailyCoins(state: EarnPlayState): {
  ok: boolean;
  message: string;
  nextState: EarnPlayState;
} {
  if (!isVipClubActive(state)) {
    return {
      ok: false,
      message: 'Join Monthly VIP Club ($5 = 5,000 Coins) to claim +100 Free Coins every day!',
      nextState: state,
    };
  }

  const today = getTodayDateKey();
  if (state.lastVipDailyDate === today) {
    return {
      ok: false,
      message: "Today's +100 VIP Club Coins already claimed! Come back tomorrow.",
      nextState: state,
    };
  }

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + VIP_CLUB_DAILY_FREE_COINS,
    lastVipDailyDate: today,
  });

  return {
    ok: true,
    message: `+${VIP_CLUB_DAILY_FREE_COINS} Monthly VIP Club Daily Coins Claimed!`,
    nextState,
  };
}

// ============================================================================
// NEXT-LEVEL FEATURE 9: SHARE PAYOUT TO VIDEO / RECEIPT PROOF WALL
// ============================================================================
export function postLatestWithdrawToProofWall(state: EarnPlayState): {
  ok: boolean;
  message: string;
  nextState: EarnPlayState;
} {
  if (state.withdraws.length === 0) {
    return {
      ok: false,
      message: 'Submit your first withdrawal request to post your receipt on the Proof Wall!',
      nextState: state,
    };
  }

  const latest = state.withdraws[0];
  const proofId = `usr_pf_${latest.id}`;
  if (state.userProofWall.some((p) => p.id === proofId)) {
    return {
      ok: false,
      message: 'Your latest withdrawal receipt is already live on the Proof Wall!',
      nextState: state,
    };
  }

  const activeUser = getActiveUser(state);
  const playerName = activeUser ? activeUser.name : 'Verified Stacker';

  const newProof: ProofWallItem = {
    id: proofId,
    player: playerName,
    tier: getPlayerRank(state.coins + latest.amount),
    method: latest.method,
    usd: latest.usd,
    txRef: `TX-${latest.id.slice(-6).toUpperCase()}`,
    payoutSpeed: isVipClubActive(state) ? '1 Hour (VIP Express)' : '24-48h Standard',
    mediaType: 'Receipt Screenshot',
    durationLabel: 'Verified Slip',
    caption: `Withdrew $${latest.usd.toFixed(2)} via ${latest.method} (${latest.status}).`,
    timeAgo: 'Just now',
  };

  const nextState = saveEarnPlayState({
    ...state,
    userProofWall: [newProof, ...state.userProofWall].slice(0, 15),
  });

  return {
    ok: true,
    message: 'Your verified withdrawal receipt is now featured on the Proof Wall!',
    nextState,
  };
}

// ============================================================================
// EXISTING + UPGRADED PROGRESSION & ECONOMY FUNCTIONS
// ============================================================================
export function claimDailyLoginBonus(state: EarnPlayState): {
  ok: boolean;
  message: string;
  rewardEarned: number;
  nextState: EarnPlayState;
} {
  const today = getTodayDateKey();
  if (state.lastLoginBonusDate === today) {
    return {
      ok: false,
      message: "You already claimed today's Login Bonus! Come back tomorrow for a bigger reward.",
      rewardEarned: 0,
      nextState: state,
    };
  }

  const dayIdx = Math.min(7, Math.max(1, state.loginBonusDay)) - 1;
  const baseCoins = DAILY_LOGIN_REWARDS[dayIdx];
  const mult = getRewardMultiplier(state);
  const rewardEarned = baseCoins * mult;
  const nextLoginDay = state.loginBonusDay >= 7 ? 1 : state.loginBonusDay + 1;

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + rewardEarned,
    loginBonusDay: nextLoginDay,
    lastLoginBonusDate: today,
  });

  return {
    ok: true,
    message: `Day ${dayIdx + 1} Bonus Claimed! +${rewardEarned} Coins${
      mult > 1 ? ` (${mult}x Bonus!)` : ''
    } added!`,
    rewardEarned,
    nextState,
  };
}

export function canUseFreeSpinToday(state: EarnPlayState): boolean {
  return state.lastFreeSpinDate !== getTodayDateKey();
}

export function completeSpinWheel(
  state: EarnPlayState,
  segmentCoins: number,
  usedFreeSpin: boolean,
): {
  rewardEarned: number;
  nextState: EarnPlayState;
} {
  const today = getTodayDateKey();
  const mult = getRewardMultiplier(state);
  const rewardEarned = segmentCoins * mult;

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + rewardEarned,
    lastFreeSpinDate: usedFreeSpin ? today : state.lastFreeSpinDate,
    extraSpins: usedFreeSpin ? state.extraSpins : Math.max(0, state.extraSpins - 1),
  });

  return {
    rewardEarned,
    nextState,
  };
}

export function getMissionProgressValue(state: EarnPlayState, id: MissionId): number {
  switch (id) {
    case 'stack_50':
      return state.blocksToday;
    case 'watch_5_ads':
      return state.adsToday;
    case 'invite_1':
      return state.invitesToday;
    case 'perfect_10':
      return state.perfectsToday;
  }
}

export function claimDailyMission(
  state: EarnPlayState,
  missionId: MissionId,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const spec = DAILY_MISSIONS_CATALOG.find((m) => m.id === missionId);
  if (!spec) {
    return { ok: false, message: 'Mission not found.', nextState: state };
  }
  if (state.claimedMissions.includes(missionId)) {
    return { ok: false, message: 'Mission already claimed today!', nextState: state };
  }
  const progress = getMissionProgressValue(state, missionId);
  if (progress < spec.target) {
    return {
      ok: false,
      message: `Complete ${spec.target - progress} more to unlock this mission reward!`,
      nextState: state,
    };
  }

  const mult = getRewardMultiplier(state);
  const reward = spec.rewardCoins * mult;

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + reward,
    claimedMissions: [...state.claimedMissions, missionId],
  });

  return {
    ok: true,
    message: `Mission Complete! +${reward} Coins${mult > 1 ? ` (${mult}x Bonus!)` : ''} claimed!`,
    nextState,
  };
}

export function isSkinUnlocked(state: EarnPlayState, skinId: CubeSkinId): boolean {
  if (skinId === 'ramzan') {
    return state.ramzanSkinUnlocked || state.activeSeasonalEvent === 'ramzan';
  }
  const spec = CUBE_SKINS_CATALOG.find((s) => s.id === skinId);
  if (!spec) return false;
  return getPlayerLevel(state) >= spec.unlockLevel;
}

export function equipCubeSkin(
  state: EarnPlayState,
  skinId: CubeSkinId,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const spec = CUBE_SKINS_CATALOG.find((s) => s.id === skinId);
  if (!spec) {
    return { ok: false, message: 'Skin not found.', nextState: state };
  }
  if (!isSkinUnlocked(state, skinId)) {
    if (skinId === 'ramzan') {
      return {
        ok: false,
        message: 'Switch to Ramzan Event or redeem promo code RAMZAN50 to unlock Ramzan Crescent!',
        nextState: state,
      };
    }
    const level = getPlayerLevel(state);
    return {
      ok: false,
      message: `${spec.name} unlocks at Level ${spec.unlockLevel} (You are Lv. ${level}).`,
      nextState: state,
    };
  }

  const nextState = saveEarnPlayState({
    ...state,
    selectedSkin: skinId,
  });

  return {
    ok: true,
    message: `${spec.name} equipped for 3D Stack!`,
    nextState,
  };
}

export function unlockBattlePass(state: EarnPlayState): {
  ok: boolean;
  message: string;
  nextState: EarnPlayState;
} {
  if (state.battlePassActive) {
    return {
      ok: false,
      message: 'VIP Battle Pass (2x Rewards) is already active!',
      nextState: state,
    };
  }
  if (state.coins < BATTLE_PASS_COST_COINS) {
    return {
      ok: false,
      message: `Need ${BATTLE_PASS_COST_COINS.toLocaleString()} Coins ($1.00 value) to activate VIP Battle Pass.`,
      nextState: state,
    };
  }

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins - BATTLE_PASS_COST_COINS,
    battlePassActive: true,
  });

  return {
    ok: true,
    message: 'VIP Battle Pass Activated! All Coin Rewards are now DOUBLED (2x)!',
    nextState,
  };
}

// Auth & Profile
export function registerLocalUser(
  state: EarnPlayState,
  rawName: string,
  rawEmail: string,
  rawPass: string,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const name = rawName.trim();
  const email = rawEmail.trim().toLowerCase();
  const password = rawPass;

  if (!name || !email || !password) {
    return {
      ok: false,
      message: 'Please fill Name, Email, and Password.',
      nextState: state,
    };
  }
  if (!email.includes('@')) {
    return {
      ok: false,
      message: 'Please enter a valid Email address.',
      nextState: state,
    };
  }
  if (state.users.some((u) => u.email === email)) {
    return {
      ok: false,
      message: 'This email already exists, please Login.',
      nextState: state,
    };
  }

  const existingCodes = new Set(state.users.map((u) => u.code));
  const code = generateUserCode(name, existingCodes);

  const baseProg = state.current ? createDefaultProgress() : { ...state };
  const { users: _u, current: _c, ...cleanProg } = baseProg as EarnPlayState;

  const newUser: LocalUserAccount = {
    ...cleanProg,
    name,
    email,
    pass: encodePass(password),
    code,
  };

  const nextState = saveEarnPlayState({
    ...cleanProg,
    users: [...state.users, newUser],
    current: newUser.email,
  });

  return {
    ok: true,
    message: `Registered! Welcome ${name} (Your Code: ${code})`,
    nextState,
  };
}

export function loginLocalUser(
  state: EarnPlayState,
  rawEmail: string,
  rawPass: string,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const email = rawEmail.trim().toLowerCase();
  const password = rawPass;

  if (!email || !password) {
    return {
      ok: false,
      message: 'Please enter Email and Password.',
      nextState: state,
    };
  }

  const encoded = encodePass(password);
  const found = state.users.find(
    (u) => u.email === email && (u.pass === encoded || u.pass === password),
  );
  if (!found) {
    return {
      ok: false,
      message: 'Email or Password is wrong.',
      nextState: state,
    };
  }

  const { name: _n, email: _e, pass: _p, code: _c, ...userProg } = found;
  const normalizedProg = normalizeProgress(
    userProg as unknown as Record<string, unknown>,
    createDefaultProgress(),
  );

  const nextState = saveEarnPlayState({
    ...normalizedProg,
    best: Math.max(normalizedProg.best, state.best),
    users: state.users,
    current: found.email,
  });

  return {
    ok: true,
    message: `Welcome back ${found.name}!`,
    nextState,
  };
}

export function logoutLocalUser(state: EarnPlayState): EarnPlayState {
  const persisted = saveEarnPlayState(state);
  const next: EarnPlayState = {
    ...persisted,
    current: null,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

// ============================================================================
// NEXT-LEVEL FEATURE 10: REFERRALS + LEVEL 2 TEAM INCOME (+5 COINS PER SUB-REF)
// ============================================================================
export function applyFriendReferralCode(
  state: EarnPlayState,
  rawCode: string,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!code) {
    return {
      ok: false,
      message: "Please enter a friend's Refer Code.",
      nextState: state,
    };
  }

  const activeUser = getActiveUser(state);
  if (activeUser && activeUser.code === code) {
    return {
      ok: false,
      message: 'You cannot use your own Refer Code.',
      nextState: state,
    };
  }

  if (state.refs.some((r) => r.code === code && r.level !== 2)) {
    return {
      ok: false,
      message: 'This code has already been used.',
      nextState: state,
    };
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });

  const bpMult = state.battlePassActive ? 2 : 1;
  const earnedCoins = COINS_PER_INVITE * bpMult;

  // Find direct inviter (Level 1) and their inviter (Level 2 upline!)
  const level1Inviter = state.users.find((u) => u.code === code) ?? null;
  const level2UplineCode = level1Inviter?.referredByCode ?? null;

  const updatedUsers = state.users.map((u) => {
    // Credit Level 1 Inviter (+20 Coins)
    if (u.code === code && (!activeUser || u.email !== activeUser.email)) {
      const inviterCode = activeUser ? activeUser.code : `INV${Date.now().toString().slice(-3)}`;
      if (!u.refs.some((r) => r.code === inviterCode)) {
        return {
          ...u,
          coins: u.coins + COINS_PER_INVITE,
          invitesToday: u.invitesToday + 1,
          refs: [
            ...u.refs,
            {
              id: `ref_${Date.now()}_l1`,
              code: inviterCode,
              name: activeUser ? activeUser.name : 'Direct Invite',
              coinsEarned: COINS_PER_INVITE,
              date: dateStr,
              level: 1 as const,
            },
          ],
        };
      }
    }

    // Credit Level 2 Team Upline (+5 Coins Team Income!)
    if (level2UplineCode && u.code === level2UplineCode && (!activeUser || u.email !== activeUser.email)) {
      const subName = activeUser ? `${activeUser.name} (via ${level1Inviter?.name || code})` : `Team Member (via ${code})`;
      return {
        ...u,
        coins: u.coins + COINS_PER_LEVEL2_INVITE,
        teamLevel2Count: u.teamLevel2Count + 1,
        teamLevel2Coins: u.teamLevel2Coins + COINS_PER_LEVEL2_INVITE,
        refs: [
          ...u.refs,
          {
            id: `ref_${Date.now()}_l2`,
            code: `${code}-TEAM`,
            name: subName,
            coinsEarned: COINS_PER_LEVEL2_INVITE,
            date: dateStr,
            level: 2 as const,
          },
        ],
      };
    }

    return u;
  });

  const newRef: ReferralEntry = {
    id: `ref_${Date.now()}`,
    code,
    name: code,
    coinsEarned: earnedCoins,
    date: dateStr,
    level: 1,
  };

  // Every 1 direct referral can also unlock a Level-2 sub-team bonus when your friend invites their first friend
  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + earnedCoins,
    invitesToday: state.invitesToday + 1,
    referredByCode: state.referredByCode ?? code,
    refs: [...state.refs, newRef],
    users: updatedUsers,
  });

  return {
    ok: true,
    message: `Refer Applied! +${earnedCoins} Coins added (Level-2 Team Network active: +${COINS_PER_LEVEL2_INVITE} Coins whenever your referrals invite friends!).`,
    nextState,
  };
}

export function registerLevel2SubInvite(
  state: EarnPlayState,
  parentRefCode: string,
  subFriendCode: string,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const cleanSub = subFriendCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!cleanSub) {
    return {
      ok: false,
      message: "Enter your friend's sub-invite code to claim your Level-2 Team commission (+5 Coins).",
      nextState: state,
    };
  }

  const level1Refs = state.refs.filter((r) => r.level !== 2);
  if (level1Refs.length === 0) {
    return {
      ok: false,
      message: 'Invite at least 1 Level-1 friend first to start earning Level-2 Team Income!',
      nextState: state,
    };
  }

  const compositeKey = `${parentRefCode || level1Refs[0].code}->${cleanSub}`;
  if (state.refs.some((r) => r.code === compositeKey)) {
    return {
      ok: false,
      message: 'This Level-2 Team invite has already been credited.',
      nextState: state,
    };
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });

  const bonus = COINS_PER_LEVEL2_INVITE * (state.battlePassActive ? 2 : 1);
  const newTeamEntry: ReferralEntry = {
    id: `ref_l2_${Date.now()}`,
    code: compositeKey,
    name: `${cleanSub} (L2 Team)`,
    coinsEarned: bonus,
    date: dateStr,
    level: 2,
  };

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + bonus,
    teamLevel2Count: state.teamLevel2Count + 1,
    teamLevel2Coins: state.teamLevel2Coins + bonus,
    refs: [...state.refs, newTeamEntry],
  });

  return {
    ok: true,
    message: `Level-2 Team Bonus! +${bonus} Coins earned from ${cleanSub}!`,
    nextState,
  };
}

// Daily 6H $5.00 Reward
export function claimSixHourPlayReward(state: EarnPlayState): {
  ok: boolean;
  message: string;
  nextState: EarnPlayState;
} {
  const today = getTodayDateKey();
  if (state.claimed6hDay === today) {
    return {
      ok: false,
      message: "Today's $5.00 daily 6-hour reward has already been claimed! Come back tomorrow.",
      nextState: state,
    };
  }

  if (state.playSec < PLAYTIME_TARGET_SEC) {
    return {
      ok: false,
      message: '6 hours not completed yet. Keep playing today to earn $5.00!',
      nextState: state,
    };
  }

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + PLAYTIME_REWARD_COINS,
    playSec: PLAYTIME_TARGET_SEC,
    playDay: today,
    claimed6hDay: today,
  });

  return {
    ok: true,
    message: `Daily 6h Reward Claimed! +${PLAYTIME_REWARD_COINS.toLocaleString()} Coins ($5.00 USD) added!`,
    nextState,
  };
}

// Withdrawals ($100 = 100,000 Coins minimum, 1-Hour Express with Monthly VIP Club!)
export function submitWithdrawRequest(
  state: EarnPlayState,
  method: WithdrawMethod,
  rawNumber: string,
  rawCoinsAmount: number,
): { ok: boolean; message: string; nextState: EarnPlayState } {
  const level1Count = state.refs.filter((r) => r.level !== 2).length;
  if (level1Count < INVITES_REQUIRED_FOR_WITHDRAW) {
    return {
      ok: false,
      message: `Withdraw will unlock after ${INVITES_REQUIRED_FOR_WITHDRAW} direct invites. Now ${level1Count}/${INVITES_REQUIRED_FOR_WITHDRAW}.`,
      nextState: state,
    };
  }

  const number = rawNumber.trim();
  const amount = Math.floor(rawCoinsAmount);

  if (!number || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      message: 'Please enter Account Number/ID and Amount.',
      nextState: state,
    };
  }

  if (amount < MIN_WITHDRAW_COINS) {
    return {
      ok: false,
      message: `Minimum ${MIN_WITHDRAW_COINS.toLocaleString()} Coins ($100) required.`,
      nextState: state,
    };
  }

  if (amount > state.coins) {
    return {
      ok: false,
      message: 'Not enough coins in your balance.',
      nextState: state,
    };
  }

  const vipExpress = isVipClubActive(state);
  const statusText = vipExpress
    ? 'VIP Express - Arrives within 1 Hour'
    : 'Pending - Will arrive in 24-48h';

  const entry: WithdrawEntry = {
    id: `wd_${Date.now()}`,
    method,
    number,
    amount,
    usd: Number((amount / COINS_PER_USD).toFixed(2)),
    status: statusText,
    date: new Date().toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins - amount,
    withdraws: [entry, ...state.withdraws],
  });

  return {
    ok: true,
    message: vipExpress
      ? `VIP Express Withdraw Sent! Arrives within 1 Hour on ${method}.`
      : `Withdraw Request Sent! Status Pending. Will arrive in 24-48h on ${method}.`,
    nextState,
  };
}

// Top 100 Leaderboard & Daily 9:00 PM Tournament
export interface LeaderboardRow {
  rank: number;
  name: string;
  tier: RankTier;
  coins: number;
  bestScore: number;
  isYou: boolean;
}

const LEADERBOARD_NAMES = [
  'Ali Raza', 'Hamza Khan', 'Fatima Noor', 'Zainab Bibi', 'Usman Tariq',
  'Bilal Ahmed', 'Ayesha Malik', 'Hassan Shah', 'Saad Rehman', 'Mariam Ali',
  'Fahad Iqbal', 'Hira Sheikh', 'Danish Butt', 'Sana Javed', 'Kamran Siddiqui',
  'Nida Yasir', 'Taha Siddiq', 'Areeba Fatima', 'Zeeshan Haider', 'Mahnoor Asif',
  'Omer Farooq', 'Rabia Basri', 'Salman Mirza', 'Khadija Tul', 'Arslan Jutt',
  'Zoya Nasir', 'Waqas Chaudhry', 'Iqra Aziz', 'Shehryar Munawar', 'Mehwish Hayat',
  'Adeel Hussain', 'Kinza Hashmi', 'Haris Rauf', 'Shaheen Afridi', 'Babar Azam',
  'Rizwan Malik', 'Shadab Khan', 'Naseem Shah', 'Fakhar Zaman', 'Saim Ayub',
  'Abrar Ahmed', 'Iftikhar Ch', 'Imad Wasim', 'Amir Mohammad', 'Sarfaraz A.',
  'Komal Meer', 'Yumna Zaidi', 'Wahaj Ali', 'Feroze K.', 'Hania Aamir',
  'Dananeer M.', 'Ahad Raza', 'Sajal Aly', 'Mawra Hocane', 'Urwa Hocane',
  'Farhan Saeed', 'Atif Aslam', 'Ali Zafar', 'Asim Azhar', 'Talha Anjum',
  'Talhah Yunus', 'Hasan Raheem', 'Abdul Hannan', 'Rovalio', 'Momina M.',
  'Quratulain B.', 'Aima Baig', 'Shae Gill', 'Uzair Jaswal', 'Mustafa Z.',
  'Rohail H.', 'Junaid Khan', 'Affan Waheed', 'Zahid Ahmed', 'Sami Khan',
  'Mikaal Z.', 'Faysal Q.', 'Humayun S.', 'Adnan Siddiqui', 'Imran Ashraf',
  'Osman Khalid', 'Shahzad Sheikh', 'Muneeb Butt', 'Aiman Khan', 'Minal Khan',
  'Sarah Khan', 'Falak Shabir', 'Noman Ijaz', 'Zaviyar N.', 'Nameer Khan',
  'Khushhal K.', 'Sehar Khan', 'Hamza Sohail', 'Anmol Baloch', 'Laiba Khan',
  'Dur-e-Fishan', 'Ramsha Khan', 'Saboor Aly', 'Ali Ansari',
];

export function getTop100Leaderboard(
  state: EarnPlayState,
  sortBy: 'coins' | 'score' = 'coins',
): LeaderboardRow[] {
  const activeUser = getActiveUser(state);
  const yourName = activeUser ? activeUser.name : 'You (Guest)';

  const rows: Omit<LeaderboardRow, 'rank'>[] = LEADERBOARD_NAMES.map((name, idx) => {
    const rankFactor = Math.pow((99 - idx) / 99, 2.35);
    const coins = Math.max(120, Math.round(180 + rankFactor * 48320 + ((idx * 37) % 95)));
    const bestScore = Math.max(24, Math.round(28 + Math.pow((99 - idx) / 99, 1.55) * 192));
    return {
      name,
      tier: getPlayerRank(coins),
      coins,
      bestScore,
      isYou: false,
    };
  });

  rows.push({
    name: yourName,
    tier: getPlayerRank(state.coins),
    coins: state.coins,
    bestScore: state.best,
    isYou: true,
  });

  rows.sort((a, b) => {
    if (sortBy === 'score') {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return b.coins - a.coins;
    }
    if (b.coins !== a.coins) return b.coins - a.coins;
    return b.bestScore - a.bestScore;
  });

  return rows.slice(0, 100).map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));
}

export interface TournamentRow {
  rank: number;
  name: string;
  todayScore: number;
  isYou: boolean;
}

export function getTournamentStandings(state: EarnPlayState): TournamentRow[] {
  const activeUser = getActiveUser(state);
  const yourName = activeUser ? activeUser.name : 'You (Guest)';
  const daySeed = getTodayDateKey()
    .split('-')
    .reduce((acc, part) => acc + parseInt(part, 10), 0);

  const contenders = [
    { name: 'Hamza Khan', todayScore: 68 + (daySeed % 14), isYou: false },
    { name: 'Ali Raza', todayScore: 63 + (daySeed % 11), isYou: false },
    { name: 'Fatima Noor', todayScore: 57 + (daySeed % 9), isYou: false },
    { name: 'Usman Tariq', todayScore: 52 + (daySeed % 7), isYou: false },
    { name: 'Ayesha Malik', todayScore: 46 + (daySeed % 8), isYou: false },
    { name: 'Bilal Ahmed', todayScore: 41 + (daySeed % 6), isYou: false },
    { name: 'Zainab Bibi', todayScore: 35 + (daySeed % 5), isYou: false },
    { name: yourName, todayScore: state.todayBestScore, isYou: true },
  ];

  contenders.sort((a, b) => b.todayScore - a.todayScore);
  return contenders.map((c, idx) => ({
    ...c,
    rank: idx + 1,
  }));
}

export function claimTournamentWinnerBonus(state: EarnPlayState): {
  ok: boolean;
  message: string;
  nextState: EarnPlayState;
} {
  const today = getTodayDateKey();
  if (state.claimedTournamentDay === today) {
    return {
      ok: false,
      message: "You already claimed today's $1.00 Tournament Winner Prize!",
      nextState: state,
    };
  }

  const standings = getTournamentStandings(state);
  const yourRow = standings.find((r) => r.isYou);
  if (!yourRow || yourRow.rank !== 1) {
    const topScore = standings[0]?.todayScore ?? 75;
    return {
      ok: false,
      message: `Beat #1 score (${topScore}) today to win the $1.00 (1,000 Coins) Tournament Prize!`,
      nextState: state,
    };
  }

  const nextState = saveEarnPlayState({
    ...state,
    coins: state.coins + TOURNAMENT_PRIZE_COINS,
    claimedTournamentDay: today,
  });

  return {
    ok: true,
    message: 'CHAMPION! You ranked #1 Today and won +1,000 Coins ($1.00 Bonus)!',
    nextState,
  };
}

export function getCountdownTo9PM(): string {
  const now = new Date();
  const target = new Date(now);
  target.setHours(21, 0, 0, 0);
  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(
    2,
    '0',
  )}s`;
}

export function formatPlayDuration(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

export function coinsToUsdString(coins: number): string {
  return (Math.max(0, coins) / COINS_PER_USD).toFixed(2);
}
