import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookmarkCheck,
  CheckCircle2,
  Lock,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  clearPreferredPayoutDetails,
  formatCoins,
  formatPaymentMethod,
  formatUsd,
  MIN_INVITES_TO_WITHDRAW,
  MIN_WITHDRAW_CENTS,
  PaymentMethod,
  savePreferredPayoutDetails,
  submitWithdrawRequest,
  UserProfile,
  WithdrawRequestEntry,
} from '../services/referralService';
import { parseLeaderboardError } from '../services/globalLeaderboardService';
import { formatScoreDate } from '../services/highScoreService';
import { soundEngine } from '../audio/soundEngine';

interface WithdrawPageProps {
  user: User | null;
  profile: UserProfile | null;
  requests: WithdrawRequestEntry[];
  onBackToEarn: () => void;
  onGoogleLogin: () => Promise<void>;
}

const PAYOUT_METHODS: readonly {
  id: PaymentMethod;
  label: string;
  fieldLabel: string;
  placeholder: string;
  hint: string;
  inputMode: 'email' | 'text' | 'tel';
  minLength: number;
  maxLength: number;
}[] = [
  {
    id: 'RedotPay',
    label: 'RedotPay',
    fieldLabel: 'RedotPay UID or Registered Email',
    placeholder: 'e.g. 128493021 or name@email.com',
    hint: 'Instant global USD transfer via your RedotPay User ID (UID), email, or linked phone.',
    inputMode: 'email',
    minLength: 6,
    maxLength: 120,
  },
  {
    id: 'BinancePay',
    label: 'Binance Pay',
    fieldLabel: 'Binance Pay ID / UID or Email',
    placeholder: 'e.g. 294810293 or binance@email.com',
    hint: 'Zero-fee worldwide USDT transfer via Binance Pay ID, Binance UID, or registered email.',
    inputMode: 'email',
    minLength: 6,
    maxLength: 120,
  },
  {
    id: 'USDT_TRC20',
    label: 'USDT (TRC20)',
    fieldLabel: 'TRON USDT (TRC20) Wallet Address',
    placeholder: 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL',
    hint: 'Enter your 34-character TRON network (TRC20) address starting with T.',
    inputMode: 'text',
    minLength: 34,
    maxLength: 34,
  },
  {
    id: 'PayPal',
    label: 'PayPal',
    fieldLabel: 'PayPal Account Email',
    placeholder: 'name@example.com',
    hint: 'Enter your verified international PayPal email address to receive USD.',
    inputMode: 'email',
    minLength: 6,
    maxLength: 120,
  },
  {
    id: 'JazzCash',
    label: 'JazzCash',
    fieldLabel: 'JazzCash Mobile Account Number',
    placeholder: '03001234567',
    hint: 'Enter your 11-digit JazzCash mobile wallet number (or international +92 format).',
    inputMode: 'tel',
    minLength: 10,
    maxLength: 15,
  },
  {
    id: 'Easypaisa',
    label: 'Easypaisa',
    fieldLabel: 'Easypaisa Mobile Account Number',
    placeholder: '03451234567',
    hint: 'Enter your 11-digit Easypaisa mobile wallet number (or international +92 format).',
    inputMode: 'tel',
    minLength: 10,
    maxLength: 15,
  },
];

function extractFriendlyError(err: unknown): string {
  return err instanceof Error && !err.message.startsWith('{')
    ? err.message
    : parseLeaderboardError(err);
}

export const WithdrawPage: React.FC<WithdrawPageProps> = ({
  user,
  profile,
  requests,
  onBackToEarn,
  onGoogleLogin,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    () => profile?.savedPayoutMethod ?? 'RedotPay',
  );
  const [accountNumber, setAccountNumber] = useState(
    () => profile?.savedPayoutAccount ?? '',
  );
  const [accountName, setAccountName] = useState(() => profile?.savedPayoutName ?? '');
  const [saveOnSubmit, setSaveOnSubmit] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [clearingPrefs, setClearingPrefs] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const hydratedSignatureRef = useRef<string>('');
  const lastProfileUidRef = useRef<string | null>(profile?.uid ?? null);

  // Reset form state cleanly if user signs out or switches Google accounts
  useEffect(() => {
    const nextUid = profile?.uid ?? null;
    if (lastProfileUidRef.current !== nextUid) {
      lastProfileUidRef.current = nextUid;
      hydratedSignatureRef.current = '';
      setPaymentMethod(profile?.savedPayoutMethod ?? 'RedotPay');
      setAccountNumber(profile?.savedPayoutAccount ?? '');
      setAccountName(profile?.savedPayoutName ?? '');
      setIsDirty(false);
      setFormError(null);
      setSavedNotice(null);
      setSubmittedSuccess(false);
    }
  }, [
    profile?.uid,
    profile?.savedPayoutMethod,
    profile?.savedPayoutAccount,
    profile?.savedPayoutName,
  ]);

  // Auto-populate form fields from profile's saved withdrawal preferences when loaded/updated
  useEffect(() => {
    if (!profile?.savedPayoutMethod || !profile.savedPayoutAccount || !profile.savedPayoutName) {
      return;
    }
    const nextSig = `${profile.uid}|${profile.savedPayoutMethod}|${profile.savedPayoutAccount}|${profile.savedPayoutName}`;
    if (hydratedSignatureRef.current !== nextSig && !isDirty) {
      hydratedSignatureRef.current = nextSig;
      setPaymentMethod(profile.savedPayoutMethod);
      setAccountNumber(profile.savedPayoutAccount);
      setAccountName(profile.savedPayoutName);
    }
  }, [
    isDirty,
    profile?.uid,
    profile?.savedPayoutMethod,
    profile?.savedPayoutAccount,
    profile?.savedPayoutName,
  ]);

  const invitesCount = profile?.invitesCount ?? 0;
  const balance = profile?.balance ?? 0;
  const coins = profile?.coins ?? 0;
  const isUnlocked = invitesCount >= MIN_INVITES_TO_WITHDRAW;

  const hasSavedDetails = Boolean(
    profile?.savedPayoutMethod && profile.savedPayoutAccount && profile.savedPayoutName,
  );

  const matchesSavedDetails =
    hasSavedDetails &&
    profile?.savedPayoutMethod === paymentMethod &&
    profile?.savedPayoutAccount === accountNumber.trim() &&
    profile?.savedPayoutName === accountName.trim();

  const activeMethodMeta =
    PAYOUT_METHODS.find((m) => m.id === paymentMethod) ?? PAYOUT_METHODS[0];

  const handleLoadSaved = () => {
    if (!profile?.savedPayoutMethod) return;
    soundEngine.playClick();
    setPaymentMethod(profile.savedPayoutMethod);
    setAccountNumber(profile.savedPayoutAccount);
    setAccountName(profile.savedPayoutName);
    setIsDirty(false);
    setFormError(null);
    setSavedNotice('Loaded your saved payout details from profile.');
  };

  const handleSaveDetailsOnly = async () => {
    if (!profile || savingPrefs || clearingPrefs || submitting) return;
    soundEngine.playClick();
    setFormError(null);
    setSavedNotice(null);
    setSavingPrefs(true);

    try {
      const { normalizedAccount, normalizedName } = await savePreferredPayoutDetails({
        profile,
        paymentMethod,
        accountNumber,
        accountName,
      });
      setAccountNumber(normalizedAccount);
      setAccountName(normalizedName);
      setIsDirty(false);
      setSavedNotice(
        `Saved ${formatPaymentMethod(paymentMethod)} details to your profile for future withdrawals.`,
      );
    } catch (err) {
      setFormError(extractFriendlyError(err));
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleClearSavedDetails = async () => {
    if (!profile || !hasSavedDetails || clearingPrefs || savingPrefs || submitting) return;
    soundEngine.playClick();
    setFormError(null);
    setSavedNotice(null);
    setClearingPrefs(true);

    try {
      await clearPreferredPayoutDetails(profile);
      hydratedSignatureRef.current = '';
      setAccountNumber('');
      setAccountName('');
      setIsDirty(false);
      setSavedNotice('Cleared saved withdrawal details from your profile.');
    } catch (err) {
      setFormError(extractFriendlyError(err));
    } finally {
      setClearingPrefs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isUnlocked || balance < MIN_WITHDRAW_CENTS || submitting) return;

    soundEngine.playClick();
    setFormError(null);
    setSavedNotice(null);
    setSubmittedSuccess(false);
    setSubmitting(true);

    try {
      await submitWithdrawRequest({
        profile,
        paymentMethod,
        accountNumber,
        accountName,
        saveToProfile: saveOnSubmit,
      });
      setSubmittedSuccess(true);
      setIsDirty(false);
      if (!saveOnSubmit && !hasSavedDetails) {
        setAccountNumber('');
        setAccountName('');
      }
    } catch (err) {
      setFormError(extractFriendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const renderPayoutFields = () => (
    <div className="space-y-4">
      {/* Saved Profile Summary Strip */}
      {hasSavedDetails && profile?.savedPayoutMethod && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 min-w-0 text-emerald-100">
            <BookmarkCheck className="h-4 w-4 shrink-0 text-emerald-300" />
            <span className="truncate tabular-nums">
              Saved · <strong>{formatPaymentMethod(profile.savedPayoutMethod)}</strong> ·{' '}
              <span className="font-mono">{profile.savedPayoutAccount}</span> ·{' '}
              {profile.savedPayoutName}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!matchesSavedDetails && (
              <button
                type="button"
                onClick={handleLoadSaved}
                className="inline-flex min-h-[36px] items-center gap-1 font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                <span>Use Saved</span>
              </button>
            )}
            <button
              type="button"
              disabled={clearingPrefs}
              onClick={() => void handleClearSavedDetails()}
              className="inline-flex min-h-[36px] items-center gap-1 font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-50 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span>{clearingPrefs ? 'Clearing...' : 'Remove'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Payout Method Selector (Global & Mobile Wallets) */}
      <div>
        <span className="block text-xs font-semibold text-slate-300">
          Select Payout Method
        </span>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-[#0D1021] p-1 sm:grid-cols-3">
          {PAYOUT_METHODS.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setPaymentMethod(method.id);
                setIsDirty(true);
                setFormError(null);
                setSavedNotice(null);
              }}
              className={`flex min-h-[44px] items-center justify-center rounded-lg px-2.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                paymentMethod === method.id
                  ? 'bg-white text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {method.label}
            </button>
          ))}
        </div>
      </div>

      {/* Adaptive Account ID / Wallet Address / Mobile Number Input */}
      <div>
        <label
          htmlFor="wallet-number"
          className="block text-xs font-semibold text-slate-300"
        >
          {activeMethodMeta.fieldLabel}
        </label>
        <input
          id="wallet-number"
          type="text"
          inputMode={activeMethodMeta.inputMode}
          required
          minLength={activeMethodMeta.minLength}
          maxLength={activeMethodMeta.maxLength}
          placeholder={activeMethodMeta.placeholder}
          value={accountNumber}
          onChange={(e) => {
            setAccountNumber(e.target.value);
            setIsDirty(true);
            setSavedNotice(null);
          }}
          className="mt-1.5 min-h-[48px] w-full rounded-xl border border-white/15 bg-[#0D1021] px-4 py-2.5 font-mono text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none tabular-nums"
        />
        <p className="mt-1 text-xs text-slate-400">{activeMethodMeta.hint}</p>
      </div>

      {/* Account Holder Name */}
      <div>
        <label
          htmlFor="wallet-holder-name"
          className="block text-xs font-semibold text-slate-300"
        >
          Account Holder Full Name
        </label>
        <input
          id="wallet-holder-name"
          type="text"
          required
          minLength={2}
          maxLength={60}
          placeholder="Enter full name on account"
          value={accountName}
          onChange={(e) => {
            setAccountName(e.target.value);
            setIsDirty(true);
            setSavedNotice(null);
          }}
          className="mt-1.5 min-h-[48px] w-full rounded-xl border border-white/15 bg-[#0D1021] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#0F1326] text-white">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0F1326]/95 px-4 sm:px-6">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBackToEarn();
            }}
            className="flex min-h-[44px] items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to Rewards</span>
          </button>

          <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
            Global USD Payout
          </span>

          <div className="w-10 shrink-0" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {!user ? (
          <div className="rounded-3xl border border-white/15 bg-[#161B36] p-6 text-center">
            <h1 className="font-display text-2xl font-extrabold text-white">
              Sign in Required
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Sign in with Google to save your preferred payout details and request USD withdrawals.
            </p>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                void onGoogleLogin();
              }}
              className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-white px-6 py-3 font-display text-sm font-extrabold text-slate-950 whitespace-nowrap"
            >
              Continue with Google
            </button>
          </div>
        ) : !isUnlocked ? (
          <>
            {/* Locked Progress Banner when invitesCount < 50 */}
            <section className="rounded-3xl border border-white/15 bg-[#161B36] p-6 sm:p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-amber-300">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold text-white [text-wrap:balance]">
                Withdrawals Unlock at {MIN_INVITES_TO_WITHDRAW} Invites
              </h1>
              <p className="mt-2 text-sm text-slate-300 tabular-nums">
                You currently have{' '}
                <strong>
                  {invitesCount} / {MIN_INVITES_TO_WITHDRAW} Invites
                </strong>
                , <strong>{formatUsd(balance)} USD</strong>, and{' '}
                <strong>{formatCoins(coins)} Coins</strong>. Invite{' '}
                {MIN_INVITES_TO_WITHDRAW - invitesCount} more friend
                {MIN_INVITES_TO_WITHDRAW - invitesCount === 1 ? '' : 's'} to submit payout requests.
              </p>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onBackToEarn();
                }}
                className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-white px-6 py-3 font-display text-sm font-extrabold text-slate-950 hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                Return to Rewards &amp; Coins
              </button>
            </section>

            {/* Pre-Save Preferred Payout Details Card (available anytime!) */}
            <section className="rounded-3xl border border-white/15 bg-[#161B36] p-5 sm:p-7">
              <div className="border-b border-white/10 pb-4">
                <h2 className="font-display text-lg sm:text-xl font-extrabold text-white">
                  Preferred Withdrawal Details
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-300">
                  Save your RedotPay ID, Binance Pay, USDT (TRC20), PayPal, JazzCash, or Easypaisa details in your profile now so they auto-fill as soon as withdrawals unlock.
                </p>
              </div>

              {savedNotice && (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{savedNotice}</span>
                </div>
              )}

              {formError && (
                <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                  {formError}
                </div>
              )}

              <div className="mt-5">
                {renderPayoutFields()}

                <button
                  type="button"
                  disabled={savingPrefs || matchesSavedDetails || !accountNumber.trim() || !accountName.trim()}
                  onClick={() => void handleSaveDetailsOnly()}
                  className={`mt-5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 font-display text-sm sm:text-base font-extrabold transition-transform whitespace-nowrap ${
                    !savingPrefs && !matchesSavedDetails && accountNumber.trim() && accountName.trim()
                      ? 'bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 text-slate-950 shadow-lg hover:brightness-105 active:scale-[0.98]'
                      : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>
                    {savingPrefs
                      ? 'Saving to Profile...'
                      : matchesSavedDetails
                        ? 'Saved as Preferred Details'
                        : 'Save Preferred Details'}
                  </span>
                </button>
              </div>
            </section>
          </>
        ) : (
          /* Active Withdraw Form when invitesCount >= 50 */
          <section className="rounded-3xl border border-white/15 bg-[#161B36] p-5 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="text-xs font-medium text-slate-400">Withdrawable Balance (USD)</div>
                <div className="mt-1 font-display text-3xl font-extrabold text-amber-300 tabular-nums">
                  {formatUsd(balance)}
                </div>
              </div>
              <div className="text-right text-xs text-slate-300 tabular-nums">
                <span>
                  Invites · {invitesCount} · {formatCoins(coins)} Coins
                </span>
              </div>
            </div>

            {submittedSuccess && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-xs sm:text-sm text-emerald-200">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-semibold text-emerald-100">
                    Payout request submitted!
                  </div>
                  <p className="mt-0.5 text-emerald-200/90">
                    Your USD withdrawal has been recorded with status pending
                    {saveOnSubmit ? ' and your preferred payout details were saved to your profile.' : '.'}
                  </p>
                </div>
              </div>
            )}

            {savedNotice && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{savedNotice}</span>
              </div>
            )}

            {formError && (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {renderPayoutFields()}

              {/* Remember Preferred Payout Details Toggle */}
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#0D1021] px-3.5 py-2.5 text-xs text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={saveOnSubmit}
                  onChange={(e) => setSaveOnSubmit(e.target.checked)}
                  className="h-4 w-4 rounded border-white/25 accent-emerald-400 shrink-0"
                />
                <span>
                  Save these withdrawal details to my profile for future requests
                </span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={
                    savingPrefs ||
                    submitting ||
                    matchesSavedDetails ||
                    !accountNumber.trim() ||
                    !accountName.trim()
                  }
                  onClick={() => void handleSaveDetailsOnly()}
                  className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                    !savingPrefs &&
                    !submitting &&
                    !matchesSavedDetails &&
                    accountNumber.trim() &&
                    accountName.trim()
                      ? 'border border-amber-300/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25'
                      : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>
                    {savingPrefs
                      ? 'Saving...'
                      : matchesSavedDetails
                        ? 'Details Saved'
                        : 'Save to Profile'}
                  </span>
                </button>

                <button
                  type="submit"
                  disabled={submitting || balance < MIN_WITHDRAW_CENTS}
                  className={`flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-display text-base font-extrabold transition-transform whitespace-nowrap tabular-nums ${
                    balance >= MIN_WITHDRAW_CENTS && !submitting
                      ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-lg hover:brightness-105 active:scale-[0.98]'
                      : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  <Send className="h-4 w-4 shrink-0" />
                  <span>
                    {submitting
                      ? 'Submitting Request...'
                      : balance >= MIN_WITHDRAW_CENTS
                        ? `Submit Payout Request (${formatUsd(balance)})`
                        : 'No Available USD Balance'}
                  </span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* User's Recent Withdraw Requests History */}
        {user && requests.length > 0 && (
          <section className="rounded-3xl border border-white/15 bg-[#161B36] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white">
                Your Payout History
              </h2>
              <Wallet className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>

            <div className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#0D1021]">
              {requests.map((req) => (
                <div
                  key={req.requestId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white break-all">
                      {formatPaymentMethod(req.paymentMethod)} ·{' '}
                      <span className="font-mono">{req.accountNumber}</span>
                    </div>
                    <div className="mt-0.5 text-slate-400 tabular-nums">
                      {req.accountName} · {formatScoreDate(req.createdAtMs)}
                    </div>
                  </div>

                  <div className="text-right tabular-nums shrink-0">
                    <div className="font-display text-sm font-bold text-white">
                      {formatUsd(req.amount)}
                    </div>
                    <div
                      className={`mt-0.5 font-semibold capitalize ${
                        req.status === 'approved'
                          ? 'text-emerald-300'
                          : req.status === 'rejected'
                            ? 'text-rose-300'
                            : 'text-amber-300'
                      }`}
                    >
                      Status: {req.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
