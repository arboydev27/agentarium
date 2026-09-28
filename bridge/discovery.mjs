import { readdir, stat, open, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { COLORS, agentKey } from '../src/shared/protocol.mjs';

export const DISCOVERY_PROVIDERS = ['Codex', 'Claude', 'Gemini'];
const LIMIT = 64;
const TAIL_BYTES = 256 * 1024;
const ACTIVE_WINDOW = 120000;
const uuid = /^[a-f0-9]{8}-[a-f0-9-]{27,}$/i;

async function entries(path) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}
async function inside(root, path) {
  const [base, file] = await Promise.all([realpath(root), realpath(path)]);
  if (!file.startsWith(base + sep)) throw new Error('Session path outside provider storage');
  return file;
}
async function tail(root, path, bytes = TAIL_BYTES, fromStart = false) {
  const file = await open(await inside(root, path), 'r');
  try {
    const info = await file.stat();
    const offset = fromStart ? 0 : Math.max(0, info.size - bytes);
    const buffer = Buffer.alloc(Math.min(info.size, bytes));
    const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    return offset ? text.slice(text.indexOf('\n') + 1) : text;
  } finally {
    await file.close();
  }
}
function time(value) {
  const n = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function resident(provider, sessionId, updatedAt, name, extra = {}) {
  let hash = 0;
  for (const char of provider + sessionId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    id: agentKey(provider, sessionId, 'main'),
    sessionId,
    agentId: 'main',
    provider,
    name: (name || `${provider} ${sessionId.slice(0, 8)}`).slice(0, 200),
    color: COLORS[hash % COLORS.length],
    status: 'unknown',
    task: 'Discovered session · activity unknown',
    updatedAt,
    startedAt: updatedAt,
    seat: 8,
    zone: 'Outside the grove',
    sequence: -1,
    source: 'live',
    evidence: 'history',
    ...extra,
  };
}

// Parse only lifecycle discriminators/timestamps; never forward message content or tool arguments.
export function codexActivity(text, now = Date.now()) {
  let status = 'unknown',
    observedAt = 0;
  for (const line of text.split('\n')) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const p = record.payload;
    if (!p || typeof p !== 'object') continue;
    const timestamp = time(record.timestamp);
    if (!timestamp || timestamp > now + 300000) continue;
    let next;
    if (record.type === 'event_msg') {
      const states = { task_started: 'working', task_complete: 'completed', turn_aborted: 'idle' };
      next = Object.hasOwn(states, p.type) ? states[p.type] : undefined;
      if (
        !next &&
        ['token_count', 'item_completed'].includes(p.type) &&
        ['working', 'tool'].includes(status)
      )
        next = status;
    } else if (record.type === 'response_item') {
      if (['function_call', 'custom_tool_call'].includes(p.type)) next = 'tool';
      if (['function_call_output', 'custom_tool_call_output'].includes(p.type)) next = 'working';
    }
    if (next && timestamp >= observedAt) {
      status = next;
      observedAt = timestamp;
    }
  }
  if (['working', 'tool'].includes(status) && now - observedAt > ACTIVE_WINDOW) status = 'unknown';
  return { status, observedAt: observedAt || undefined };
}

async function codex(root, now) {
  const files = await entries(root);
  if (!files)
    return { sessions: [], state: 'unavailable', detail: 'Codex storage directory not found.' };
  const databases = files
    .filter((f) => f.isFile() && /^state_\d+\.sqlite$/.test(f.name))
    .sort((a, b) => Number(b.name.match(/\d+/)[0]) - Number(a.name.match(/\d+/)[0]));
  if (!databases.length)
    return {
      sessions: [],
      state: 'unavailable',
      detail: 'No supported Codex state database found.',
    };
  const db = new DatabaseSync(join(root, databases[0].name), { readOnly: true });
  let rows;
  try {
    const columns = new Set(
      db
        .prepare('PRAGMA table_info(threads)')
        .all()
        .map((r) => r.name),
    );
    for (const column of ['id', 'updated_at', 'source', 'archived', 'rollout_path'])
      if (!columns.has(column)) throw new Error('Unsupported Codex session database schema');
    const updated = columns.has('updated_at_ms')
      ? 'COALESCE(updated_at_ms, updated_at * 1000)'
      : 'updated_at * 1000';
    const title = columns.has('name')
      ? columns.has('title')
        ? "COALESCE(NULLIF(name, ''), title)"
        : 'name'
      : columns.has('title')
        ? 'title'
        : 'NULL';
    rows = db
      .prepare(
        `SELECT id, rollout_path, ${updated} AS modified, ${title} AS label FROM threads
      WHERE archived = 0 AND lower(source) NOT LIKE '%subagent%' ORDER BY ${updated} DESC LIMIT ?`,
      )
      .all(LIMIT);
  } finally {
    db.close();
  }
  let skipped = 0;
  const sessions = [];
  for (const row of rows) {
    if (typeof row.id !== 'string' || row.id.length > 200) continue;
    let activity = { status: 'unknown' };
    try {
      activity = codexActivity(await tail(join(root, 'sessions'), row.rollout_path), now);
    } catch {
      skipped++;
    }
    const labels = {
      working: 'Working · observed in local log',
      tool: 'Using a tool · observed in local log',
      completed: 'Last recorded task completed',
      idle: 'Last recorded task interrupted',
      unknown: 'Discovered session · activity unknown',
    };
    sessions.push(
      resident('Codex', row.id, Math.max(time(row.modified), activity.observedAt || 0), row.label, {
        ...activity,
        task: labels[activity.status],
      }),
    );
  }
  return {
    sessions,
    state: sessions.length ? 'ready' : 'empty',
    detail: `Read-only local history; lifecycle observations expire after 2 minutes without evidence.${skipped ? ` ${skipped} logs unavailable; those sessions have unknown activity.` : ''}`,
  };
}

async function projectFiles(root, nested, pattern) {
  const projects = await entries(root);
  if (!projects) return null;
  const files = [];
  let truncated = projects.length > 1000;
  for (const project of projects.filter((p) => p.isDirectory()).slice(0, 1000)) {
    const dir = join(root, project.name, ...nested);
    const children = await entries(dir);
    if (!children) continue;
    for (const file of children) {
      if (!file.isFile() || !pattern.test(file.name)) continue;
      if (files.length >= 10000) {
        truncated = true;
        break;
      }
      try {
        const path = join(dir, file.name),
          info = await stat(path);
        files.push({ path, name: file.name, modified: info.mtimeMs, size: info.size });
      } catch {
        /* A session may be removed during scanning. */
      }
    }
    if (files.length >= 10000) break;
  }
  return { files: files.sort((a, b) => b.modified - a.modified).slice(0, LIMIT), truncated };
}
async function claude(root) {
  const found = await projectFiles(join(root, 'projects'), [], /\.jsonl$/);
  if (!found)
    return {
      sessions: [],
      state: 'unavailable',
      detail: 'Claude Code CLI project history not found. Desktop/web histories are separate.',
    };
  const sessions = found.files
    .filter((f) => uuid.test(f.name.slice(0, -6)))
    .map((f) => resident('Claude', f.name.slice(0, -6), f.modified));
  return {
    sessions,
    state: sessions.length ? 'ready' : 'empty',
    detail: `File metadata only. Configure Claude hooks for working/waiting/completion status.${found.truncated ? ' Scan limit reached; results may be incomplete.' : ''}`,
  };
}
async function gemini(root) {
  const found = await projectFiles(join(root, 'tmp'), ['chats'], /^session-.*\.jsonl?$/);
  if (!found)
    return {
      sessions: [],
      state: 'unavailable',
      detail: 'Gemini CLI session history not found. Gemini web and Antigravity are not supported.',
    };
  const sessions = [];
  let skipped = 0;
  for (const file of found.files) {
    try {
      let data;
      if (file.name.endsWith('.jsonl')) {
        data = JSON.parse((await tail(root, file.path, 65536, true)).split('\n')[0]);
        for (const line of (await tail(root, file.path)).split('\n')) {
          try {
            const record = JSON.parse(line);
            if (typeof record.$set?.sessionId === 'string') data.sessionId = record.$set.sessionId;
            if (record.$set?.lastUpdated) data.lastUpdated = record.$set.lastUpdated;
          } catch {
            /* Ignore partial or oversized lines. */
          }
        }
      } else {
        if (file.size > 2 * 1024 * 1024) {
          skipped++;
          continue;
        }
        data = JSON.parse(await tail(root, file.path, 2 * 1024 * 1024));
      }
      if (data.kind === 'subagent') continue;
      if (typeof data.sessionId !== 'string' || !data.sessionId || data.sessionId.length > 200) {
        skipped++;
        continue;
      }
      // Do not copy messages, summary text, or tool output into the bridge.
      sessions.push(
        resident('Gemini', data.sessionId, Math.max(time(data.lastUpdated), file.modified)),
      );
    } catch {
      skipped++;
    }
  }
  return {
    sessions,
    state: sessions.length ? 'ready' : 'empty',
    detail: `Session metadata only. Configure Gemini hooks for activity status.${skipped ? ` ${skipped} oversized, incomplete, or unsupported files skipped.` : ''}${found.truncated ? ' Scan limit reached; results may be incomplete.' : ''}`,
  };
}

export function createDiscovery({ roots = {}, now = () => Date.now() } = {}) {
  const locations = {
    Codex: roots.Codex || process.env.CODEX_HOME || join(homedir(), '.codex'),
    Claude: roots.Claude || process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'),
    Gemini: roots.Gemini || process.env.GROVE_GEMINI_HOME || join(homedir(), '.gemini'),
  };
  return async (enabled) => {
    const results = await Promise.all(
      DISCOVERY_PROVIDERS.map(async (provider) => {
        if (!enabled.includes(provider))
          return {
            provider,
            enabled: false,
            state: 'disabled',
            count: 0,
            detail: 'Local discovery is off.',
            sessions: [],
          };
        try {
          const result = await { Codex: codex, Claude: claude, Gemini: gemini }[provider](
            resolve(locations[provider]),
            now(),
          );
          return {
            provider,
            enabled: true,
            ...result,
            count: result.sessions.length,
            checkedAt: now(),
          };
        } catch (e) {
          return {
            provider,
            enabled: true,
            state: 'error',
            count: 0,
            detail:
              e.code === 'EACCES' || e.code === 'EPERM'
                ? 'Provider history is not readable. Check filesystem access.'
                : 'Unable to read this provider history format. Check the configured storage path and provider version.',
            sessions: [],
            checkedAt: now(),
          };
        }
      }),
    );
    const unique = new Map();
    for (const agent of results.flatMap((r) => r.sessions)) {
      if (!unique.has(agent.id) || unique.get(agent.id).updatedAt < agent.updatedAt)
        unique.set(agent.id, agent);
    }
    return {
      agents: [...unique.values()],
      providers: results.map(({ sessions, ...info }) => ({
        ...info,
        count: [...unique.values()].filter((a) => a.provider === info.provider).length,
      })),
    };
  };
}
