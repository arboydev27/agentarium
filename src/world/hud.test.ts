import { expect, it } from 'vitest';
import { initialAgents } from '../state';
import { districtAt, worldCounts } from './hud';
import { filterResidents, sessionKey } from '../sessions';
it('keeps counts and task filters aligned, including hidden and unseated work', () => {
  const agents = initialAgents().map((a, i) => ({
    ...a,
    sessionId: String(i),
    seat: i === 0 ? 8 : i,
  }));
  const counts = worldCounts(agents);
  for (const filter of ['working', 'completed', 'unknown', 'here'] as const) {
    expect(filterResidents(agents, [sessionKey(agents[0])], filter)).toHaveLength(counts[filter]);
  }
  expect(counts.working).toBe(3);
  expect(counts.here).toBe(7);
  expect(filterResidents(agents, [sessionKey(agents[0])], 'working')).toContain(agents[0]);
});
it('treats stale/paused activity as unknown without clearing reported attention', () => {
  const agents = initialAgents();
  agents[0].telemetryStale = true;
  expect(worldCounts(agents).unknown).toBe(1);
  const paused = worldCounts(agents, true);
  expect(paused.working).toBe(0);
  expect(paused.unknown).toBe(8);
  expect(paused.attention).toBe(1);
  expect(filterResidents(agents, [], 'unknown', '', true)).toHaveLength(8);
  expect(paused.here).toBe(8);
});
it('identifies focused districts, the central overview, and the outer horizon', () => {
  expect(districtAt(-7, -4.5)).toBe('café');
  expect(districtAt(7, 5)).toBe('garden');
  expect(districtAt(7, -5)).toBe('studio');
  expect(districtAt(-6, 5.5)).toBe('courtyard');
  expect(districtAt(0, 0)).toBe('overview');
  expect(districtAt(13.5, -38)).toBe('lookout');
  expect(districtAt(36, -70)).toBe('orchard');
  expect(districtAt(44, -70)).toBe('orchard');
  expect(districtAt(45, -70)).toBe('horizon');
  expect(districtAt(25, 0)).toBe('horizon');
  expect(districtAt(99, 99)).toBe('horizon');
});
