import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { once } from 'node:events';
import { createBridge } from './server.mjs';
import { hookToEvent, codexToEvent } from './adapters.mjs';
test('authenticated transport, validation, deduplication, stale delivery and reconnect snapshot', async () => {
  const b = createBridge({ port: 0, token: 'test-token', dbPath: ':memory:' });
  const port = await b.start();
  const base = 'http://127.0.0.1:' + port;
  try {
    const post = (event, token = 'test-token') =>
      fetch(base + '/events', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    const event = {
      id: 'e1',
      sessionId: 's1',
      agentId: 'a1',
      sequence: 1,
      timestamp: Date.now(),
      type: 'working',
      provider: 'Codex',
    };
    assert.equal((await post(event, 'bad-token')).status, 401);
    assert.equal((await post({ ...event, type: 'bad-state' })).status, 400);
    const ws = new WebSocket('ws://127.0.0.1:' + port, { origin: 'http://127.0.0.1:5173' });
    await once(ws, 'open');
    let message = once(ws, 'message');
    ws.send(JSON.stringify({ type: 'authenticate', token: 'test-token' }));
    assert.equal(JSON.parse((await message)[0]).type, 'snapshot');
    message = once(ws, 'message');
    assert.equal((await post(event)).status, 202);
    assert.equal(JSON.parse((await message)[0]).event.id, 'e1');
    assert.equal((await (await post(event)).json()).reason, 'duplicate');
    assert.equal((await (await post({ ...event, id: 'e2', sequence: 0 })).json()).reason, 'stale');
    ws.close();
    const second = new WebSocket('ws://127.0.0.1:' + port);
    await once(second, 'open');
    message = once(second, 'message');
    second.send(JSON.stringify({ type: 'authenticate', token: 'test-token' }));
    const snapshot = JSON.parse((await message)[0]);
    assert.equal(snapshot.agents[0].status, 'working');
    second.close();
    const bad = new WebSocket('ws://127.0.0.1:' + port);
    await once(bad, 'open');
    const closed = once(bad, 'close');
    bad.send(JSON.stringify({ type: 'authenticate', token: 'wrong' }));
    assert.equal((await closed)[0], 4003);
  } finally {
    await b.close();
  }
});
test('hook mappings preserve agent relationships without forwarding content', () => {
  const e = hookToEvent('Claude', {
    hook_event_name: 'SubagentStart',
    session_id: 's',
    agent_id: 'child',
    agent_type: 'reviewer',
    prompt: 'private',
    tool_input: { secret: 'private' },
  });
  assert.equal(e.parentId, 'main');
  assert.equal(e.agentId, 'child');
  assert.equal(e.type, 'working');
  assert.ok(!JSON.stringify(e).includes('private'));
  assert.equal(
    hookToEvent('Gemini', { hook_event_name: 'AfterAgent', session_id: 's' }).type,
    'completed',
  );
});
test('Codex adapter maps real protocol lifecycles', () => {
  assert.equal(
    codexToEvent({
      method: 'turn/completed',
      params: { threadId: 't', turn: { status: 'failed' } },
    }).type,
    'failed',
  );
  assert.equal(
    codexToEvent({
      method: 'item/started',
      params: { threadId: 't', item: { type: 'commandExecution', command: 'secret' } },
    }).task,
    'Running a command',
  );
  assert.equal(
    codexToEvent({ method: 'item/commandExecution/requestApproval', params: { threadId: 't' } })
      .type,
    'waiting',
  );
  assert.equal(codexToEvent({ method: 'unknown', params: { threadId: 't' } }), null);
});

test('default database location is independent of the launch directory', async () => {
  const { spawnSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const { fileURLToPath } = await import('node:url');
  const serverUrl = new URL('./server.mjs', import.meta.url);
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const {DEFAULT_DB_PATH}=await import(${JSON.stringify(serverUrl.href)});console.log(DEFAULT_DB_PATH);`,
    ],
    { cwd: tmpdir(), encoding: 'utf8' },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), fileURLToPath(new URL('./data/grove.sqlite', import.meta.url)));
});

test('both hook configurations reference this checkout from any launch directory', async () => {
  const { spawnSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const { fileURLToPath } = await import('node:url');
  const generator = fileURLToPath(new URL('./print-hook-config.mjs', import.meta.url));
  const hook = fileURLToPath(new URL('./hook.mjs', import.meta.url));
  for (const provider of ['claude', 'gemini']) {
    const child = spawnSync(process.execPath, [generator, provider], {
      cwd: tmpdir(),
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr);
    const config = JSON.parse(child.stdout);
    assert.ok(Object.keys(config.hooks).length > 0);
    for (const groups of Object.values(config.hooks))
      for (const group of groups)
        for (const entry of group.hooks) {
          assert.ok(entry.command.includes(hook));
          assert.ok(entry.command.endsWith(' ' + provider));
        }
  }
});

function waitMessage(ws, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for bridge message'));
    }, 3000);
    function cleanup() {
      clearTimeout(timeout);
      ws.off('message', receive);
    }
    function receive(raw) {
      const data = JSON.parse(raw.toString());
      if (predicate(data)) {
        cleanup();
        resolve(data);
      }
    }
    ws.on('message', receive);
  });
}

test('local discovery requires authentication, pushes updates, and clears disabled providers', async () => {
  let calls = 0;
  const b = createBridge({
    port: 0,
    token: 'test-token',
    dbPath: ':memory:',
    discoveryInterval: 20,
    discover: async (enabled) => {
      calls++;
      return {
        agents: enabled.includes('Codex')
          ? [{ id: 'observed', provider: 'Codex', sessionId: 'real', updatedAt: calls }]
          : [],
        providers: [
          {
            provider: 'Codex',
            enabled: enabled.includes('Codex'),
            state: enabled.length ? 'ready' : 'disabled',
            count: enabled.length ? 1 : 0,
          },
        ],
      };
    },
  });
  const port = await b.start();
  try {
    const bad = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(bad, 'open');
    const closed = once(bad, 'close');
    bad.send(JSON.stringify({ type: 'discover', providers: ['Codex'] }));
    assert.equal((await closed)[0], 4003);
    assert.equal(calls, 0);
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(ws, 'open');
    let next = waitMessage(ws, (m) => m.type === 'snapshot');
    ws.send(JSON.stringify({ type: 'authenticate', token: 'test-token' }));
    assert.equal((await next).discoverySupported, true);
    assert.equal(calls, 0);
    next = waitMessage(ws, (m) => m.type === 'sessions' && m.agents.length === 1);
    ws.send(JSON.stringify({ type: 'discover', providers: ['Codex'] }));
    const first = await next;
    next = waitMessage(
      ws,
      (m) => m.type === 'sessions' && m.agents[0]?.updatedAt > first.agents[0].updatedAt,
    );
    await next;
    next = waitMessage(
      ws,
      (m) => m.type === 'sessions' && m.agents.length === 0 && m.providers[0].state === 'disabled',
    );
    ws.send(JSON.stringify({ type: 'discover', providers: [] }));
    await next;
    ws.close();
  } finally {
    await b.close();
  }
});

test('disabling a provider while a scan is in flight discards its late result', async () => {
  let finish;
  const b = createBridge({
    port: 0,
    token: 'test-token',
    dbPath: ':memory:',
    discover: (enabled) =>
      enabled.length
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve({ agents: [], providers: [] }),
  });
  const port = await b.start();
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(ws, 'open');
    let next = waitMessage(ws, (m) => m.type === 'snapshot');
    ws.send(JSON.stringify({ type: 'authenticate', token: 'test-token' }));
    await next;
    next = waitMessage(ws, (m) => m.type === 'sessions' && m.providers[0].state === 'scanning');
    ws.send(JSON.stringify({ type: 'discover', providers: ['Codex'] }));
    await next;
    next = waitMessage(ws, (m) => m.type === 'sessions' && m.providers[0]?.state === 'disabled');
    ws.send(JSON.stringify({ type: 'discover', providers: [] }));
    await next;
    const messages = [];
    ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
    next = waitMessage(ws, (m) => m.type === 'sessions' && m.providers.length === 0);
    finish({ agents: [{ id: 'must-not-appear' }], providers: [] });
    await next;
    assert.ok(messages.every((m) => m.agents?.length === 0));
    ws.close();
  } finally {
    await b.close();
  }
});

test('legacy bridge snapshots migrate without losing sequence protection', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { DatabaseSync } = await import('node:sqlite');
  const { agentKey } = await import('../src/shared/protocol.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'agentarium-migration-'));
  const file = join(dir, 'bridge.sqlite');
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE agents(id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
  db.prepare('INSERT INTO agents VALUES (?,?)').run(
    'old:main',
    JSON.stringify({
      id: 'old:main',
      sessionId: 'old',
      provider: 'Codex',
      source: 'live',
      seat: 0,
      sequence: 20,
      status: 'working',
      updatedAt: 1,
    }),
  );
  db.close();
  const b = createBridge({ port: 0, token: 'test-token', dbPath: file });
  try {
    const port = await b.start();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(ws, 'open');
    const next = waitMessage(ws, (m) => m.type === 'snapshot');
    ws.send(JSON.stringify({ type: 'authenticate', token: 'test-token' }));
    const snapshot = await next;
    assert.equal(snapshot.agents[0].id, agentKey('Codex', 'old', 'main'));
    assert.equal(snapshot.agents[0].sequence, 20);
    assert.equal(snapshot.agents[0].status, 'working');
    assert.equal(snapshot.agents[0].telemetryStale, true);
    const response = await fetch(`http://127.0.0.1:${port}/events`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'stale',
        sessionId: 'old',
        agentId: 'main',
        provider: 'Codex',
        sequence: 1,
        timestamp: Date.now(),
        type: 'working',
      }),
    });
    assert.equal((await response.json()).reason, 'stale');
    const fresh = waitMessage(ws, (m) => m.type === 'sessions');
    await fetch(`http://127.0.0.1:${port}/events`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'fresh',
        sessionId: 'old',
        agentId: 'main',
        provider: 'Codex',
        sequence: 21,
        timestamp: Date.now(),
        type: 'waiting',
      }),
    });
    const updated = await fresh;
    assert.equal(updated.agents[0].status, 'waiting');
    assert.equal(updated.agents[0].telemetryStale, false);

    ws.close();
  } finally {
    await b.close();
    await rm(dir, { recursive: true, force: true });
  }
});
