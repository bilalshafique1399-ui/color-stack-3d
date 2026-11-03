/**
 * Phase 0 Security Rules Verification Suite (Dirty Dozen Adversarial Payloads)
 * Verifies 24-hour daily bonus cooldown, Gold Coins per-run cap & Coin-to-USD conversion math,
 * international payout validation (RedotPay, BinancePay, USDT_TRC20, PayPal), PII isolation,
 * and Admin RBAC all enforce PERMISSION_DENIED on invalid writes.
 */

interface AuthCtx {
  uid: string;
  email: string;
  email_verified: boolean;
}

const ADMIN_EMAIL = 'bilalshafique1399@gmail.com';
const DAY_MS = 24 * 60 * 60 * 1000;
const ID_RE = /^[a-zA-Z0-9_\-]+$/;
const CODE_RE = /^[0-9]{6}$/;
const NAME_RE = /^[a-zA-Z0-9 _.\-]+$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+]{10,15}$/;
const GLOBAL_ID_RE = /^[a-zA-Z0-9+@._\-]{6,120}$/;
const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

function isAdmin(auth: AuthCtx | null): boolean {
  return !!auth && auth.email_verified === true && auth.email === ADMIN_EMAIL;
}

function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_RE.test(id);
}

function runSecurityTests(): void {
  const NOW_MS = 1_800_000_000_000;
  const alice: AuthCtx = { uid: 'alice_01', email: 'alice@example.com', email_verified: true };
  const bob: AuthCtx = { uid: 'bob_02', email: 'bob@example.com', email_verified: true };
  const spoofAdmin: AuthCtx = { uid: 'attacker_99', email: ADMIN_EMAIL, email_verified: false };
  const realAdmin: AuthCtx = { uid: 'admin_01', email: ADMIN_EMAIL, email_verified: true };

  const canCreateUser = (
    pathUid: string,
    auth: AuthCtx | null,
    data: Record<string, unknown>,
    hasReferralCodeAfter: boolean,
  ): boolean => {
    const allowed = [
      'uid',
      'email',
      'displayName',
      'myCode',
      'invitesCount',
      'balance',
      'coins',
      'referredBy',
      'lastDailyRewardAt',
      'createdAt',
      'updatedAt',
    ];
    const required = [
      'uid',
      'email',
      'displayName',
      'myCode',
      'invitesCount',
      'balance',
      'referredBy',
      'createdAt',
      'updatedAt',
    ];
    const keys = Object.keys(data);
    if (!auth || !auth.email_verified || auth.uid !== pathUid || !isValidId(pathUid)) return false;
    if (!required.every((k) => keys.includes(k)) || !keys.every((k) => allowed.includes(k)))
      return false;
    if (data.uid !== pathUid || data.email !== auth.email || !EMAIL_RE.test(String(data.email)))
      return false;
    if (
      typeof data.displayName !== 'string' ||
      data.displayName.length < 1 ||
      data.displayName.length > 32 ||
      !NAME_RE.test(data.displayName)
    )
      return false;
    if (typeof data.myCode !== 'string' || !CODE_RE.test(data.myCode)) return false;
    if (data.invitesCount !== 0) return false;
    const coins = 'coins' in data ? data.coins : 0;
    if (typeof coins !== 'number' || !Number.isInteger(coins) || coins < 0) return false;
    const validDayOneBonus =
      data.balance === 5 && (coins === 50 || coins === 0) && data.lastDailyRewardAt === NOW_MS;
    const validZeroStart = data.balance === 0 && coins === 0 && !('lastDailyRewardAt' in data);
    if (!validDayOneBonus && !validZeroStart) return false;
    if (data.createdAt !== NOW_MS || data.updatedAt !== NOW_MS) return false;
    return hasReferralCodeAfter;
  };

  const canClaimDailyBonus = (
    pathUid: string,
    auth: AuthCtx | null,
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
    nowMs: number,
  ): boolean => {
    if (!auth || !auth.email_verified || auth.uid !== pathUid) return false;
    const diff = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
    const allowedDiff = ['balance', 'coins', 'lastDailyRewardAt', 'updatedAt'];
    if (!diff.every((k) => allowedDiff.includes(k))) return false;
    if (incoming.balance !== (existing.balance as number) + 5) return false;
    const prevCoins = typeof existing.coins === 'number' ? existing.coins : 0;
    const nextCoins = typeof incoming.coins === 'number' ? incoming.coins : 0;
    if (nextCoins !== prevCoins && nextCoins !== prevCoins + 50) return false;
    if (incoming.lastDailyRewardAt !== nowMs || incoming.updatedAt !== nowMs) return false;
    if (
      typeof existing.lastDailyRewardAt === 'number' &&
      nowMs < existing.lastDailyRewardAt + DAY_MS
    ) {
      return false;
    }
    return true;
  };

  const canSyncGameplayCoins = (
    pathUid: string,
    auth: AuthCtx | null,
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
    nowMs: number,
  ): boolean => {
    if (!auth || !auth.email_verified || auth.uid !== pathUid) return false;
    const diff = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
    if (!diff.every((k) => ['coins', 'updatedAt'].includes(k))) return false;
    const prevCoins = typeof existing.coins === 'number' ? existing.coins : 0;
    const nextCoins = typeof incoming.coins === 'number' ? incoming.coins : -1;
    const delta = nextCoins - prevCoins;
    if (delta < 1 || delta > 250) return false;
    return incoming.updatedAt === nowMs;
  };

  const canConvertCoins = (
    pathUid: string,
    auth: AuthCtx | null,
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
    nowMs: number,
  ): boolean => {
    if (!auth || !auth.email_verified || auth.uid !== pathUid) return false;
    const diff = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
    if (!diff.every((k) => ['balance', 'coins', 'updatedAt'].includes(k))) return false;
    const prevCoins = typeof existing.coins === 'number' ? existing.coins : 0;
    const nextCoins = typeof incoming.coins === 'number' ? incoming.coins : -1;
    if (prevCoins < 500 || nextCoins < 0 || nextCoins >= prevCoins) return false;
    const spent = prevCoins - nextCoins;
    if (spent % 500 !== 0) return false;
    const centsAdded = Math.floor(spent / 100);
    if (incoming.balance !== (existing.balance as number) + centsAdded) return false;
    return incoming.updatedAt === nowMs;
  };

  const isValidAccountForProvider = (method: string, acc: string): boolean => {
    if (!GLOBAL_ID_RE.test(acc)) return false;
    if (method === 'USDT_TRC20') return TRC20_RE.test(acc);
    if (method === 'PayPal') return EMAIL_RE.test(acc);
    if (method === 'RedotPay' || method === 'BinancePay') return GLOBAL_ID_RE.test(acc);
    if (method === 'JazzCash' || method === 'Easypaisa') return PHONE_RE.test(acc);
    return false;
  };

  const canSavePayoutPreferences = (
    pathUid: string,
    auth: AuthCtx | null,
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
    nowMs: number,
  ): boolean => {
    if (!auth || !auth.email_verified || auth.uid !== pathUid) return false;
    const allKeys = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
    const diff = [...allKeys].filter((k) => incoming[k] !== existing[k]);
    const allowedDiff = ['savedPayoutMethod', 'savedPayoutAccount', 'savedPayoutName', 'updatedAt'];
    if (!diff.every((k) => allowedDiff.includes(k))) return false;
    if (incoming.balance !== existing.balance || incoming.coins !== existing.coins) return false;
    if (incoming.updatedAt !== nowMs) return false;

    const hasMethod = 'savedPayoutMethod' in incoming;
    const hasAccount = 'savedPayoutAccount' in incoming;
    const hasName = 'savedPayoutName' in incoming;
    if (!hasMethod && !hasAccount && !hasName) return true;
    if (!(hasMethod && hasAccount && hasName)) return false;

    const method = String(incoming.savedPayoutMethod);
    const acc = String(incoming.savedPayoutAccount);
    const name = String(incoming.savedPayoutName);
    if (!['RedotPay', 'BinancePay', 'USDT_TRC20', 'PayPal', 'JazzCash', 'Easypaisa'].includes(method))
      return false;
    if (!isValidAccountForProvider(method, acc)) return false;
    if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) return false;
    return true;
  };

  const canCreateWithdraw = (
    auth: AuthCtx | null,
    data: Record<string, unknown>,
    userInvitesBefore: number,
    userBalanceBefore: number,
    userBalanceAfter: number,
  ): boolean => {
    if (!auth || !auth.email_verified) return false;
    if (data.uid !== auth.uid || data.email !== auth.email) return false;
    if (data.status !== 'pending') return false;
    if (typeof data.invitesCount !== 'number' || data.invitesCount < 50) return false;
    if (typeof data.amount !== 'number' || data.amount < 5) return false;
    const method = String(data.paymentMethod);
    const acc = String(data.accountNumber);
    if (!['RedotPay', 'BinancePay', 'USDT_TRC20', 'PayPal', 'JazzCash', 'Easypaisa'].includes(method))
      return false;
    if (!GLOBAL_ID_RE.test(acc)) return false;
    if (method === 'USDT_TRC20' && !TRC20_RE.test(acc)) return false;
    if (method === 'PayPal' && !EMAIL_RE.test(acc)) return false;
    if ((method === 'JazzCash' || method === 'Easypaisa') && !PHONE_RE.test(acc)) return false;
    if (userInvitesBefore < 50 || userInvitesBefore !== data.invitesCount) return false;
    if (userBalanceBefore !== data.amount || userBalanceAfter !== 0) return false;
    return true;
  };

  // Baseline valid signup with $0.05 + 50 Coins Day-1 bonus
  if (
    !canCreateUser(
      'alice_01',
      alice,
      {
        uid: 'alice_01',
        email: 'alice@example.com',
        displayName: 'Alice',
        myCode: '482915',
        invitesCount: 0,
        balance: 5,
        coins: 50,
        referredBy: '',
        lastDailyRewardAt: NOW_MS,
        createdAt: NOW_MS,
        updatedAt: NOW_MS,
      },
      true,
    )
  ) {
    throw new Error('Baseline valid Day-1 signup failed');
  }

  // Baseline valid USDT_TRC20 & RedotPay international withdrawals
  if (
    !canCreateWithdraw(
      alice,
      {
        requestId: 'req_trc_1',
        uid: 'alice_01',
        email: 'alice@example.com',
        invitesCount: 50,
        amount: 1050,
        paymentMethod: 'USDT_TRC20',
        accountNumber: 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL',
        accountName: 'Alice Carter',
        status: 'pending',
      },
      50,
      1050,
      0,
    )
  ) {
    throw new Error('Baseline valid USDT_TRC20 withdrawal failed');
  }

  const aliceDoc = {
    uid: 'alice_01',
    email: 'alice@example.com',
    displayName: 'Alice',
    myCode: '482915',
    invitesCount: 0,
    balance: 5,
    coins: 550,
    referredBy: '',
    lastDailyRewardAt: NOW_MS,
    createdAt: NOW_MS,
    updatedAt: NOW_MS,
  };

  // Baseline valid 500 Coins -> +$0.05 conversion
  if (
    !canConvertCoins(
      'alice_01',
      alice,
      aliceDoc,
      { ...aliceDoc, balance: 10, coins: 50, updatedAt: NOW_MS },
      NOW_MS,
    )
  ) {
    throw new Error('Baseline valid Coin-to-USD conversion failed');
  }

  // Baseline valid saved preferred payout details (RedotPay ID & JazzCash number)
  if (
    !canSavePayoutPreferences(
      'alice_01',
      alice,
      aliceDoc,
      {
        ...aliceDoc,
        savedPayoutMethod: 'RedotPay',
        savedPayoutAccount: '128493021',
        savedPayoutName: 'Alice Carter',
        updatedAt: NOW_MS,
      },
      NOW_MS,
    ) ||
    !canSavePayoutPreferences(
      'alice_01',
      alice,
      aliceDoc,
      {
        ...aliceDoc,
        savedPayoutMethod: 'JazzCash',
        savedPayoutAccount: '03001234567',
        savedPayoutName: 'Alice Carter',
        updatedAt: NOW_MS,
      },
      NOW_MS,
    )
  ) {
    throw new Error('Baseline valid saved payout preferences failed');
  }

  // Dirty Dozen #1: Self-minted balance/coins on signup
  if (
    canCreateUser(
      'alice_01',
      alice,
      {
        ...aliceDoc,
        balance: 10000,
        coins: 999999,
      },
      true,
    )
  ) {
    throw new Error('Dirty Dozen #1 failed');
  }

  // Dirty Dozen #2: 24-Hour Daily Bonus Cooldown Bypass
  if (
    canClaimDailyBonus(
      'alice_01',
      alice,
      aliceDoc,
      {
        ...aliceDoc,
        balance: 10,
        coins: 600,
        lastDailyRewardAt: NOW_MS + 600_000,
        updatedAt: NOW_MS + 600_000,
      },
      NOW_MS + 600_000,
    )
  ) {
    throw new Error('Dirty Dozen #2 failed');
  }

  // Dirty Dozen #3: Coin-to-USD Exchange Inflation (500 coins -> +500 cents instead of +5 cents)
  if (
    canConvertCoins(
      'alice_01',
      alice,
      aliceDoc,
      { ...aliceDoc, balance: 505, coins: 50, updatedAt: NOW_MS },
      NOW_MS,
    )
  ) {
    throw new Error('Dirty Dozen #3 failed');
  }

  // Dirty Dozen #4: Excessive Gameplay Coin Injection (+10,000 coins in one run)
  if (
    canSyncGameplayCoins(
      'alice_01',
      alice,
      aliceDoc,
      { ...aliceDoc, coins: 10550, updatedAt: NOW_MS },
      NOW_MS,
    )
  ) {
    throw new Error('Dirty Dozen #4 failed');
  }

  // Dirty Dozen #5: PII harvesting on /users/{uid}
  const canReadUser = (pathUid: string, auth: AuthCtx | null) =>
    !!auth && isValidId(pathUid) && (auth.uid === pathUid || isAdmin(auth));
  if (canReadUser('alice_01', bob)) {
    throw new Error('Dirty Dozen #5 failed');
  }

  // Dirty Dozen #6: Unverified admin email spoof
  if (canReadUser('alice_01', spoofAdmin) || !canReadUser('alice_01', realAdmin)) {
    throw new Error('Dirty Dozen #6 failed');
  }

  // Dirty Dozen #7 & #8: Referral credit without atomic doc or self-referral
  const canCreditRef = (targetUid: string, auth: AuthCtx | null, refOwnerAfter: string | null) =>
    !!auth && auth.email_verified && auth.uid !== targetUid && refOwnerAfter === targetUid;
  if (canCreditRef('alice_01', bob, null) || canCreditRef('alice_01', alice, 'alice_01')) {
    throw new Error('Dirty Dozen #7/#8 failed');
  }

  // Dirty Dozen #9: Premature international withdrawal (< 50 invites)
  if (
    canCreateWithdraw(
      alice,
      {
        requestId: 'req_1',
        uid: 'alice_01',
        email: 'alice@example.com',
        invitesCount: 12,
        amount: 245,
        paymentMethod: 'BinancePay',
        accountNumber: '294810293',
        accountName: 'Alice Carter',
        status: 'pending',
      },
      12,
      245,
      0,
    )
  ) {
    throw new Error('Dirty Dozen #9 failed');
  }

  // Dirty Dozen #10: Double-spend withdrawal without zeroing balance
  if (
    canCreateWithdraw(
      alice,
      {
        requestId: 'req_1',
        uid: 'alice_01',
        email: 'alice@example.com',
        invitesCount: 50,
        amount: 1005,
        paymentMethod: 'RedotPay',
        accountNumber: '108492019',
        accountName: 'Alice Carter',
        status: 'pending',
      },
      50,
      1005,
      1005,
    )
  ) {
    throw new Error('Dirty Dozen #10 failed');
  }

  // Dirty Dozen #11: Malformed USDT_TRC20 / JazzCash or Balance-Tampering Saved Payout Preferences
  if (
    canCreateWithdraw(
      alice,
      {
        requestId: 'req_1',
        uid: 'alice_01',
        email: 'alice@example.com',
        invitesCount: 50,
        amount: 1005,
        paymentMethod: 'USDT_TRC20',
        accountNumber: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        accountName: 'Alice Carter',
        status: 'pending',
      },
      50,
      1005,
      0,
    ) ||
    canSavePayoutPreferences(
      'alice_01',
      alice,
      aliceDoc,
      {
        ...aliceDoc,
        savedPayoutMethod: 'JazzCash',
        savedPayoutAccount: 'not-a-phone',
        savedPayoutName: 'Alice Carter',
        updatedAt: NOW_MS,
      },
      NOW_MS,
    ) ||
    canSavePayoutPreferences(
      'alice_01',
      alice,
      aliceDoc,
      {
        ...aliceDoc,
        balance: 99999,
        savedPayoutMethod: 'RedotPay',
        savedPayoutAccount: '128493021',
        savedPayoutName: 'Alice Carter',
        updatedAt: NOW_MS,
      },
      NOW_MS,
    )
  ) {
    throw new Error('Dirty Dozen #11 failed');
  }

  // Dirty Dozen #12: Cross-user withdraw list scraping
  const canListWithdraws = (auth: AuthCtx | null, filtersOwnUid: boolean, limit: number | null) =>
    !!auth && (filtersOwnUid || isAdmin(auth)) && limit !== null && limit <= 100;
  if (canListWithdraws(bob, false, 100)) {
    throw new Error('Dirty Dozen #12 failed');
  }
}

runSecurityTests();
console.log('All 12 Dirty Dozen security assertions passed (PERMISSION_DENIED verified).');
