import { describe, expect, it } from 'vitest';
import { agentKey, normalizeAgent, reduceAgentEvent } from './shared/protocol.mjs';
import { mergeSessions, seatLatestSessions } from './shared/live.mjs';
import { useWorld } from './state';
import type { Agent, Provider } from './state';
function agent(sessionId: string, updatedAt: number, provider: Provider = 'Codex'): Agent {
  return reduceAgentEvent([], {
    id: sessionId,
    sessionId,
    agentId: 'main',
    sequence: 1,
    timestamp: updatedAt,
    type: 'working',
    provider,
  })[0];
}

describe('latest eight live sessions', () => {
  it('replaces the oldest session while preserving every surviving seat', () => {
    const initial = seatLatestSessions(Array.from({ length: 8 }, (_, i) => agent(`s${i}`, i + 1)));
    const next = seatLatestSessions([...initial, agent('new', 100)], initial);
    expect(next.filter((a) => a.seat < 8)).toHaveLength(8);
    expect(next.find((a) => a.sessionId === 's0')?.seat).toBe(8);
    expect(next.find((a) => a.sessionId === 'new')?.seat).toBe(
      initial.find((a) => a.sessionId === 's0')?.seat,
    );
    for (const old of initial.filter((a) => a.sessionId !== 's0'))
      expect(next.find((a) => a.id === old.id)?.seat).toBe(old.seat);
    const resurfaced = seatLatestSessions(
      next.map((a) => (a.sessionId === 's0' ? { ...a, updatedAt: 200 } : a)),
      next,
    );
    expect(resurfaced.find((a) => a.sessionId === 's0')!.seat).toBeLessThan(8);
    expect(new Set(resurfaced.filter((a) => a.seat < 8).map((a) => a.seat)).size).toBe(8);
  });
  it('uses one seat per session and counts child activity for recency', () => {
    const main = agent('shared', 1);
    const child = {
      ...agent('shared', 100),
      id: agentKey('Codex', 'shared', 'child'),
      agentId: 'child',
      parentId: main.id,
    };
    const next = seatLatestSessions([
      main,
      child,
      ...Array.from({ length: 8 }, (_, i) => agent(`s${i}`, i + 2)),
    ]);
    expect(next.find((a) => a.id === main.id)!.seat).toBeLessThan(8);
    expect(next.find((a) => a.id === child.id)!.seat).toBe(8);
  });
  it('separates providers and separator-containing IDs', () => {
    const one = agent('shared', 1, 'Codex'),
      two = agent('shared', 2, 'Claude');
    expect(one.id).not.toBe(two.id);
    expect(seatLatestSessions([one, two]).filter((a) => a.seat < 8)).toHaveLength(2);
    expect(agentKey('Codex', 'a:b', 'c')).not.toBe(agentKey('Codex', 'a', 'b:c'));
  });
  it('preserves event ordering when discovery matches a telemetry resident', () => {
    const live = { ...agent('same', 20), sequence: 99, status: 'waiting' as const };
    const found = {
      ...agent('same', 30),
      evidence: 'history' as const,
      observedAt: undefined,
      sequence: -1,
      status: 'unknown' as const,
      name: 'Session title',
    };
    const [merged] = mergeSessions([live], [found]);
    expect(merged.status).toBe('waiting');
    expect(merged.sequence).toBe(99);
    expect(merged.updatedAt).toBe(30);
    expect(merged.name).toBe('Session title');
    expect(
      mergeSessions([live], [{ ...found, observedAt: 40, updatedAt: 40, status: 'completed' }])[0]
        .status,
    ).toBe('completed');
  });
  it('upgrades old snapshot identities without losing parent/session metadata', () => {
    const old = { ...agent('old', 1), id: 'old:child', agentId: undefined, parentId: 'old:main' };
    const migrated = normalizeAgent(old);
    expect(migrated.id).toBe(agentKey('Codex', 'old', 'child'));
    expect(migrated.parentId).toBe(agentKey('Codex', 'old', 'main'));
    expect(normalizeAgent(migrated)).toEqual(migrated);
  });
  it('does not turn discovery refreshes into new hook events or mutate the demo', () => {
    useWorld.getState().switchMode('live');
    useWorld.getState().syncSessions([agent('discovered', 1)]);
    expect(useWorld.getState().receivedEvents).toBe(0);
    expect(useWorld.getState().events).toHaveLength(0);
    useWorld.getState().switchMode('demo');
    const demo = useWorld.getState().agents;
    useWorld.getState().syncSessions([agent('discovered', 2)]);
    expect(useWorld.getState().agents).toBe(demo);
    expect(demo).toHaveLength(8);
    expect(demo.every((a) => a.source === 'demo')).toBe(true);
  });
});
