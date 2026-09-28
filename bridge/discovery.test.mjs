import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, utimes, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDiscovery, codexActivity } from './discovery.mjs';

const now = 1800000000000;
const record = (type, ago = 0, extra = {}) =>
  JSON.stringify({
    timestamp: new Date(now - ago).toISOString(),
    type: 'event_msg',
    payload: { type, ...extra },
  });
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'agentarium-discovery-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const roots = {
    Codex: join(dir, 'codex'),
    Claude: join(dir, 'claude'),
    Gemini: join(dir, 'gemini'),
  };
  return { dir, roots, scan: createDiscovery({ roots, now: () => now }) };
}

test('Codex lifecycle evidence expires, tolerates partial logs, and ignores private content', () => {
  assert.equal(codexActivity(record('task_started', 1000), now).status, 'working');
  assert.equal(codexActivity(record('task_started', 121000), now).status, 'unknown');
  assert.equal(
    codexActivity(
      record('task_started', 1000) +
        '\n' +
        record('task_complete', 0, { last_agent_message: 'SECRET' }) +
        '\n{',
      now,
    ).status,
    'completed',
  );
  assert.equal(codexActivity(record('turn_aborted'), now).status, 'idle');
  assert.equal(codexActivity(record('constructor'), now).status, 'unknown');
  assert.ok(
    !JSON.stringify(
      codexActivity(record('task_complete', 0, { last_agent_message: 'SECRET' }), now),
    ).includes('SECRET'),
  );
});

test('discovery is opt-in and missing providers are reported separately', async (t) => {
  const { scan } = await fixture(t);
  const off = await scan([]);
  assert.equal(off.agents.length, 0);
  assert.ok(off.providers.every((p) => p.state === 'disabled'));
  const on = await scan(['Codex', 'Claude', 'Gemini']);
  assert.ok(on.providers.every((p) => p.state === 'unavailable'));
});

test('Codex reads recent top-level records without changing provider storage', async (t) => {
  const { roots, scan } = await fixture(t);
  await mkdir(join(roots.Codex, 'sessions'), { recursive: true });
  const log = join(roots.Codex, 'sessions', 'one.jsonl');
  await writeFile(log, record('task_started', 1000) + '\n' + record('task_complete'));
  const file = join(roots.Codex, 'state_5.sqlite');
  const db = new DatabaseSync(file);
  db.exec(
    'CREATE TABLE threads (id TEXT, updated_at INTEGER, source TEXT, archived INTEGER, rollout_path TEXT, title TEXT)',
  );
  const insert = db.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?)');
  insert.run('real', now / 1000, 'vscode', 0, log, 'A real session');
  insert.run('child', now / 1000, '{"subagent":{"other":"guardian"}}', 0, log, 'Hidden child');
  insert.run('archived', now / 1000, 'vscode', 1, log, 'Archived');
  db.close();
  const before = await readFile(file);
  const result = await scan(['Codex']);
  assert.equal(result.agents.length, 1);
  assert.equal(result.agents[0].sessionId, 'real');
  assert.equal(result.agents[0].status, 'completed');
  assert.equal(result.agents[0].name, 'A real session');
  assert.deepEqual(await readFile(file), before);
  assert.ok(!JSON.stringify(result).includes(log));
  await writeFile(log, record('task_started'));
  assert.equal((await scan(['Codex'])).agents[0].status, 'working');
});

test('Claude discovers top-level UUID sessions without reading transcript text', async (t) => {
  const { roots, scan } = await fixture(t);
  const project = join(roots.Claude, 'projects', 'project');
  await mkdir(join(project, 'subagents'), { recursive: true });
  const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  await writeFile(join(project, id + '.jsonl'), 'PRIVATE TRANSCRIPT, NOT EVEN JSON');
  await writeFile(join(project, 'agent-child.jsonl'), 'PRIVATE');
  await writeFile(join(project, 'subagents', id + '.jsonl'), 'PRIVATE');
  const result = await scan(['Claude']);
  assert.equal(result.agents.length, 1);
  assert.equal(result.agents[0].status, 'unknown');
  assert.equal(result.agents[0].sessionId, id);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

test('Gemini handles legacy JSON, JSONL metadata updates, migration duplicates and malformed files', async (t) => {
  const { roots, scan } = await fixture(t);
  const chats = join(roots.Gemini, 'tmp', 'project', 'chats');
  await mkdir(chats, { recursive: true });
  await writeFile(
    join(chats, 'session-one.json'),
    JSON.stringify({
      sessionId: 'one',
      lastUpdated: new Date(now).toISOString(),
      messages: [{ content: 'PRIVATE' }],
    }),
  );
  await writeFile(
    join(chats, 'session-one.jsonl'),
    JSON.stringify({ sessionId: 'one', kind: 'main' }) +
      '\n' +
      JSON.stringify({ $set: { lastUpdated: new Date(now).toISOString() } }) +
      '\n',
  );
  await writeFile(
    join(chats, 'session-two.jsonl'),
    JSON.stringify({ sessionId: 'two', kind: 'main' }) +
      '\n' +
      '{"type":"gemini","content":"PRIVATE"}\n',
  );
  await writeFile(join(chats, 'session-broken.json'), '{');
  await symlink(join(chats, 'session-one.json'), join(chats, 'session-link.json'));
  const result = await scan(['Gemini']);
  assert.equal(result.agents.length, 2);
  assert.equal(result.providers.find((p) => p.provider === 'Gemini').count, 2);
  assert.ok(result.agents.every((a) => a.status === 'unknown'));
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

test('discovery finds newly created sessions and orders bounded recent history', async (t) => {
  const { roots, scan } = await fixture(t);
  const project = join(roots.Claude, 'projects', 'project');
  await mkdir(project, { recursive: true });
  assert.equal((await scan(['Claude'])).agents.length, 0);
  for (let i = 0; i < 66; i++) {
    const path = join(project, `${String(i).padStart(8, '0')}-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl`);
    await writeFile(path, '');
    await utimes(path, now / 1000 + i, now / 1000 + i);
  }
  const result = await scan(['Claude']);
  assert.equal(result.agents.length, 64);
  assert.ok(result.agents[0].sessionId.startsWith('00000065'));
  assert.equal((await scan([])).agents.length, 0);
});
