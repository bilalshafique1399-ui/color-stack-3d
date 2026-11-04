import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, Send, Share2, Swords, Trophy } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import {
  communityRealtimeService,
  CommunitySnapshot,
} from '../services/communityRealtimeService';
import {
  createFriendBattleCode,
  EarnPlayState,
  FRIEND_BATTLE_PRIZE_COINS,
  getActiveUser,
  getPlayerRank,
  resolveFriendBattleChallenge,
} from '../services/localEarnStore';

interface CommunityAndBattlesPanelProps {
  mode: 'battle' | 'chat';
  earnState: EarnPlayState;
  onUpdateState: (nextState: EarnPlayState) => void;
  onShowToast: (msg: string) => void;
  onJumpToGame: () => void;
}

export const CommunityAndBattlesPanel: React.FC<CommunityAndBattlesPanelProps> = ({
  mode,
  earnState,
  onUpdateState,
  onShowToast,
  onJumpToGame,
}) => {
  const [snapshot, setSnapshot] = useState<CommunitySnapshot>(() =>
    communityRealtimeService.getSnapshot(),
  );

  // Friend 1v1 Battle states
  const [myBattleCode, setMyBattleCode] = useState<string>('');
  const [myBattleTarget, setMyBattleTarget] = useState<number>(earnState.best);
  const [copiedBattle, setCopiedBattle] = useState(false);
  const [challengeInput, setChallengeInput] = useState('');
  const [battleMsg, setBattleMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Live Chat states
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = communityRealtimeService.subscribe((nextSnap) => {
      setSnapshot(nextSnap);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (mode === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [snapshot.messages.length, mode]);

  const activeUser = getActiveUser(earnState);
  const senderName = activeUser ? activeUser.name : 'Guest Stacker';
  const senderTier = getPlayerRank(earnState.coins);

  const handleGenerateBattle = () => {
    soundEngine.playClick();
    const created = createFriendBattleCode(earnState);
    setMyBattleCode(created.code);
    setMyBattleTarget(created.targetScore);

    communityRealtimeService.publishFriendBattle({
      code: created.code,
      creator: senderName,
      targetScore: created.targetScore,
    });

    communityRealtimeService.sendChatMessage({
      sender: senderName,
      tier: senderTier,
      avatarId: earnState.avatarId,
      text: `1v1 Challenge! My score is ${created.targetScore} — beat code ${created.code} to win +${FRIEND_BATTLE_PRIZE_COINS} Coins!`,
      kind: 'battle',
      battleCode: created.code,
      targetScore: created.targetScore,
    });

    onShowToast(`Battle ${created.code} created & posted to Live Community!`);
  };

  const handleShareBattle = async () => {
    soundEngine.playClick();
    const codeToUse = myBattleCode || createFriendBattleCode(earnState).code;
    if (!myBattleCode) {
      setMyBattleCode(codeToUse);
    }
    const shareText = `My Color Stack 3D score is ${myBattleTarget}! Beat my 1v1 Battle Code ${codeToUse} to win +${FRIEND_BATTLE_PRIZE_COINS} Coins!`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Color Stack 3D - 1v1 Battle',
          text: shareText,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedBattle(true);
      onShowToast(`Challenge copied: ${codeToUse}`);
      window.setTimeout(() => setCopiedBattle(false), 2500);
    } catch {
      onShowToast(`Share code: ${codeToUse}`);
    }
  };

  const handleAcceptChallenge = (codeRaw: string, challenger?: string) => {
    soundEngine.playClick();
    const res = resolveFriendBattleChallenge(earnState, codeRaw, challenger);
    setBattleMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      soundEngine.playRewardFanfare();
      onUpdateState(res.nextState);
      setChallengeInput('');
    }
    onShowToast(res.message);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    soundEngine.playClick();
    communityRealtimeService.sendChatMessage({
      sender: senderName,
      tier: senderTier,
      avatarId: earnState.avatarId,
      text: chatInput,
      kind: 'chat',
    });
    setChatInput('');
  };

  const handleQuickShareScore = () => {
    soundEngine.playClick();
    communityRealtimeService.sendChatMessage({
      sender: senderName,
      tier: senderTier,
      avatarId: earnState.avatarId,
      text: `My Best Stack is ${earnState.best} & Wallet is ${earnState.coins.toLocaleString()} Coins! Who wants a 1v1 battle?`,
      kind: 'chat',
    });
    onShowToast('Shared your score in Live Community Chat!');
  };

  if (mode === 'battle') {
    const bpMult = earnState.battlePassActive ? 2 : 1;
    const potCoins = FRIEND_BATTLE_PRIZE_COINS * bpMult;

    return (
      <div className="space-y-3">
        {/* Create & Send 1v1 Challenge */}
        <div className="rounded-2xl bg-[#1C214E] p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-extrabold text-white sm:text-lg">
                Friend vs Friend 1v1 Battle
              </h3>
              <p className="mt-0.5 text-xs text-[#bbb] tabular-nums">
                Send your score ({earnState.best}) to a friend — Winner takes{' '}
                <b className="text-[#00D68F]">+{potCoins} Coins</b>! (Battles Won:{' '}
                <b className="text-[#FFCC00]">{earnState.battlesWon}</b>)
              </p>
            </div>
            <Swords className="h-5 w-5 shrink-0 text-[#FFCC00]" />
          </div>

          {myBattleCode && (
            <div className="mt-3 rounded-xl border border-[#00D68F]/40 bg-[#0F1226] p-3 text-xs sm:text-sm tabular-nums">
              Your Active Challenge Code:{' '}
              <b className="font-mono text-[#00D68F]">{myBattleCode}</b> (Target:{' '}
              <b>{myBattleTarget}</b>)
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerateBattle}
              className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-3.5 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
            >
              <Swords className="h-4 w-4" />
              <span>Create 1v1 Battle Code</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareBattle()}
              className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-white px-3.5 py-2.5 text-xs font-extrabold text-black transition hover:bg-slate-100 sm:text-sm"
            >
              {copiedBattle ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              <span>{copiedBattle ? 'Challenge Copied!' : 'Challenge a Friend'}</span>
            </button>
          </div>
        </div>

        {/* Accept Friend's Battle Code */}
        <div className="rounded-2xl bg-[#1C214E] p-4">
          <h3 className="font-display text-sm font-extrabold text-white sm:text-base">
            Enter Friend&apos;s Battle Code
          </h3>
          <p className="mt-0.5 text-xs text-[#bbb] tabular-nums">
            Your Best Score is <b className="text-white">{earnState.best}</b>. Beat their target
            score to claim +{potCoins} Coins!
          </p>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={challengeInput}
              onChange={(e) => setChallengeInput(e.target.value.toUpperCase())}
              placeholder="e.g. BTL-45-K9P2"
              className="min-w-0 flex-1 rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#00D68F]"
            />
            <button
              type="button"
              onClick={() => handleAcceptChallenge(challengeInput)}
              className="min-h-[42px] shrink-0 whitespace-nowrap rounded-[10px] bg-[#FFCC00] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
            >
              Claim Win
            </button>
          </div>

          {battleMsg && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <p
                className={`text-xs font-semibold ${
                  battleMsg.ok ? 'text-[#00D68F]' : 'text-amber-300'
                }`}
              >
                {battleMsg.text}
              </p>
              {!battleMsg.ok && (
                <button
                  type="button"
                  onClick={onJumpToGame}
                  className="whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold text-black"
                >
                  Play 3D Stack Now
                </button>
              )}
            </div>
          )}

          {/* Live Open Community Battles */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span>Live Community Challenges</span>
              <span className="text-[#bbb] tabular-nums">{snapshot.battles.length} Posted</span>
            </div>

            {snapshot.battles.length === 0 ? (
              <p className="mt-2 text-xs text-[#bbb]">
                No live challenges posted yet — tap &ldquo;Create 1v1 Battle Code&rdquo; above to
                post the first challenge!
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {snapshot.battles.slice(0, 8).map((b) => {
                  const settled = earnState.completedBattleCodes.includes(b.code);
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#333866] bg-[#0F1226] p-2.5 text-xs tabular-nums"
                    >
                      <div className="min-w-0">
                        <b className="text-white">{b.creator}</b> • Score{' '}
                        <b className="text-[#FFCC00]">{b.targetScore}</b>
                        <div className="font-mono text-[11px] text-[#bbb]">{b.code}</div>
                      </div>
                      <button
                        type="button"
                        disabled={settled}
                        onClick={() => handleAcceptChallenge(b.code, b.creator)}
                        className="min-h-[34px] shrink-0 whitespace-nowrap rounded-lg bg-[#00D68F] px-3 py-1.5 text-xs font-extrabold text-black disabled:opacity-45"
                      >
                        {settled ? 'Won' : `Beat (+${potCoins})`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Live Community Chat Mode
  return (
    <div className="rounded-2xl bg-[#1C214E] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-white sm:text-lg">
            <MessageCircle className="h-5 w-5 text-[#00D68F]" />
            <span>Live Community Chat</span>
          </h3>
          <p className="mt-0.5 text-xs text-[#bbb] tabular-nums">
            {snapshot.isOfflineWebView
              ? 'Offline APK Mode • Messages saved locally on device'
              : snapshot.connected
                ? `Connected Live • ${snapshot.onlineCount} Player(s) Online`
                : 'Syncing with Live Community Server...'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleQuickShareScore}
          className="min-h-[34px] whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold text-black transition hover:bg-slate-100"
        >
          Share My Score
        </button>
      </div>

      {/* Messages Feed */}
      <div
        ref={chatScrollRef}
        className="mt-3 h-[44vh] space-y-2 overflow-y-auto rounded-xl border border-[#333866] bg-[#0F1226] p-3"
      >
        {snapshot.messages.map((msg) => {
          const isMe = msg.sender === senderName && msg.kind !== 'system';
          return (
            <div
              key={msg.id}
              className={`rounded-xl border p-2.5 text-xs ${
                msg.kind === 'system'
                  ? 'border-[#00D68F]/30 bg-[#14173A] text-slate-200'
                  : msg.kind === 'battle'
                    ? 'border-[#FFCC00]/40 bg-[#1C214E] text-white'
                    : isMe
                      ? 'border-[#00D68F]/40 bg-[#00D68F]/10 text-white'
                      : 'border-[#333866] bg-[#14173A] text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white">
                  {msg.sender}{' '}
                  <span className="font-normal text-[11px] text-[#FFCC00]">• {msg.tier}</span>
                </span>
                {msg.battleCode && (
                  <button
                    type="button"
                    onClick={() => handleAcceptChallenge(msg.battleCode!, msg.sender)}
                    className="flex items-center gap-1 whitespace-nowrap rounded-md bg-[#FFCC00] px-2.5 py-1 text-[11px] font-extrabold text-black"
                  >
                    <Trophy className="h-3 w-3" />
                    <span>Accept 1v1</span>
                  </button>
                )}
              </div>
              <p className="mt-1 leading-relaxed break-words">{msg.text}</p>
            </div>
          );
        })}
      </div>

      {/* Send Message Input */}
      <form onSubmit={handleSendChat} className="mt-3 flex gap-2">
        <input
          type="text"
          maxLength={240}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Say hello, ask about withdrawals, or challenge players..."
          className="min-w-0 flex-1 rounded-[10px] border border-[#333866] bg-[#0F1226] p-3 text-sm text-white placeholder-[#888] outline-none focus:border-[#00D68F]"
        />
        <button
          type="submit"
          className="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#00D68F] px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-105 sm:text-sm"
        >
          <Send className="h-4 w-4" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
