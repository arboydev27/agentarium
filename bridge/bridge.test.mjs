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
