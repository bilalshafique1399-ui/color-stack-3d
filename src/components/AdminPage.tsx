import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  LogIn,
  LogOut,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  ADMIN_EMAIL,
  formatPaymentMethod,
  formatUsd,
  isUserAdmin,
  reviewWithdrawRequest,
  subscribeAllWithdrawRequests,
  WithdrawRequestEntry,
  WithdrawStatus,
} from '../services/referralService';
import { parseLeaderboardError } from '../services/globalLeaderboardService';
import { formatScoreDate } from '../services/highScoreService';
import { soundEngine } from '../audio/soundEngine';

interface AdminPageProps {
  user: User | null;
  authReady: boolean;
  onBackToGame: () => void;
  onGoogleLogin: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

type FilterTab = 'all' | WithdrawStatus;

export const AdminPage: React.FC<AdminPageProps> = ({
  user,
  authReady,
  onBackToGame,
  onGoogleLogin,
  onSignOut,
}) => {
  const [requests, setRequests] = useState<WithdrawRequestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const authorized = isUserAdmin(user);

  useEffect(() => {
    if (!authReady || !authorized) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const unsub = subscribeAllWithdrawRequests(
      (items) => {
        setRequests(items);
        setLoading(false);
      },
      (friendlyErr) => {
        setError(friendlyErr);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [authReady, authorized]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((req) => {
      if (filterStatus !== 'all' && req.status !== filterStatus) return false;
      if (!q) return true;
      return (
        req.email.toLowerCase().includes(q) ||
        req.accountNumber.toLowerCase().includes(q) ||
        req.accountName.toLowerCase().includes(q) ||
        formatPaymentMethod(req.paymentMethod).toLowerCase().includes(q)
      );
    });
  }, [requests, filterStatus, searchQuery]);

  const summary = useMemo(() => {
    let pendingCount = 0;
    let pendingCents = 0;
    let approvedCents = 0;
    for (const r of requests) {
      if (r.status === 'pending') {
        pendingCount += 1;
        pendingCents += r.amount;
      } else if (r.status === 'approved') {
        approvedCents += r.amount;
      }
    }
    return {
      total: requests.length,
      pendingCount,
      pendingCents,
      approvedCents,
    };
  }, [requests]);

  const handleAction = async (
    entry: WithdrawRequestEntry,
    nextStatus: 'approved' | 'rejected',
  ) => {
    if (busyId) return;
    soundEngine.playClick();
    setBusyId(entry.requestId);
    setError(null);
    try {
      await reviewWithdrawRequest(entry, nextStatus);
    } catch (err) {
      setError(parseLeaderboardError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#0F1326] text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0F1326]/95 px-4 sm:px-6">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onBackToGame();
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span>Game</span>
            </button>
            <span className="text-white/20" aria-hidden="true">
              /
            </span>
            <h1 className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
              USD Withdraw Requests Admin
            </h1>
          </div>

          {user && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                void onSignOut();
              }}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-slate-200 hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {!authReady ? (
          <div className="rounded-2xl border border-white/10 bg-[#161B36] p-8 text-center text-sm text-slate-300">
            Verifying administrator session...
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-md rounded-3xl border border-white/15 bg-[#161B36] p-6 sm:p-8 text-center">
            <h2 className="font-display text-2xl font-extrabold text-white">
              Admin Sign-In
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Sign in with the authorized Google administrator account to review worldwide USD withdrawal requests.
            </p>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                void onGoogleLogin();
              }}
              className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-display text-sm font-extrabold text-slate-950 hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              <span>Sign in with Google</span>
            </button>
          </div>
        ) : !authorized ? (
          <div className="mx-auto max-w-md rounded-3xl border border-rose-400/25 bg-[#161B36] p-6 sm:p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-xl font-extrabold text-white">
              Administrator Access Only
            </h2>
            <p className="mt-2 text-sm text-slate-300 break-words">
              Signed in as <strong className="text-white">{user.email}</strong>. Only{' '}
              <span className="font-mono text-xs text-amber-300">{ADMIN_EMAIL}</span> is authorized to view payout requests.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  void onSignOut();
                }}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/15 whitespace-nowrap"
              >
                Switch Account
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onBackToGame();
                }}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-white px-4 text-xs font-bold text-slate-950 whitespace-nowrap"
              >
                Return to Game
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#161B36] p-4">
                <div className="text-xs font-medium text-slate-400">Total Requests</div>
                <div className="mt-1 font-display text-2xl font-extrabold text-white tabular-nums">
                  {summary.total}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#161B36] p-4">
                <div className="text-xs font-medium text-slate-400">Pending Review</div>
                <div className="mt-1 font-display text-2xl font-extrabold text-amber-300 tabular-nums">
                  {summary.pendingCount}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#161B36] p-4">
                <div className="text-xs font-medium text-slate-400">Pending Payouts</div>
                <div className="mt-1 font-display text-2xl font-extrabold text-amber-300 tabular-nums">
                  {formatUsd(summary.pendingCents)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#161B36] p-4">
                <div className="text-xs font-medium text-slate-400">Approved Payouts</div>
                <div className="mt-1 font-display text-2xl font-extrabold text-emerald-300 tabular-nums">
                  {formatUsd(summary.approvedCents)}
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#161B36] p-1"
                role="tablist"
                aria-label="Filter withdraw status"
              >
                {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={filterStatus === tab}
                    onClick={() => {
                      soundEngine.playClick();
                      setFilterStatus(tab);
                    }}
                    className={`min-h-[40px] rounded-lg px-3.5 text-xs font-semibold capitalize transition-colors whitespace-nowrap shrink-0 ${
                      filterStatus === tab
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-80">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="Search email, RedotPay, Binance, USDT, or PayPal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#161B36] py-2 pr-3.5 pl-10 text-xs text-white placeholder:text-slate-400 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                {error}
              </div>
            )}

            {/* Withdraw Requests Table (Desktop) + Cards (Mobile) */}
            {loading ? (
              <div className="space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-2xl border border-white/5 bg-[#161B36]/70"
                  />
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-[#161B36] px-6 py-12 text-center">
                <p className="text-sm font-semibold text-slate-200">
                  No withdraw requests match this view
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Submitted RedotPay, Binance Pay, USDT (TRC20), and PayPal payout requests appear here in real time.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop High-Density Data Grid */}
                <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-[#161B36] md:block">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-[#0D1021] text-slate-400">
                        <th className="px-4 py-3 font-semibold">User Email</th>
                        <th className="px-4 py-3 font-semibold">Account Holder</th>
                        <th className="px-4 py-3 font-semibold">Wallet &amp; Account / Number</th>
                        <th className="px-4 py-3 text-right font-semibold">Invites</th>
                        <th className="px-4 py-3 text-right font-semibold">Amount (USD)</th>
                        <th className="px-4 py-3 font-semibold">Submitted</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 tabular-nums">
                      {filteredRequests.map((req) => (
                        <tr key={req.requestId} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3.5 font-medium text-white break-all">
                            {req.email}
                          </td>
                          <td className="px-4 py-3.5 text-slate-200">{req.accountName}</td>
                          <td className="px-4 py-3.5 text-slate-200 break-all">
                            <span
                              className={`font-semibold ${
                                req.paymentMethod === 'RedotPay' ||
                                req.paymentMethod === 'USDT_TRC20'
                                  ? 'text-emerald-300'
                                  : req.paymentMethod === 'BinancePay'
                                    ? 'text-amber-300'
                                    : 'text-sky-300'
                              }`}
                            >
                              {formatPaymentMethod(req.paymentMethod)}
                            </span>{' '}
                            · <span className="font-mono text-white">{req.accountNumber}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-semibold text-white">
                            {req.invitesCount}
                          </td>
                          <td className="px-4 py-3.5 text-right font-display font-bold text-amber-300">
                            {formatUsd(req.amount)}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap">
                            {formatScoreDate(req.createdAtMs)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`font-semibold capitalize ${
                                req.status === 'approved'
                                  ? 'text-emerald-300'
                                  : req.status === 'rejected'
                                    ? 'text-rose-300'
                                    : 'text-amber-300'
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {req.status === 'pending' ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={busyId === req.requestId}
                                  onClick={() => void handleAction(req, 'approved')}
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-emerald-400 px-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-50 whitespace-nowrap"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === req.requestId}
                                  onClick={() => void handleAction(req, 'rejected')}
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 whitespace-nowrap"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500">Reviewed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Stack */}
                <div className="space-y-3 md:hidden">
                  {filteredRequests.map((req) => (
                    <div
                      key={req.requestId}
                      className="rounded-2xl border border-white/10 bg-[#161B36] p-4 space-y-3 tabular-nums"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-white">
                            {req.accountName}
                          </div>
                          <div className="truncate text-xs text-slate-300">{req.email}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display text-base font-extrabold text-amber-300">
                            {formatUsd(req.amount)}
                          </div>
                          <div
                            className={`text-xs font-semibold capitalize ${
                              req.status === 'approved'
                                ? 'text-emerald-300'
                                : req.status === 'rejected'
                                  ? 'text-rose-300'
                                  : 'text-amber-300'
                            }`}
                          >
                            {req.status}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-xs text-slate-300">
                        <div className="break-all">
                          <span
                            className={`font-semibold ${
                              req.paymentMethod === 'RedotPay' ||
                              req.paymentMethod === 'USDT_TRC20'
                                ? 'text-emerald-300'
                                : req.paymentMethod === 'BinancePay'
                                  ? 'text-amber-300'
                                  : 'text-sky-300'
                            }`}
                          >
                            {formatPaymentMethod(req.paymentMethod)}
                          </span>{' '}
                          · <span className="font-mono text-white">{req.accountNumber}</span>
                        </div>
                        <div>
                          Invites: <strong className="text-white">{req.invitesCount}</strong> ·{' '}
                          {formatScoreDate(req.createdAtMs)}
                        </div>
                      </div>

                      {req.status === 'pending' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busyId === req.requestId}
                            onClick={() => void handleAction(req, 'approved')}
                            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-400 px-3 text-xs font-bold text-slate-950 disabled:opacity-50 whitespace-nowrap"
                          >
                            <Check className="h-4 w-4" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === req.requestId}
                            onClick={() => void handleAction(req, 'rejected')}
                            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-rose-200 disabled:opacity-50 whitespace-nowrap"
                          >
                            <X className="h-4 w-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
