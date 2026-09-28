import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer, WebSocket } from 'ws';
import { createDiscovery, DISCOVERY_PROVIDERS } from './discovery.mjs';
import { mergeSessions } from '../src/shared/live.mjs';
import {
  validateEvent,
  reduceAgentEvent,
  agentKey,
  normalizeAgent,
} from '../src/shared/protocol.mjs';
export const DEFAULT_DB_PATH = fileURLToPath(new URL('./data/grove.sqlite', import.meta.url));
export function createBridge({
  port = 4318,
  token = randomBytes(24).toString('hex'),
  dbPath = DEFAULT_DB_PATH,
  discover = createDiscovery(),
  discoveryInterval = 5000,
  origins = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
  ],
} = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(
    'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, sequence INTEGER NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, payload TEXT NOT NULL);',
  );
  let agents = db
    .prepare('SELECT payload FROM agents')
    .all()
    .map((r) => normalizeAgent({ ...JSON.parse(r.payload), status: 'disconnected' }));
  const saveAgent = db.prepare('INSERT OR REPLACE INTO agents(id,payload) VALUES (?,?)');
  const saveEvent = db.prepare('INSERT INTO events(id,agent_id,sequence,payload) VALUES (?,?,?,?)');
  const hasEvent = db.prepare('SELECT id FROM events WHERE id=?');
  // Upgrade only bridge-owned snapshot keys; provider databases are always read-only.
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM agents');
    for (const agent of agents) saveAgent.run(agent.id, JSON.stringify(agent));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  let discovered = [],
    providers = DISCOVERY_PROVIDERS.map((provider) => ({
      provider,
      enabled: false,
      state: 'disabled',
      count: 0,
      detail: 'Local discovery is off.',
    }));
  let enabled = [],
    generation = 0,
    scanning = false,
    closed = false;
  const combined = () => mergeSessions(agents, discovered);
  function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const ws of wss.clients)
      if (ws.authenticated && ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
  async function scan() {
    if (scanning || closed) return;
    scanning = true;
    const version = generation;
    try {
      const result = await discover([...enabled]);
      if (!closed && version === generation) {
        discovered = result.agents;
        providers = result.providers;
        broadcast({ type: 'sessions', agents: combined(), providers });
      }
    } catch {
      if (!closed && version === generation) {
        discovered = [];
        providers = providers.map((p) => ({
          ...p,
          state: p.enabled ? 'error' : 'disabled',
          detail: 'Local scan failed; retrying on the next scan.',
        }));
        broadcast({ type: 'sessions', agents: combined(), providers });
      }
    } finally {
      scanning = false;
      if (!closed && version !== generation) void scan();
    }
  }

  function authenticated(value) {
    if (typeof value !== 'string') return false;
    const a = Buffer.from(value),
      b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const allowedOrigin = (origin) => !origin || origins.includes(origin);
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!allowedOrigin(origin)) {
      res.writeHead(403);
      res.end('Origin not allowed');
      return;
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      });
      res.end();
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'agent-grove' }));
      return;
    }
    if (!authenticated(req.headers.authorization?.replace(/^Bearer /, ''))) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }
    if (req.method !== 'POST' || req.url !== '/events') {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 65536) {
          res.writeHead(413);
          res.end('Event too large');
          return;
        }
      }
      const event = validateEvent(JSON.parse(body));
      if (hasEvent.get(event.id)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"accepted":false,"reason":"duplicate"}');
        return;
      }
      const next = reduceAgentEvent(agents, event);
      if (next === agents) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"accepted":false,"reason":"stale"}');
        return;
      }
      if (next.length > 256) {
        res.writeHead(429);
        res.end('Agent limit reached');
        return;
      }
      db.exec('BEGIN');
      try {
        saveEvent.run(
          event.id,
          agentKey(event.provider, event.sessionId, event.agentId),
          event.sequence,
          JSON.stringify(event),
        );
        const changed = next.find(
          (a) => a.id === agentKey(event.provider, event.sessionId, event.agentId),
        );
        saveAgent.run(changed.id, JSON.stringify(changed));
        db.exec(
          'DELETE FROM events WHERE rowid NOT IN (SELECT rowid FROM events ORDER BY rowid DESC LIMIT 10000)',
        );
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      agents = next;
      broadcast({ type: 'event', event });
      broadcast({ type: 'sessions', agents: combined(), providers });
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end('{"accepted":true}');
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Invalid event' }));
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  server.on('upgrade', (req, socket, head) => {
    if (!allowedOrigin(req.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (ws) => {
    ws.authenticated = false;
    ws.alive = true;
    const timer = setTimeout(() => ws.close(4003, 'Authentication required'), 5000);
    ws.on('pong', () => {
      ws.alive = true;
    });
    ws.on('close', () => clearTimeout(timer));
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (ws.authenticated) {
          if (data.type !== 'discover') return;
          if (
            !Array.isArray(data.providers) ||
            data.providers.length > 3 ||
            data.providers.some((p) => !DISCOVERY_PROVIDERS.includes(p))
          ) {
            ws.send(
              JSON.stringify({
                type: 'discoveryError',
                message: 'Choose Codex, Claude, or Gemini.',
              }),
            );
            return;
          }
          enabled = [...new Set(data.providers)];
          generation++;
          discovered = discovered.filter((a) => enabled.includes(a.provider));
          providers = providers.map((p) => ({
            ...p,
            enabled: enabled.includes(p.provider),
            state: enabled.includes(p.provider) ? 'scanning' : 'disabled',
            count: enabled.includes(p.provider) ? p.count : 0,
            detail: enabled.includes(p.provider)
              ? 'Reading local session metadata…'
              : 'Local discovery is off.',
          }));
          broadcast({ type: 'sessions', agents: combined(), providers });
          void scan();
          return;
        }
        if (data.type !== 'authenticate' || !authenticated(data.token)) {
          ws.close(4003, 'Invalid token');
          return;
        }
        ws.authenticated = true;
        clearTimeout(timer);
        ws.send(
          JSON.stringify({
            type: 'snapshot',
            agents: combined(),
            providers,
            discoverySupported: true,
          }),
        );
        if (enabled.length) void scan();
      } catch {
        ws.close(4003, 'Invalid authentication');
      }
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, 15000);
  heartbeat.unref();
  const discoveryTimer = setInterval(() => {
    if (enabled.length && [...wss.clients].some((ws) => ws.authenticated)) void scan();
  }, discoveryInterval);
  discoveryTimer.unref();
  return {
    token,
    server,
    async start() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
      });
      return server.address().port;
    },
    async close() {
      closed = true;
      generation++;
      clearInterval(discoveryTimer);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((r) => wss.close(r));
      await new Promise((r) => server.close(r));
      db.close();
    },
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bridge = createBridge({
    port: Number(process.env.GROVE_PORT || 4318),
    token: process.env.GROVE_TOKEN || undefined,
    dbPath: process.env.GROVE_DB || undefined,
    origins: process.env.GROVE_ORIGINS?.split(','),
  });
  bridge
    .start()
    .then((port) => {
      console.log('Agent Grove bridge: http://127.0.0.1:' + port);
      console.log('Session token: ' + bridge.token);
      console.log('Set GROVE_TOKEN to the same value in your agent hook environment.');
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, async () => {
      await bridge.close();
      process.exit(0);
    });
}
