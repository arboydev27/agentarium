import { expect, it } from 'vitest';
import { initialAgents } from '../state';
import { districtAt, worldCounts } from './hud';
import { filterResidents, sessionKey } from '../sessions';
import { DAWNLIGHT_GLASSHOUSE } from './scenery/dawnlightPlacement';
import { AMBER_BLUFF } from './scenery/amberPlacement';
import { DESTINATIONS } from './navigation';
import { TRAIL_TURNOUTS, turnoutPoint } from './scenery/turnoutPlacement';
import { WINDWARD_MILL } from './scenery/windwardPlacement';
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
it('identifies named places and ordinary open terrain independently of the camera preset', () => {
  expect(districtAt(-7, -4.5)).toBe('café');
  expect(districtAt(7, 5)).toBe('garden');
  expect(districtAt(7, -5)).toBe('studio');
  expect(districtAt(-6, 5.5)).toBe('courtyard');
  expect(districtAt(0, 0)).toBe('overview');
  expect(districtAt(13.5, -38)).toBe('lookout');
  expect(districtAt(36, -70)).toBe('orchard');
  expect(districtAt(44, -70)).toBe('orchard');
  expect(districtAt(45, -70)).toBe('open-landscape');
  expect(districtAt(-30, -50)).toBe('observatory');
  expect(districtAt(-38, -50)).toBe('observatory');
  expect(districtAt(-39, -50)).toBe('open-landscape');
  expect(districtAt(-42, 43)).toBe('mere');
  expect(districtAt(-48, 45)).toBe('mere');
  expect(districtAt(-50, 43)).toBe('open-landscape');
  expect(districtAt(DAWNLIGHT_GLASSHOUSE.centerX, DAWNLIGHT_GLASSHOUSE.centerZ)).toBe('dawnlight');
  expect(districtAt(DAWNLIGHT_GLASSHOUSE.x, DAWNLIGHT_GLASSHOUSE.z)).toBe('dawnlight');
  expect(
    districtAt(
      DAWNLIGHT_GLASSHOUSE.centerX + DAWNLIGHT_GLASSHOUSE.focusRadius + 1,
      DAWNLIGHT_GLASSHOUSE.centerZ,
    ),
  ).toBe('open-landscape');
  expect(districtAt(WINDWARD_MILL.centerX, WINDWARD_MILL.centerZ)).toBe('windward');
  expect(districtAt(WINDWARD_MILL.x, WINDWARD_MILL.z)).toBe('windward');
  expect(
    districtAt(WINDWARD_MILL.centerX - WINDWARD_MILL.focusRadius - 1, WINDWARD_MILL.centerZ),
  ).toBe('open-landscape');
  expect(districtAt(AMBER_BLUFF.x, AMBER_BLUFF.z)).toBe('amber');
  expect(districtAt(AMBER_BLUFF.x + AMBER_BLUFF.focusRadius - 1, AMBER_BLUFF.z)).toBe('amber');
  expect(districtAt(AMBER_BLUFF.x + AMBER_BLUFF.focusRadius + 1, AMBER_BLUFF.z)).toBe(
    'open-landscape',
  );
  expect(DESTINATIONS.some((destination) => destination.id === AMBER_BLUFF.id)).toBe(false);
  expect(districtAt(0, -50)).toBe('open-landscape');
  for (const turnout of TRAIL_TURNOUTS) {
    const [x, , z] = turnoutPoint(turnout.trailIndex, turnout.side, 4.8);
    expect(districtAt(x, z)).toBe(turnout.id);
  }
  expect(districtAt(25, 0)).toBe('open-landscape');
  expect(districtAt(99, 99)).toBe('open-landscape');
});
