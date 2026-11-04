import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_MESSAGES = 80;
const MAX_BATTLES = 50;

interface ServerChatMessage {
  id: string;
  sender: string;
  tier: string;
  avatarId: string;
  text: string;
  kind: string;
  battleCode?: string;
  targetScore?: number;
  createdAt: string;
}

interface ServerBattle {
  id: string;
  code: string;
  creator: string;
  targetScore: number;
  rewardCoins: number;
  createdAt: string;
}

const communityMessages: ServerChatMessage[] = [
  {
    id: 'sys_welcome_1',
    sender: 'Community Host',
    tier: 'Diamond',
    avatarId: 'crown',
    text: 'Welcome to Color Stack 3D Live Chat! Share your high scores, withdraw milestones, or post a 1v1 Friend Battle code.',
    kind: 'system',
    createdAt: new Date().toISOString(),
  },
];

const communityBattles: ServerBattle[] = [];

function cleanString(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildValidatedMessage(raw: Record<string, unknown>): ServerChatMessage | null {
  const id = cleanString(raw.id, 64, `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const sender = cleanString(raw.sender, 32, 'Player');
  const tierRaw = cleanString(raw.tier, 16, 'Bronze');
  const tier =
    tierRaw === 'Diamond' || tierRaw === 'Gold' || tierRaw === 'Silver' ? tierRaw : 'Bronze';
  const avatarId = cleanString(raw.avatarId, 16, 'crown');
  const text = cleanString(raw.text, 240, '');
  if (!text) return null;

  const kindRaw = cleanString(raw.kind, 16, 'chat');
  const kind = kindRaw === 'battle' || kindRaw === 'payout' ? kindRaw : 'chat';
  const battleCode = raw.battleCode ? cleanString(raw.battleCode, 32, '') : undefined;
  const targetScore =
    typeof raw.targetScore === 'number' && Number.isFinite(raw.targetScore)
      ? Math.max(1, Math.min(100000, Math.floor(raw.targetScore)))
      : undefined;

  return {
    id,
    sender,
    tier,
    avatarId,
    text,
    kind,
    ...(battleCode ? { battleCode } : {}),
    ...(targetScore !== undefined ? { targetScore } : {}),
    createdAt: new Date().toISOString(),
  };
}

function buildValidatedBattle(raw: Record<string, unknown>): ServerBattle | null {
  const code = cleanString(raw.code, 32, '').toUpperCase();
  if (!code) return null;
  const creator = cleanString(raw.creator, 32, 'Challenger');
  const scoreVal =
    typeof raw.targetScore === 'number' && Number.isFinite(raw.targetScore)
      ? Math.max(1, Math.min(100000, Math.floor(raw.targetScore)))
      : 25;

  return {
    id: cleanString(raw.id, 64, `btl_${Date.now()}`),
    code,
    creator,
    targetScore: scoreVal,
    rewardCoins: 50,
    createdAt: new Date().toISOString(),
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '64kb' }));

  const wss = new WebSocketServer({ server: httpServer, path: '/ws-community' });

  const broadcast = (payload: unknown): void => {
    const encoded = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    }
  };

  const getOnlineCount = () => {
    let count = 0;
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) count++;
    }
    return Math.max(1, count);
  };

  wss.on('connection', (socket) => {
    socket.send(
      JSON.stringify({
        type: 'init',
        messages: communityMessages,
        battles: communityBattles,
        onlineCount: getOnlineCount(),
      }),
    );

    broadcast({
      type: 'presence:count',
      onlineCount: getOnlineCount(),
    });

    socket.on('message', (rawBuf) => {
      try {
        const parsed = JSON.parse(String(rawBuf));
        if (!parsed || typeof parsed !== 'object') return;

        if (parsed.type === 'chat:send' && parsed.payload && typeof parsed.payload === 'object') {
          const msg = buildValidatedMessage(parsed.payload);
          if (!msg) return;
          if (!communityMessages.some((m) => m.id === msg.id)) {
            communityMessages.push(msg);
            if (communityMessages.length > MAX_MESSAGES) {
              communityMessages.splice(0, communityMessages.length - MAX_MESSAGES);
            }
            broadcast({ type: 'chat:message', message: msg });
          }
        } else if (
          parsed.type === 'battle:create' &&
          parsed.payload &&
          typeof parsed.payload === 'object'
        ) {
          const battle = buildValidatedBattle(parsed.payload);
          if (!battle) return;
          if (!communityBattles.some((b) => b.code === battle.code)) {
            communityBattles.unshift(battle);
            if (communityBattles.length > MAX_BATTLES) {
              communityBattles.length = MAX_BATTLES;
            }
            broadcast({ type: 'battle:created', battle });
          }
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });

    socket.on('close', () => {
      broadcast({
        type: 'presence:count',
        onlineCount: getOnlineCount(),
      });
    });
  });

  // REST Endpoints (initial sync & HTTP fallback)
  app.get('/api/community/state', (_req, res) => {
    res.json({
      messages: communityMessages,
      battles: communityBattles,
      onlineCount: getOnlineCount(),
    });
  });

  app.post('/api/community/messages', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const msg = buildValidatedMessage(body);
    if (!msg) {
      res.status(400).json({ error: 'Invalid message payload' });
      return;
    }
    if (!communityMessages.some((m) => m.id === msg.id)) {
      communityMessages.push(msg);
      if (communityMessages.length > MAX_MESSAGES) {
        communityMessages.splice(0, communityMessages.length - MAX_MESSAGES);
      }
      broadcast({ type: 'chat:message', message: msg });
    }
    res.json({ ok: true, message: msg });
  });

  app.post('/api/community/battles', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const battle = buildValidatedBattle(body);
    if (!battle) {
      res.status(400).json({ error: 'Invalid battle payload' });
      return;
    }
    if (!communityBattles.some((b) => b.code === battle.code)) {
      communityBattles.unshift(battle);
      if (communityBattles.length > MAX_BATTLES) {
        communityBattles.length = MAX_BATTLES;
      }
      broadcast({ type: 'battle:created', battle });
    }
    res.json({ ok: true, battle });
  });

  app.get('/privacy-policy.html', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html'));
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Color Stack 3D server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
