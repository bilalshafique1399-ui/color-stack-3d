import type { AvatarId, RankTier } from './localEarnStore';

export interface CommunityChatMessage {
  id: string;
  sender: string;
  tier: RankTier;
  avatarId: AvatarId;
  text: string;
  kind: 'chat' | 'battle' | 'payout' | 'system';
  battleCode?: string;
  targetScore?: number;
  createdAt: string;
}

export interface LiveFriendBattle {
  id: string;
  code: string;
  creator: string;
  targetScore: number;
  rewardCoins: number;
  createdAt: string;
}

export interface CommunitySnapshot {
  messages: CommunityChatMessage[];
  battles: LiveFriendBattle[];
  onlineCount: number;
  connected: boolean;
  isOfflineWebView: boolean;
}

type Listener = (snapshot: CommunitySnapshot) => void;
type BattleAlertListener = (battle: LiveFriendBattle) => void;

const LOCAL_CHAT_CACHE_KEY = 'cs3d_community_cache_v1';

const DEFAULT_WELCOME_MSG: CommunityChatMessage = {
  id: 'sys_welcome_1',
  sender: 'Community Host',
  tier: 'Diamond',
  avatarId: 'crown',
  text: 'Welcome to Color Stack 3D Live Chat! Share your high scores, withdraw milestones, or post a 1v1 Friend Battle code.',
  kind: 'system',
  createdAt: new Date().toISOString(),
};

function canConnectToHttpServer(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.hostname === 'appassets.androidplatform.net') return false;
  if (typeof (window as unknown as { Android?: unknown }).Android !== 'undefined') return false;
  const proto = window.location.protocol;
  return proto === 'http:' || proto === 'https:';
}

class CommunityRealtimeService {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private started = false;

  private messages: CommunityChatMessage[] = [DEFAULT_WELCOME_MSG];
  private battles: LiveFriendBattle[] = [];
  private onlineCount = 1;
  private connected = false;
  private pendingQueue: string[] = [];

  private listeners = new Set<Listener>();
  private battleListeners = new Set<BattleAlertListener>();

  constructor() {
    this.loadCachedState();
  }

  private loadCachedState(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(LOCAL_CHAT_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        messages?: CommunityChatMessage[];
        battles?: LiveFriendBattle[];
      };
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        this.messages = parsed.messages.slice(-80);
      }
      if (Array.isArray(parsed.battles)) {
        this.battles = parsed.battles.slice(0, 50);
      }
    } catch {
      // ignore
    }
  }

  private saveCachedState(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        LOCAL_CHAT_CACHE_KEY,
        JSON.stringify({
          messages: this.messages.slice(-80),
          battles: this.battles.slice(0, 50),
        }),
      );
    } catch {
      // ignore
    }
  }

  public getSnapshot(): CommunitySnapshot {
    return {
      messages: this.messages,
      battles: this.battles,
      onlineCount: this.onlineCount,
      connected: this.connected,
      isOfflineWebView: !canConnectToHttpServer(),
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    this.ensureStarted();
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onNewRemoteBattle(listener: BattleAlertListener): () => void {
    this.battleListeners.add(listener);
    return () => {
      this.battleListeners.delete(listener);
    };
  }

  public ensureStarted(): void {
    if (this.started) return;
    this.started = true;
    if (!canConnectToHttpServer()) {
      this.emit();
      return;
    }
    void this.fetchInitialRestState();
    this.connectWebSocket();
  }

  private async fetchInitialRestState(): Promise<void> {
    if (!canConnectToHttpServer()) return;
    try {
      const res = await fetch('/api/community/state');
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: CommunityChatMessage[];
        battles?: LiveFriendBattle[];
        onlineCount?: number;
      };
      this.mergeMessages(data.messages ?? []);
      this.mergeBattles(data.battles ?? []);
      if (typeof data.onlineCount === 'number' && data.onlineCount >= 1) {
        this.onlineCount = data.onlineCount;
      }
      this.saveCachedState();
      this.emit();
    } catch {
      // Handled gracefully if offline
    }
  }

  private mergeMessages(incomingList: CommunityChatMessage[]): void {
    let changed = false;
    for (const msg of incomingList) {
      if (msg && msg.id && !this.messages.some((m) => m.id === msg.id)) {
        this.messages = [...this.messages, msg];
        changed = true;
      }
    }
    if (changed && this.messages.length > 80) {
      this.messages = this.messages.slice(-80);
    }
  }

  private mergeBattles(incomingList: LiveFriendBattle[]): void {
    for (const b of incomingList) {
      if (b && b.code && !this.battles.some((existing) => existing.code === b.code)) {
        this.battles = [b, ...this.battles].slice(0, 50);
      }
    }
  }

  private connectWebSocket(): void {
    if (!canConnectToHttpServer() || typeof WebSocket === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/ws-community`;

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.connected = true;
        this.reconnectAttempt = 0;
        while (this.pendingQueue.length > 0 && socket.readyState === WebSocket.OPEN) {
          const item = this.pendingQueue.shift();
          if (item) socket.send(item);
        }
        this.emit();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          if (!data || typeof data !== 'object') return;

          if (data.type === 'init') {
            if (Array.isArray(data.messages)) {
              this.mergeMessages(data.messages);
            }
            if (Array.isArray(data.battles)) {
              this.mergeBattles(data.battles);
            }
            if (typeof data.onlineCount === 'number') {
              this.onlineCount = Math.max(1, data.onlineCount);
            }
            this.saveCachedState();
            this.emit();
          } else if (data.type === 'chat:message' && data.message) {
            const msg = data.message as CommunityChatMessage;
            if (!this.messages.some((m) => m.id === msg.id)) {
              this.messages = [...this.messages, msg].slice(-80);
              this.saveCachedState();
              this.emit();
            }
          } else if (data.type === 'battle:created' && data.battle) {
            const b = data.battle as LiveFriendBattle;
            if (!this.battles.some((existing) => existing.code === b.code)) {
              this.battles = [b, ...this.battles].slice(0, 50);
              this.saveCachedState();
              this.emit();
              for (const listener of this.battleListeners) {
                listener(b);
              }
            }
          } else if (data.type === 'presence:count' && typeof data.onlineCount === 'number') {
            this.onlineCount = Math.max(1, data.onlineCount);
            this.emit();
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        this.connected = false;
        this.ws = null;
        this.emit();
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        // Handled by onclose
      };
    } catch {
      this.connected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!canConnectToHttpServer()) return;
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(10000, 2000 * Math.pow(1.6, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  public sendChatMessage(input: {
    sender: string;
    tier: RankTier;
    avatarId: AvatarId;
    text: string;
    kind?: 'chat' | 'battle' | 'payout';
    battleCode?: string;
    targetScore?: number;
  }): CommunityChatMessage | null {
    const cleanText = input.text.trim().slice(0, 240);
    if (!cleanText) return null;

    const optimisticMsg: CommunityChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sender: input.sender.trim().slice(0, 32) || 'Guest Stacker',
      tier: input.tier,
      avatarId: input.avatarId,
      text: cleanText,
      kind: input.kind ?? 'chat',
      ...(input.battleCode ? { battleCode: input.battleCode } : {}),
      ...(input.targetScore !== undefined ? { targetScore: input.targetScore } : {}),
      createdAt: new Date().toISOString(),
    };

    // Optimistic local append (idempotent)
    if (!this.messages.some((m) => m.id === optimisticMsg.id)) {
      this.messages = [...this.messages, optimisticMsg].slice(-80);
      this.saveCachedState();
      this.emit();
    }

    if (!canConnectToHttpServer()) {
      return optimisticMsg;
    }

    const frame = JSON.stringify({
      type: 'chat:send',
      payload: optimisticMsg,
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    } else {
      this.pendingQueue.push(frame);
      void fetch('/api/community/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimisticMsg),
      }).catch(() => {});
    }

    return optimisticMsg;
  }

  public publishFriendBattle(input: {
    code: string;
    creator: string;
    targetScore: number;
  }): LiveFriendBattle {
    const battle: LiveFriendBattle = {
      id: `btl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      code: input.code.toUpperCase(),
      creator: input.creator.trim().slice(0, 32) || 'Challenger',
      targetScore: Math.max(1, Math.floor(input.targetScore)),
      rewardCoins: 50,
      createdAt: new Date().toISOString(),
    };

    if (!this.battles.some((b) => b.code === battle.code)) {
      this.battles = [battle, ...this.battles].slice(0, 50);
      this.saveCachedState();
      this.emit();
    }

    if (!canConnectToHttpServer()) {
      return battle;
    }

    const frame = JSON.stringify({
      type: 'battle:create',
      payload: battle,
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    } else {
      this.pendingQueue.push(frame);
      void fetch('/api/community/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(battle),
      }).catch(() => {});
    }

    return battle;
  }
}

export const communityRealtimeService = new CommunityRealtimeService();
