import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyPreferences,
  loadPreferences,
  parsePreferences,
  PREFERENCES_KEY,
} from './preferences';
import { useWorld, reduceAgentEvent } from './state';
import { seatLatestSessions, sessionKey } from './shared/live.mjs';
import { filterResidents } from './sessions';

const agent = (sessionId: string, timestamp = 1) =>
  reduceAgentEvent([], {
    id: sessionId,
    agentId: 'main',
    sessionId,
    provider: 'Codex',
    sequence: 1,
    timestamp,
    type: 'working',
  })[0];
const residents = () => Array.from({ length: 10 }, (_, i) => agent(`s${i}`, i + 1));
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  useWorld.setState({ sessionPreferences: emptyPreferences(), preferenceError: null });
  useWorld.getState().switchMode('live');
});
afterEach(() => vi.unstubAllGlobals());

describe('session choices and seating', () => {
  it('keeps an old pinned session seated across new arrivals without shifting survivors', () => {
    const records = residents();
    const preferences = { pinned: [sessionKey(records[0])], hidden: [] };
    const first = seatLatestSessions(records, [], preferences);
    const next = seatLatestSessions([...first, agent('new', 100)], first, preferences);
    expect(next.find((a) => a.sessionId === 's0')!.seat).toBeLessThan(8);
    expect(next.filter((a) => a.seat < 8)).toHaveLength(8);
    for (const survivor of next.filter((a) => a.seat < 8 && a.sessionId !== 'new'))
      expect(survivor.seat).toBe(first.find((a) => a.id === survivor.id)!.seat);
  });
  it('hides the entire session, including children, even when newer events arrive', () => {
    const records = residents();
    useWorld.getState().hydrate(records);
    const key = sessionKey(records[9]);
    useWorld.getState().changeSession(key, 'pin');
    useWorld.getState().select(records[9].id);
    useWorld.getState().changeSession(key, 'hide');
    useWorld.getState().ingest({
      id: 'child-event',
      agentId: 'child',
      sessionId: 's9',
      provider: 'Codex',
      parentId: 'main',
      sequence: 1,
      timestamp: 100,
      type: 'waiting',
    });
    const s = useWorld.getState();
    expect(s.sessionPreferences.pinned).not.toContain(key);
    expect(s.selected).toBeNull();
    expect(s.agents.filter((a) => sessionKey(a) === key).every((a) => a.seat === 8)).toBe(true);
    expect(filterResidents(s.agents, s.sessionPreferences.hidden, 'visible')).toHaveLength(9);
    expect(filterResidents(s.agents, s.sessionPreferences.hidden, 'attention')).toHaveLength(1);
    expect(filterResidents(s.agents, s.sessionPreferences.hidden, 'hidden')).toHaveLength(2);
    useWorld.getState().changeSession(key, 'restore');
    expect(useWorld.getState().agents.find((a) => a.id === records[9].id)!.seat).toBeLessThan(8);
    expect(useWorld.getState().sessionPreferences.pinned).not.toContain(key);
  });
  it('caps pins at eight and lets an absent pin be removed', () => {
    const records = residents();
    for (const a of records.slice(0, 8))
      expect(useWorld.getState().changeSession(sessionKey(a), 'pin')).toBeNull();
    expect(useWorld.getState().changeSession(sessionKey(records[8]), 'pin')).toContain(
      'eight pins',
    );
    useWorld.getState().hydrate(records.slice(8));
    expect(useWorld.getState().agents.filter((a) => a.seat < 8)).toHaveLength(2);
    useWorld.getState().changeSession(sessionKey(records[0]), 'unpin');
    expect(useWorld.getState().changeSession(sessionKey(records[8]), 'pin')).toBeNull();
  });
  it('restores choices from storage and applies them to reconnect snapshots without touching demo', () => {
    const records = residents();
    const key = sessionKey(records[9]);
    useWorld.getState().changeSession(key, 'hide');
    const restored = loadPreferences().preferences;
    useWorld.getState().switchMode('demo');
    const before = useWorld.getState().agents;
    expect(useWorld.getState().changeSession(key, 'restore')).toContain('live session');
    expect(useWorld.getState().agents).toBe(before);
    expect(before).toHaveLength(8);
    useWorld.getState().switchMode('live');
    useWorld.setState({ sessionPreferences: restored });
    useWorld.getState().hydrate(records);
    expect(useWorld.getState().agents.find((a) => a.id === records[9].id)!.seat).toBe(8);
    expect(JSON.parse(storage.get(PREFERENCES_KEY)!)).toEqual(restored);
  });
  it('includes hidden and off-screen failures in attention without changing seating', () => {
    const records = residents().map((a, i) => ({
      ...a,
      status: i === 0 || i === 9 ? ('failed' as const) : a.status,
    }));
    const hidden = [sessionKey(records[9])];
    const seated = seatLatestSessions(records, [], { pinned: [], hidden });
    expect(filterResidents(seated, hidden, 'attention').map((a) => a.sessionId)).toEqual([
      's9',
      's0',
    ]);
    expect(filterResidents(seated, hidden, 'attention').every((a) => a.seat === 8)).toBe(true);
  });
});

describe('preference storage resilience', () => {
  it('validates version, deduplicates keys, and gives hidden choices precedence', () => {
    const key = sessionKey(agent('shared'));
    expect(
      parsePreferences(
        JSON.stringify({ version: 1, pinned: [key, key, 'bad'], hidden: [key, null] }),
      ),
    ).toEqual({ version: 1, pinned: [], hidden: [key] });
    storage.set(PREFERENCES_KEY, '{broken');
    expect(loadPreferences().error).toBeTruthy();
    storage.set(PREFERENCES_KEY, JSON.stringify({ version: 2, pinned: [], hidden: [] }));
    expect(loadPreferences().preferences).toEqual(emptyPreferences());
  });
  it('continues in memory when browser storage fails and reports that choices are unsaved', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('Denied');
      },
    });
    expect(loadPreferences().error).toBeTruthy();
    useWorld.getState().changeSession(sessionKey(agent('one')), 'pin');
    expect(useWorld.getState().sessionPreferences.pinned).toHaveLength(1);
    expect(useWorld.getState().preferenceError).toContain('could not be saved');
  });
  it('does not save credentials, agent titles, or task text', () => {
    const a = { ...agent('one'), name: 'Private name', task: 'Private task' };
    useWorld.getState().hydrate([a]);
    useWorld.getState().changeSession(sessionKey(a), 'pin');
    expect(storage.get(PREFERENCES_KEY)).toBe(
      JSON.stringify({ version: 1, pinned: [sessionKey(a)], hidden: [] }),
    );
  });
});
