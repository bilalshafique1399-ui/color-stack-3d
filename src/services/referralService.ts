import { Capacitor } from '@capacitor/core';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import blueprint from '../../firebase-blueprint.json';
import { auth, db } from '../firebase';
import {
  handleFirestoreError,
  OperationType,
  parseLeaderboardError,
  sanitizeDisplayName,
} from './globalLeaderboardService';

export const ADMIN_EMAIL = 'bilalshafique1399@gmail.com';
export const DAILY_REWARD_CENTS = 5; // $0.05 USD every 24 hours
export const DAILY_REWARD_COINS = 50; // +50 Gold Coins every 24 hours
export const REWARD_PER_INVITE_CENTS = 20; // $0.20 USD per verified invite ($10.00 at 50 invites)
export const REWARD_PER_INVITE_COINS = 100; // +100 Gold Coins per verified invite
export const COINS_PER_EXCHANGE_BUNDLE = 500; // 500 Gold Coins -> $0.05 USD
export const CENTS_PER_EXCHANGE_BUNDLE = 5;
export const MAX_GAMEPLAY_COINS_PER_RUN = 250;
export const MIN_INVITES_TO_WITHDRAW = 50;
export const MIN_WITHDRAW_CENTS = 5;
export const DAILY_REWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_BUFFER_MS = 5_000;

const PENDING_REF_STORAGE_KEY = 'color_stack_pending_ref_code_v1';
const LOCAL_COINS_STORAGE_KEY = 'color_stack_local_coins_v1';

// Validation Synchronicity: read exact field limits & patterns from firebase-blueprint.json
const userProps = blueprint.entities.UserProfile.properties;
const withdrawProps = blueprint.entities.WithdrawRequest.properties;

const UID_MAX_LEN = userProps.uid.maxLength;
const UID_REGEX = new RegExp(userProps.uid.pattern);
const CODE_REGEX = new RegExp(userProps.myCode.pattern);
const EMAIL_MAX_LEN = userProps.email.maxLength;
const EMAIL_REGEX = new RegExp(userProps.email.pattern);

const ACCOUNT_NUM_MIN_LEN = withdrawProps.accountNumber.minLength;
const ACCOUNT_NUM_MAX_LEN = withdrawProps.accountNumber.maxLength;
const ACCOUNT_NUM_REGEX = new RegExp(withdrawProps.accountNumber.pattern);
const TRC20_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const MOBILE_WALLET_REGEX = /^[0-9+]{10,15}$/;

const ACCOUNT_NAME_MIN_LEN = withdrawProps.accountName.minLength;
const ACCOUNT_NAME_MAX_LEN = withdrawProps.accountName.maxLength;
const ACCOUNT_NAME_REGEX = new RegExp(withdrawProps.accountName.pattern);

export type InternationalPaymentMethod = 'RedotPay' | 'BinancePay' | 'USDT_TRC20' | 'PayPal';
export type PaymentMethod = InternationalPaymentMethod | 'JazzCash' | 'Easypaisa';
export type WithdrawStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  myCode: string;
  invitesCount: number;
  balance: number; // Stored as integer USD cents (e.g. 5 = $0.05, 20 = $0.20)
  coins: number; // Collectible Gold Coins (500 Coins = $0.05 USD)
  referredBy: string;
  lastDailyRewardAtMs: number | null;
  savedPayoutMethod: PaymentMethod | null;
  savedPayoutAccount: string;
  savedPayoutName: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface InvitedFriendEntry {
  invitedUid: string;
  invitedName: string;
  referrerUid: string;
  referralCode: string;
  rewardCents: number;
  rewardCoins: number;
  createdAtMs: number;
}

export interface WithdrawRequestEntry {
  requestId: string;
  uid: string;
  email: string;
  invitesCount: number;
  amount: number; // Stored as integer USD cents
  paymentMethod: PaymentMethod;
  accountNumber: string;
  accountName: string;
  status: WithdrawStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DailyRewardStatus {
  canClaim: boolean;
  nextClaimAtMs: number | null;
  remainingMs: number;
}

export interface AuthBootstrapResult {
  profile: UserProfile | null;
  claimedDailyBonus: boolean;
  isNewSignup: boolean;
}

export function formatUsd(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.max(0, cents) : 0;
  return `$${(safeCents / 100).toFixed(2)}`;
}

export function formatCoins(coins: number): string {
  const safe = Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0;
  return safe.toLocaleString('en-US');
}

export function formatPaymentMethod(method: PaymentMethod): string {
  switch (method) {
    case 'BinancePay':
      return 'Binance Pay';
    case 'USDT_TRC20':
      return 'USDT (TRC20)';
    case 'PayPal':
      return 'PayPal';
    case 'RedotPay':
      return 'RedotPay';
    default:
      return method;
  }
}

export function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${minutes}m ${pad(seconds)}s`;
}

export function getLocalCoins(): number {
  try {
    const raw = Number(localStorage.getItem(LOCAL_COINS_STORAGE_KEY) ?? '0');
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  } catch {
    return 0;
  }
}

export function setLocalCoins(value: number): number {
  const safeVal = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  try {
    if (safeVal === 0) {
      localStorage.removeItem(LOCAL_COINS_STORAGE_KEY);
    } else {
      localStorage.setItem(LOCAL_COINS_STORAGE_KEY, String(safeVal));
    }
  } catch {
    // Ignore storage errors
  }
  return safeVal;
}

export function addLocalCoins(delta: number): number {
  const safeDelta = Math.max(0, Math.floor(delta));
  return setLocalCoins(getLocalCoins() + safeDelta);
}

export function clearLocalCoins(): void {
  setLocalCoins(0);
}

export async function copyTextWithFallback(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback for Android WebView
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function getDailyRewardStatus(
  profile: UserProfile | null,
  nowMs = Date.now(),
): DailyRewardStatus {
  if (!profile) {
    return { canClaim: false, nextClaimAtMs: null, remainingMs: 0 };
  }
  if (profile.lastDailyRewardAtMs === null) {
    return { canClaim: true, nextClaimAtMs: null, remainingMs: 0 };
  }
  const nextClaimAtMs =
    profile.lastDailyRewardAtMs + DAILY_REWARD_COOLDOWN_MS + CLOCK_SKEW_BUFFER_MS;
  const remainingMs = Math.max(0, nextClaimAtMs - nowMs);
  return {
    canClaim: remainingMs === 0,
    nextClaimAtMs,
    remainingMs,
  };
}

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (
    typeof val === 'object' &&
    val !== null &&
    'seconds' in val &&
    typeof (val as { seconds: unknown }).seconds === 'number'
  ) {
    return (val as { seconds: number }).seconds * 1000;
  }
  return Date.now();
}

function optionalTimestampToMs(val: unknown): number | null {
  if (val === undefined) {
    return null;
  }
  if (val === null) {
    return Date.now();
  }
  return timestampToMs(val);
}

export function isUserAdmin(user: User | null): boolean {
  return !!user && user.emailVerified === true && user.email === ADMIN_EMAIL;
}

export function capturePendingReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const rawRef = (params.get('ref') ?? '').trim();
    if (CODE_REGEX.test(rawRef)) {
      localStorage.setItem(PENDING_REF_STORAGE_KEY, rawRef);
      return rawRef;
    }
    return getPendingReferralCode();
  } catch {
    return null;
  }
}

export function getPendingReferralCode(): string | null {
  try {
    const stored = localStorage.getItem(PENDING_REF_STORAGE_KEY) ?? '';
    return CODE_REGEX.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function applyManualReferralCode(rawCode: string): string | null {
  const cleaned = rawCode.trim();
  if (!CODE_REGEX.test(cleaned)) {
    return null;
  }
  try {
    localStorage.setItem(PENDING_REF_STORAGE_KEY, cleaned);
  } catch {
    // Ignore storage restrictions
  }
  return cleaned;
}

export function clearPendingReferralCode(): void {
  try {
    localStorage.removeItem(PENDING_REF_STORAGE_KEY);
  } catch {
    // Ignore storage restrictions
  }
}

function generateSixDigitCode(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const num = 100000 + (arr[0] % 900000);
    return String(num);
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

function mapUserDoc(uid: string, data: Record<string, unknown>): UserProfile {
  const rawSavedMethod = data.savedPayoutMethod;
  const savedPayoutMethod: PaymentMethod | null =
    rawSavedMethod === 'RedotPay' ||
    rawSavedMethod === 'BinancePay' ||
    rawSavedMethod === 'USDT_TRC20' ||
    rawSavedMethod === 'PayPal' ||
    rawSavedMethod === 'JazzCash' ||
    rawSavedMethod === 'Easypaisa'
      ? rawSavedMethod
      : null;
  const savedPayoutAccount =
    savedPayoutMethod && typeof data.savedPayoutAccount === 'string'
      ? data.savedPayoutAccount
      : '';
  const savedPayoutName =
    savedPayoutMethod && typeof data.savedPayoutName === 'string' ? data.savedPayoutName : '';

  return {
    uid: typeof data.uid === 'string' ? data.uid : uid,
    email: typeof data.email === 'string' ? data.email : '',
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Player',
    myCode: typeof data.myCode === 'string' ? data.myCode : '000000',
    invitesCount:
      typeof data.invitesCount === 'number' ? Math.max(0, Math.floor(data.invitesCount)) : 0,
    balance: typeof data.balance === 'number' ? Math.max(0, Math.floor(data.balance)) : 0,
    coins: typeof data.coins === 'number' ? Math.max(0, Math.floor(data.coins)) : 0,
    referredBy: typeof data.referredBy === 'string' ? data.referredBy : '',
    lastDailyRewardAtMs: optionalTimestampToMs(data.lastDailyRewardAt),
    savedPayoutMethod: savedPayoutAccount && savedPayoutName ? savedPayoutMethod : null,
    savedPayoutAccount: savedPayoutAccount && savedPayoutName ? savedPayoutAccount : '',
    savedPayoutName: savedPayoutAccount && savedPayoutName ? savedPayoutName : '',
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function mapInvitedFriendDoc(
  invitedUid: string,
  data: Record<string, unknown>,
): InvitedFriendEntry {
  const rawCents =
    typeof data.rewardCents === 'number'
      ? Math.floor(data.rewardCents)
      : typeof data.rewardPkr === 'number'
        ? Math.floor(data.rewardPkr)
        : REWARD_PER_INVITE_CENTS;
  const rawCoins =
    typeof data.rewardCoins === 'number' ? Math.floor(data.rewardCoins) : 0;

  return {
    invitedUid: typeof data.invitedUid === 'string' ? data.invitedUid : invitedUid,
    invitedName: typeof data.invitedName === 'string' ? data.invitedName : 'Player',
    referrerUid: typeof data.referrerUid === 'string' ? data.referrerUid : '',
    referralCode: typeof data.referralCode === 'string' ? data.referralCode : '',
    rewardCents: Math.max(0, rawCents),
    rewardCoins: Math.max(0, rawCoins),
    createdAtMs: timestampToMs(data.createdAt),
  };
}

function mapWithdrawDoc(id: string, data: Record<string, unknown>): WithdrawRequestEntry {
  const rawMethod = data.paymentMethod;
  const paymentMethod: PaymentMethod =
    rawMethod === 'RedotPay' ||
    rawMethod === 'BinancePay' ||
    rawMethod === 'USDT_TRC20' ||
    rawMethod === 'PayPal' ||
    rawMethod === 'Easypaisa' ||
    rawMethod === 'JazzCash'
      ? rawMethod
      : 'RedotPay';
  const rawStatus = data.status;
  const status: WithdrawStatus =
    rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending';

  return {
    requestId: typeof data.requestId === 'string' ? data.requestId : id,
    uid: typeof data.uid === 'string' ? data.uid : '',
    email: typeof data.email === 'string' ? data.email : '',
    invitesCount:
      typeof data.invitesCount === 'number' ? Math.max(0, Math.floor(data.invitesCount)) : 0,
    amount: typeof data.amount === 'number' ? Math.max(0, Math.floor(data.amount)) : 0,
    paymentMethod,
    accountNumber: typeof data.accountNumber === 'string' ? data.accountNumber : '',
    accountName: typeof data.accountName === 'string' ? data.accountName : '',
    status,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

const inFlightBootstrapByUid = new Map<string, Promise<AuthBootstrapResult>>();

/**
 * Ensures the signed-in Google user exists in Firestore `users/{uid}` and grants
 * the 24-hour Daily Sign-In Bonus (+$0.05 USD + 50 Gold Coins) when eligible.
 */
export async function ensureUserProfileOnAuth(user: User): Promise<AuthBootstrapResult> {
  const existingTask = inFlightBootstrapByUid.get(user.uid);
  if (existingTask) {
    return existingTask;
  }

  const task = ensureUserProfileOnAuthInternal(user).finally(() => {
    inFlightBootstrapByUid.delete(user.uid);
  });
  inFlightBootstrapByUid.set(user.uid, task);
  return task;
}

async function ensureUserProfileOnAuthInternal(user: User): Promise<AuthBootstrapResult> {
  if (
    !user.email ||
    !user.emailVerified ||
    user.uid.length > UID_MAX_LEN ||
    !UID_REGEX.test(user.uid) ||
    user.email.length > EMAIL_MAX_LEN ||
    !EMAIL_REGEX.test(user.email)
  ) {
    return { profile: null, claimedDailyBonus: false, isNewSignup: false };
  }

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (existingSnap.exists()) {
    clearPendingReferralCode();
    const existingProfile = mapUserDoc(existingSnap.id, existingSnap.data());
    const dailyStatus = getDailyRewardStatus(existingProfile);

    if (dailyStatus.canClaim) {
      try {
        await updateDoc(userRef, {
          balance: increment(DAILY_REWARD_CENTS),
          coins: increment(DAILY_REWARD_COINS),
          lastDailyRewardAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const now = Date.now();
        return {
          profile: {
            ...existingProfile,
            balance: existingProfile.balance + DAILY_REWARD_CENTS,
            coins: existingProfile.coins + DAILY_REWARD_COINS,
            lastDailyRewardAtMs: now,
            updatedAtMs: now,
          },
          claimedDailyBonus: true,
          isNewSignup: false,
        };
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    }

    return {
      profile: existingProfile,
      claimedDailyBonus: false,
      isNewSignup: false,
    };
  }

  const displayName = sanitizeDisplayName(user.displayName || user.email.split('@')[0]);

  // 1. Allocate a unique 6-digit referral code
  let myCode = generateSixDigitCode();
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateSixDigitCode();
    const codePath = `referralCodes/${candidate}`;
    try {
      const codeSnap = await getDoc(doc(db, 'referralCodes', candidate));
      if (!codeSnap.exists()) {
        myCode = candidate;
        break;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, codePath);
    }
  }

  // 2. Check pending ?ref=CODE on signup
  const pendingRefCode = getPendingReferralCode();
  let validReferrerUid: string | null = null;
  let validReferredBy = '';

  if (pendingRefCode && CODE_REGEX.test(pendingRefCode) && pendingRefCode !== myCode) {
    const refLookupPath = `referralCodes/${pendingRefCode}`;
    try {
      const refSnap = await getDoc(doc(db, 'referralCodes', pendingRefCode));
      if (refSnap.exists()) {
        const refData = refSnap.data();
        const ownerUid = typeof refData.ownerUid === 'string' ? refData.ownerUid : '';
        if (ownerUid && ownerUid !== user.uid && UID_REGEX.test(ownerUid)) {
          validReferrerUid = ownerUid;
          validReferredBy = pendingRefCode;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, refLookupPath);
    }
  }

  // 3. Commit atomic signup + Day-1 ($0.05 + 50 Coins) + optional referral ($0.20 + 100 Coins)
  const batch = writeBatch(db);

  batch.set(userRef, {
    uid: user.uid,
    email: user.email,
    displayName,
    myCode,
    invitesCount: 0,
    balance: DAILY_REWARD_CENTS,
    coins: DAILY_REWARD_COINS,
    referredBy: validReferredBy,
    lastDailyRewardAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'referralCodes', myCode), {
    code: myCode,
    ownerUid: user.uid,
    ownerName: displayName,
    createdAt: serverTimestamp(),
  });

  if (validReferrerUid && validReferredBy) {
    batch.set(doc(db, 'referrals', user.uid), {
      invitedUid: user.uid,
      invitedName: displayName,
      referrerUid: validReferrerUid,
      referralCode: validReferredBy,
      rewardCents: REWARD_PER_INVITE_CENTS,
      rewardCoins: REWARD_PER_INVITE_COINS,
      createdAt: serverTimestamp(),
    });

    batch.update(doc(db, 'users', validReferrerUid), {
      invitesCount: increment(1),
      balance: increment(REWARD_PER_INVITE_CENTS),
      coins: increment(REWARD_PER_INVITE_COINS),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  clearPendingReferralCode();

  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (url.searchParams.has('ref')) {
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  const now = Date.now();
  return {
    profile: {
      uid: user.uid,
      email: user.email,
      displayName,
      myCode,
      invitesCount: 0,
      balance: DAILY_REWARD_CENTS,
      coins: DAILY_REWARD_COINS,
      referredBy: validReferredBy,
      lastDailyRewardAtMs: now,
      savedPayoutMethod: null,
      savedPayoutAccount: '',
      savedPayoutName: '',
      createdAtMs: now,
      updatedAtMs: now,
    },
    claimedDailyBonus: true,
    isNewSignup: true,
  };
}

/**
 * Claims the +$0.05 USD + 50 Gold Coins 24-hour daily reward manually.
 */
export async function claimDailyBonus(profile: UserProfile): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || user.uid !== profile.uid) {
    throw new Error('Please sign in with a verified Google account first.');
  }

  const status = getDailyRewardStatus(profile);
  if (!status.canClaim) {
    return false;
  }

  const userPath = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      balance: increment(DAILY_REWARD_CENTS),
      coins: increment(DAILY_REWARD_COINS),
      lastDailyRewardAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

/**
 * Credits earned 3D Gameplay Gold Coins to the signed-in user's Firestore profile
 * (respecting the 1..250 per-run rule cap and 2s write-rate cooldown, with 1 retry).
 */
export async function syncGameplayCoinsToCloud(
  rawCoins: number,
  lastUpdatedAtMs = 0,
): Promise<number> {
  const user = auth.currentUser;
  const clamped = Math.min(MAX_GAMEPLAY_COINS_PER_RUN, Math.max(0, Math.floor(rawCoins)));
  if (!user || !user.emailVerified || clamped < 1) {
    return 0;
  }

  const elapsedMs = Date.now() - lastUpdatedAtMs;
  if (lastUpdatedAtMs > 0 && elapsedMs < 2600) {
    await new Promise((resolve) => window.setTimeout(resolve, 2600 - elapsedMs));
  }

  const userPath = `users/${user.uid}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        coins: increment(clamped),
        updatedAt: serverTimestamp(),
      });
      return clamped;
    } catch (error) {
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        continue;
      }
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }
  return 0;
}

let flushingGuestCoinsPromise: Promise<number> | null = null;

/**
 * Safely flushes locally stored guest coins to Firestore in <=250 chunks,
 * deducting from localStorage ONLY after each cloud batch succeeds.
 */
export async function flushGuestCoinsToCloud(
  initialLastUpdatedAtMs = 0,
  onLocalRemainingChange?: (remaining: number) => void,
): Promise<number> {
  if (flushingGuestCoinsPromise) {
    return flushingGuestCoinsPromise;
  }

  flushingGuestCoinsPromise = (async () => {
    let totalCredited = 0;
    let lastWriteMs = initialLastUpdatedAtMs;

    while (auth.currentUser && getLocalCoins() > 0) {
      const pending = getLocalCoins();
      const batchSize = Math.min(MAX_GAMEPLAY_COINS_PER_RUN, pending);
      const credited = await syncGameplayCoinsToCloud(batchSize, lastWriteMs);
      if (credited <= 0) break;

      totalCredited += credited;
      lastWriteMs = Date.now();
      const remaining = setLocalCoins(Math.max(0, getLocalCoins() - credited));
      onLocalRemainingChange?.(remaining);
    }

    return totalCredited;
  })().finally(() => {
    flushingGuestCoinsPromise = null;
  });

  return flushingGuestCoinsPromise;
}

/**
 * Atomically exchanges all full 500-Coin bundles in the user's wallet into USD cents
 * (500 Gold Coins = +$0.05 USD / 5 cents).
 */
export async function convertCoinsToUsd(
  profile: UserProfile,
): Promise<{ coinsSpent: number; centsAdded: number }> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || user.uid !== profile.uid) {
    throw new Error('Please sign in with a verified Google account first.');
  }

  const bundles = Math.floor(profile.coins / COINS_PER_EXCHANGE_BUNDLE);
  if (bundles < 1) {
    throw new Error(`Collect at least ${COINS_PER_EXCHANGE_BUNDLE} Coins to convert to USD.`);
  }

  const coinsSpent = bundles * COINS_PER_EXCHANGE_BUNDLE;
  const centsAdded = bundles * CENTS_PER_EXCHANGE_BUNDLE;
  const userPath = `users/${user.uid}`;

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      coins: increment(-coinsSpent),
      balance: increment(centsAdded),
      updatedAt: serverTimestamp(),
    });
    return { coinsSpent, centsAdded };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export function subscribeUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile | null) => void,
  onError: (friendlyError: string) => void,
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(mapUserDoc(snap.id, snap.data()));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (formatted) {
        onError(parseLeaderboardError(formatted));
      }
    },
  );
}

export function subscribeInvitedFriends(
  uid: string,
  onUpdate: (friends: InvitedFriendEntry[]) => void,
  onError: (friendlyError: string) => void,
): Unsubscribe {
  const q = query(collection(db, 'referrals'), where('referrerUid', '==', uid), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list: InvitedFriendEntry[] = [];
      snap.forEach((docSnap) => {
        list.push(mapInvitedFriendDoc(docSnap.id, docSnap.data()));
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'referrals');
      } catch (formatted) {
        onError(parseLeaderboardError(formatted));
      }
    },
  );
}

export function subscribeUserWithdrawRequests(
  uid: string,
  onUpdate: (requests: WithdrawRequestEntry[]) => void,
  onError: (friendlyError: string) => void,
): Unsubscribe {
  const q = query(collection(db, 'withdrawRequests'), where('uid', '==', uid), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const list: WithdrawRequestEntry[] = [];
      snap.forEach((docSnap) => {
        list.push(mapWithdrawDoc(docSnap.id, docSnap.data()));
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'withdrawRequests');
      } catch (formatted) {
        onError(parseLeaderboardError(formatted));
      }
    },
  );
}

function validateAndNormalizePayoutInput(params: {
  paymentMethod: PaymentMethod;
  accountNumber: string;
  accountName: string;
}): { normalizedAccount: string; normalizedName: string } {
  const normalizedAccount = params.accountNumber.trim();
  if (
    normalizedAccount.length < ACCOUNT_NUM_MIN_LEN ||
    normalizedAccount.length > ACCOUNT_NUM_MAX_LEN ||
    !ACCOUNT_NUM_REGEX.test(normalizedAccount)
  ) {
    throw new Error('Enter a valid payout account ID, email, number, or wallet address (no spaces).');
  }

  if (params.paymentMethod === 'USDT_TRC20') {
    if (!TRC20_REGEX.test(normalizedAccount)) {
      throw new Error(
        'Enter a valid 34-character TRON USDT (TRC20) wallet address starting with T.',
      );
    }
  } else if (params.paymentMethod === 'PayPal') {
    if (!EMAIL_REGEX.test(normalizedAccount)) {
      throw new Error('Enter a valid PayPal email address.');
    }
  } else if (params.paymentMethod === 'JazzCash' || params.paymentMethod === 'Easypaisa') {
    if (!MOBILE_WALLET_REGEX.test(normalizedAccount)) {
      throw new Error(
        `Enter a valid ${params.paymentMethod} mobile number (10 to 15 digits, e.g. 03001234567).`,
      );
    }
  }

  const normalizedName = params.accountName
    .replace(/[^a-zA-Z0-9 _.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ACCOUNT_NAME_MAX_LEN)
    .trim();

  if (
    normalizedName.length < ACCOUNT_NAME_MIN_LEN ||
    !ACCOUNT_NAME_REGEX.test(normalizedName)
  ) {
    throw new Error('Enter the account holder full name (2 to 60 letters).');
  }

  return { normalizedAccount, normalizedName };
}

export async function savePreferredPayoutDetails(params: {
  profile: UserProfile;
  paymentMethod: PaymentMethod;
  accountNumber: string;
  accountName: string;
}): Promise<{ normalizedAccount: string; normalizedName: string }> {
  const user = auth.currentUser;
  if (!user || !user.email || !user.emailVerified || user.uid !== params.profile.uid) {
    throw new Error('Please sign in with a verified Google account first.');
  }

  const { normalizedAccount, normalizedName } = validateAndNormalizePayoutInput(params);
  const userPath = `users/${user.uid}`;

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      savedPayoutMethod: params.paymentMethod,
      savedPayoutAccount: normalizedAccount,
      savedPayoutName: normalizedName,
      updatedAt: serverTimestamp(),
    });
    return { normalizedAccount, normalizedName };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function clearPreferredPayoutDetails(profile: UserProfile): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email || !user.emailVerified || user.uid !== profile.uid) {
    throw new Error('Please sign in with a verified Google account first.');
  }

  const userPath = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      savedPayoutMethod: deleteField(),
      savedPayoutAccount: deleteField(),
      savedPayoutName: deleteField(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function submitWithdrawRequest(params: {
  profile: UserProfile;
  paymentMethod: PaymentMethod;
  accountNumber: string;
  accountName: string;
  saveToProfile?: boolean;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email || !user.emailVerified || user.uid !== params.profile.uid) {
    throw new Error('Please sign in with a verified Google account first.');
  }

  if (params.profile.invitesCount < MIN_INVITES_TO_WITHDRAW) {
    throw new Error(`You need at least ${MIN_INVITES_TO_WITHDRAW} invites to withdraw.`);
  }

  if (params.profile.balance < MIN_WITHDRAW_CENTS) {
    throw new Error('Your current withdrawable balance is $0.00.');
  }

  const { normalizedAccount, normalizedName } = validateAndNormalizePayoutInput(params);

  const reqDocRef = doc(collection(db, 'withdrawRequests'));
  const reqId = reqDocRef.id;
  const reqPath = `withdrawRequests/${reqId}`;

  const batch = writeBatch(db);
  batch.set(reqDocRef, {
    requestId: reqId,
    uid: user.uid,
    email: user.email,
    invitesCount: params.profile.invitesCount,
    amount: params.profile.balance,
    paymentMethod: params.paymentMethod,
    accountNumber: normalizedAccount,
    accountName: normalizedName,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (params.saveToProfile !== false) {
    batch.update(doc(db, 'users', user.uid), {
      balance: 0,
      savedPayoutMethod: params.paymentMethod,
      savedPayoutAccount: normalizedAccount,
      savedPayoutName: normalizedName,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(doc(db, 'users', user.uid), {
      balance: 0,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, reqPath);
  }
}

export function subscribeAllWithdrawRequests(
  onUpdate: (requests: WithdrawRequestEntry[]) => void,
  onError: (friendlyError: string) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'withdrawRequests'),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: WithdrawRequestEntry[] = [];
      snap.forEach((docSnap) => {
        list.push(mapWithdrawDoc(docSnap.id, docSnap.data()));
      });
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'withdrawRequests');
      } catch (formatted) {
        onError(parseLeaderboardError(formatted));
      }
    },
  );
}

export async function reviewWithdrawRequest(
  entry: WithdrawRequestEntry,
  nextStatus: 'approved' | 'rejected',
): Promise<void> {
  const reqPath = `withdrawRequests/${entry.requestId}`;
  const batch = writeBatch(db);

  batch.update(doc(db, 'withdrawRequests', entry.requestId), {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });

  if (entry.status === 'pending' && nextStatus === 'rejected' && entry.amount > 0) {
    batch.update(doc(db, 'users', entry.uid), {
      balance: increment(entry.amount),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reqPath);
  }
}

export function buildReferralLink(myCode: string): string {
  const configuredOrigin = (import.meta.env.VITE_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');
  if (configuredOrigin) {
    return `${configuredOrigin}/?ref=${myCode}`;
  }
  if (typeof window === 'undefined') {
    return myCode;
  }
  const host = window.location.hostname;
  if (
    Capacitor.isNativePlatform() ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:'
  ) {
    // Inside native Android WebView (https://localhost), avoid broken localhost links
    // and return the universal 6-digit invite code directly unless VITE_PUBLIC_APP_URL is set.
    return myCode;
  }
  return `${window.location.origin}/?ref=${myCode}`;
}
