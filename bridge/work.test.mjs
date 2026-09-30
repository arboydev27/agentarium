import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WebSocket } from 'ws';
import { once } from 'node:events';
import { createBridge } from './server.mjs';
import { createHistory } from './history.mjs';
const event = (sequence, type = 'waiting', work) => ({
  id: 'e' + sequence,
  sequence,
  type,
  timestamp: sequence * 1000,
  sessionId: 's',
  agentId: 'main',
  provider: 'Custom',
  work,
});
async function snapshot(port) {
  const ws = new WebSocket('ws://127.0.0.1:' + port);
  await once(ws, 'open');
  const incoming = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'authenticate', token: 'test-token' }));
  const data = JSON.parse((await incoming)[0]);
  ws.close();
  return data;
}
test('rich context is opt-in while legacy events remain accepted', async () => {
  const b = createBridge({ port: 0, token: 'test-token', dbPath: ':memory:' });
  const port = await b.start();
  const post = (body) =>
    fetch(`http://127.0.0.1:${port}/events`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await post(event(1, 'waiting', { objective: 'Private opt-in' }))).status, 400);
    assert.equal((await post(event(1))).status, 202);
    const s = await snapshot(port);
    assert.equal(s.protocolVersion, 2);
    assert.equal(s.capabilities.richContext, false);
    assert.equal(s.agents[0].attention.since, 1000);
    assert.equal((await fetch(`http://127.0.0.1:${port}/history`)).status, 401);
  } finally {
    await b.close();
  }
});
test('restart preserves episode, bridge identity and cursor; pagination excludes later arrivals', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentarium-work-'));
  let b;
  try {
    const opts = {
      port: 0,
      token: 'test-token',
      dbPath: join(dir, 'test.sqlite'),
      richContext: true,
    };
    b = createBridge(opts);
    let port = await b.start();
    const post = (body) =>
      fetch(`http://127.0.0.1:${port}/events`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        body: JSON.stringify(body),
      });
    const history = async (query = '') =>
      (
        await fetch(`http://127.0.0.1:${port}/history${query}`, {
          headers: { Authorization: 'Bearer test-token' },
        })
      ).json();
    await post(
      event(1, 'waiting', { request: { id: 'q1', kind: 'input', message: 'Choose destination' } }),
    );
    await post(event(2)); // same episode, not another recap item
    const before = await snapshot(port);
    assert.equal((await history()).items.length, 1);
    await b.close();
    b = createBridge(opts);
    port = await b.start();
    const after = await snapshot(port);
    assert.equal(after.bridgeId, before.bridgeId);
    assert.equal(after.agents[0].attention.message, 'Choose destination');
    assert.equal(after.agents[0].telemetryStale, true);
    await post(event(3, 'completed', { result: { summary: 'Draft ready' } }));
    const first = await history('?limit=1');
    assert.equal(first.hasMore, true);
    await post(event(4, 'failed'));
    const second = await history(`?after=${first.next}&until=${first.until}`);
    assert.equal(second.items.length, 1);
    assert.equal(second.items[0].status, 'completed');
    assert.equal(second.hasMore, false);
    assert.equal((await history(`?after=${second.next}`)).items[0].status, 'failed');
    await post(event(4, 'failed'));
    assert.equal((await history()).items.length, 3);
  } finally {
    if (b) await b.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test('history retention reports gaps and maintains monotonic cursors', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const history = createHistory(db, 'test');
    db.prepare('INSERT INTO history(cursor,payload) VALUES (?,?)').run(101, '{}');
    const page = history.page(new URLSearchParams('after=0'));
    assert.equal(page.gap, true);
    assert.equal(page.oldest, 101);
    db.exec('DELETE FROM history');
    db.prepare('INSERT INTO history(payload) VALUES (?)').run('{}');
    assert.equal(history.page(new URLSearchParams('after=101')).next, 102);
    assert.throws(() => history.page(new URLSearchParams('after=-1')));
    assert.throws(() => history.page(new URLSearchParams('after=999')));
  } finally {
    db.close();
  }
});
