import { describe, expect, it } from 'vitest';
import { initialAgents } from '../state';
import { LOOKOUT, OBSERVATORY, ORCHARD, SEATS, WORLD } from './layout';
import { DESTINATIONS, NODES, EDGES, planRoute, NavigationTraffic } from './navigation';
import { ResidentJourney } from './journey';
import { residentStyle, ACCESSORIES } from './personality';
import {
  LANDSCAPE_SEGMENTS,
  LANDSCAPE_SIZE,
  SOUTHWIND_WATER_Y,
  meadowTrailPoint,
  renderedTerrainHeight,
  terrainHeight,
  walkwayHeight,
} from './terrain';
import {
  SOUTHWIND_MERE,
  clearOfSouthwindMere,
  distanceToSouthwindMere,
  waterRadiusAt,
} from './scenery/merePlacement';
import { TRAIL_TURNOUTS, turnoutPoint } from './scenery/turnoutPlacement';
import {
  NORTHSTAR_BRANCH,
  NORTHSTAR_OUTPOST,
  NORTHSTAR_TOWER_XZ,
  NORTHSTAR_TRAIL_XZ,
  clearOfNorthstarStructure,
  clearOfNorthstarTrail,
} from './scenery/northstarPlacement';
import {
  WOODLAND_BRANCH,
  WOODLAND_HOLLOW,
  WOODLAND_SHELTER_XZ,
  WOODLAND_TRAIL_XZ,
  clearOfWoodlandHollow,
  clearOfWoodlandShelter,
} from './scenery/woodlandPlacement';
import { SOUTHWIND_SHORE, SOUTHWIND_TRAIL_XZ } from './scenery/southwindTrailPlacement';
import {
  DAWNLIGHT_GLASSHOUSE,
  EAST_TRAIL_XZ,
  clearOfDawnlightTrail,
} from './scenery/dawnlightPlacement';
import {
  WINDWARD_BRANCH_XZ,
  WINDWARD_DAWNLIGHT_BRANCH_INDEX,
  WINDWARD_MILL,
  WINDWARD_TRAIL_XZ,
  clearOfWindwardTrail,
} from './scenery/windwardPlacement';
const options = { reduced: false, playing: true, leaving: false, now: 10000, outings: true };
const agent = (seat = 0, status: ReturnType<typeof initialAgents>[number]['status'] = 'idle') => ({
  ...initialAgents()[seat],
  status,
  updatedAt: 10000,
});
function advance(motion: ResidentJourney, a = agent(), seconds = 1, overrides = {}) {
  for (let i = 0; i < seconds * 60; i++) motion.update(a, 1 / 60, { ...options, ...overrides });
}

describe('navigation graph', () => {
  it('keeps promenade resting terminal and the shared east trail free for through traffic', () => {
    const rest = DESTINATIONS.find((destination) => destination.id === 'promenade');
    expect(rest?.node).toBe('promenade-rest');
    expect(EDGES.filter(([from, to]) => from === rest?.node || to === rest?.node)).toHaveLength(1);
    expect(
      Math.hypot(
        NODES.promenade[0] - NODES['promenade-rest'][0],
        NODES.promenade[2] - NODES['promenade-rest'][2],
      ),
    ).toBeGreaterThan(1.4);
    expect(planRoute('home-0', WINDWARD_MILL.id).ids).not.toContain(rest?.node);
    expect(planRoute('home-0', DAWNLIGHT_GLASSHOUSE.id).ids).not.toContain(rest?.node);
    for (const [from, to] of EDGES) {
      if (from === 'promenade-rest' || to === 'promenade-rest') continue;
      const a = NODES[from],
        b = NODES[to];
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        expect(
          Math.hypot(
            NODES['promenade-rest'][0] - a[0] - (b[0] - a[0]) * t,
            NODES['promenade-rest'][2] - a[2] - (b[2] - a[2]) * t,
          ),
          `${from} → ${to} near promenade rest`,
        ).toBeGreaterThan(0.8);
      }
    }
  });
  it('connects Lantern Hollow as a terminal spur with reversible, terrain-clear chords', () => {
    expect(WOODLAND_BRANCH[0]).toEqual([-27, -50]);
    expect(WOODLAND_TRAIL_XZ[0]).toEqual([-27, -50]);
    expect(WOODLAND_TRAIL_XZ.at(-1)).toEqual([WOODLAND_HOLLOW.x, WOODLAND_HOLLOW.z]);
    expect(clearOfWoodlandHollow(-55, -29)).toBe(false);
    expect(clearOfWoodlandShelter(...WOODLAND_SHELTER_XZ)).toBe(false);
    expect(clearOfWoodlandShelter(WOODLAND_HOLLOW.x, WOODLAND_HOLLOW.z)).toBe(true);
    expect(
      Math.hypot(
        WOODLAND_SHELTER_XZ[0] - WOODLAND_HOLLOW.x,
        WOODLAND_SHELTER_XZ[1] - WOODLAND_HOLLOW.z,
      ),
    ).toBeGreaterThan(WOODLAND_HOLLOW.clearingRadius);
    expect(clearOfWoodlandHollow(WOODLAND_HOLLOW.x, WOODLAND_HOLLOW.z)).toBe(false);
    expect(clearOfWoodlandHollow(-55, -15)).toBe(true);
    expect(
      EDGES.filter(([a, b]) => a === WOODLAND_HOLLOW.id || b === WOODLAND_HOLLOW.id),
    ).toHaveLength(1);
    for (let seat = 0; seat < 8; seat++) {
      const outward = planRoute(`home-${seat}`, WOODLAND_HOLLOW.id);
      expect(outward.ids).toContain('observatory:branch-8');
      expect(outward.ids.at(-1)).toBe(WOODLAND_HOLLOW.id);
      expect(outward.ids).not.toContain('observatory:cedar');
      expect(planRoute(WOODLAND_HOLLOW.id, `home-${seat}`).points).toEqual(
        [...outward.points].reverse(),
      );
    }
    let highestWoodlandGrade = 0;
    for (const [start, end] of EDGES) {
      if (!start.startsWith('woodland:') && !end.startsWith('woodland:')) continue;
      const from = NODES[start],
        to = NODES[end];
      const horizontal = Math.hypot(to[0] - from[0], to[2] - from[2]);
      expect(horizontal, `${start} → ${end} length`).toBeLessThan(2.1);
      highestWoodlandGrade = Math.max(highestWoodlandGrade, Math.abs(to[1] - from[1]) / horizontal);
      expect(Math.abs(to[1] - from[1]) / horizontal, `${start} → ${end} grade`).toBeLessThan(0.38);
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const x = from[0] + (to[0] - from[0]) * t;
        const y = from[1] + (to[1] - from[1]) * t;
        const z = from[2] + (to[2] - from[2]) * t;
        expect(
          Math.hypot(x - WOODLAND_SHELTER_XZ[0], z - WOODLAND_SHELTER_XZ[1]),
          `${start} → ${end} shelter clearance`,
        ).toBeGreaterThan(4.8 + 0.8);
        const clearance = y - renderedTerrainHeight(x, z);
        expect(clearance, `${start} → ${end} at ${t}`).toBeGreaterThan(0.015);
        expect(clearance, `${start} → ${end} at ${t}`).toBeLessThan(0.24);
      }
    }
    expect(highestWoodlandGrade).toBeLessThan(0.38);
  });
  it('connects Northstar Outpost from the orchard approach on safe, reversible terrain chords', () => {
    expect(NORTHSTAR_BRANCH[0]).toEqual([
      NODES['orchard:branch-3'][0],
      NODES['orchard:branch-3'][2],
    ]);
    expect(NORTHSTAR_TRAIL_XZ.at(-1)).toEqual([NORTHSTAR_OUTPOST.x, NORTHSTAR_OUTPOST.z]);
    expect(clearOfNorthstarTrail(30, -94)).toBe(false);
    expect(clearOfNorthstarTrail(NORTHSTAR_OUTPOST.x, NORTHSTAR_OUTPOST.z)).toBe(false);
    expect(clearOfNorthstarTrail(65, -94)).toBe(true);
    expect(clearOfNorthstarStructure(...NORTHSTAR_TOWER_XZ)).toBe(false);
    expect(clearOfNorthstarStructure(NORTHSTAR_OUTPOST.x, NORTHSTAR_OUTPOST.z)).toBe(true);
    expect(
      EDGES.filter(([a, b]) => a === NORTHSTAR_OUTPOST.id || b === NORTHSTAR_OUTPOST.id),
    ).toHaveLength(1);
    for (let seat = 0; seat < 8; seat++) {
      const outward = planRoute(`home-${seat}`, NORTHSTAR_OUTPOST.id);
      expect(outward.ids).toContain('orchard:branch-3');
      expect(outward.ids).not.toContain('orchard:commons');
      expect(outward.ids.at(-1)).toBe(NORTHSTAR_OUTPOST.id);
      expect(planRoute(NORTHSTAR_OUTPOST.id, `home-${seat}`).points).toEqual(
        [...outward.points].reverse(),
      );
    }
    let highestGrade = 0;
    for (const [start, end] of EDGES) {
      if (!start.startsWith('northstar:') && !end.startsWith('northstar:')) continue;
      const from = NODES[start],
        to = NODES[end];
      const horizontal = Math.hypot(to[0] - from[0], to[2] - from[2]);
      expect(horizontal, `${start} → ${end} length`).toBeLessThan(1.85);
      highestGrade = Math.max(highestGrade, Math.abs(to[1] - from[1]) / horizontal);
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const x = from[0] + (to[0] - from[0]) * t;
        const y = from[1] + (to[1] - from[1]) * t;
        const z = from[2] + (to[2] - from[2]) * t;
        const clearance = y - renderedTerrainHeight(x, z);
        expect(clearance, `${start} → ${end} at ${t}`).toBeGreaterThan(0.015);
        expect(clearance, `${start} → ${end} at ${t}`).toBeLessThan(0.24);
        expect(Math.hypot(x - ORCHARD.x, z - ORCHARD.z)).toBeGreaterThan(
          ORCHARD.clearingRadius + 1,
        );
        expect(Math.hypot(x - NORTHSTAR_TOWER_XZ[0], z - NORTHSTAR_TOWER_XZ[1])).toBeGreaterThan(
          4.5 + 0.8,
        );
      }
    }
    expect(highestGrade).toBeLessThan(0.35);
  });
  it('connects Windward Mill on a clear branch of the Dawnlight trail for all seats', () => {
    const anchor = `dawnlight:trail-${WINDWARD_DAWNLIGHT_BRANCH_INDEX}`;
    expect(WINDWARD_BRANCH_XZ[0]).toEqual(EAST_TRAIL_XZ[WINDWARD_DAWNLIGHT_BRANCH_INDEX]);
    expect(WINDWARD_TRAIL_XZ[0]).toEqual([NODES.promenade[0], NODES.promenade[2]]);
    expect(WINDWARD_TRAIL_XZ.at(-1)).toEqual([WINDWARD_MILL.x, WINDWARD_MILL.z]);
    expect(clearOfWindwardTrail(WINDWARD_MILL.centerX, WINDWARD_MILL.centerZ)).toBe(false);
    expect(clearOfWindwardTrail(52, 30)).toBe(true);
    expect(DESTINATIONS.some((destination) => destination.id === WINDWARD_MILL.id)).toBe(true);
    expect(
      EDGES.filter(([from, to]) => from === WINDWARD_MILL.id || to === WINDWARD_MILL.id),
    ).toHaveLength(1);
    for (let seat = 0; seat < 8; seat++) {
      const outward = planRoute(`home-${seat}`, WINDWARD_MILL.id);
      expect(outward.ids).toContain('promenade');
      expect(outward.ids).toContain(anchor);
      expect(outward.ids.at(-1)).toBe(WINDWARD_MILL.id);
      expect(outward.ids).not.toContain(DAWNLIGHT_GLASSHOUSE.id);
      expect(planRoute(WINDWARD_MILL.id, `home-${seat}`).points).toEqual(
        [...outward.points].reverse(),
      );
    }
    for (const [start, end] of EDGES) {
      if (!start.startsWith('windward:') && !end.startsWith('windward:')) continue;
      const from = NODES[start],
        to = NODES[end];
      const horizontal = Math.hypot(to[0] - from[0], to[2] - from[2]);
      expect(horizontal).toBeLessThan(2.2);
      expect(Math.abs(to[1] - from[1]) / horizontal, `${start} → ${end} grade`).toBeLessThan(0.35);
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const x = from[0] + (to[0] - from[0]) * t;
        const y = from[1] + (to[1] - from[1]) * t;
        const z = from[2] + (to[2] - from[2]) * t;
        const clearance = y - renderedTerrainHeight(x, z);
        expect(clearance, `${start} → ${end} at ${t}`).toBeGreaterThan(0.015);
        expect(clearance, `${start} → ${end} at ${t}`).toBeLessThan(0.24);
        expect(
          Math.hypot(x - WINDWARD_MILL.centerX, z - WINDWARD_MILL.centerZ),
          `${start} → ${end} mill footprint`,
        ).toBeGreaterThan(WINDWARD_MILL.footprintRadius + 0.8);
      }
    }
  });
  it('connects Dawnlight Glasshouse by a distinct reversible east trail with clear terrain chords', () => {
    expect(EAST_TRAIL_XZ[0]).toEqual([NODES.promenade[0], NODES.promenade[2]]);
    expect(EAST_TRAIL_XZ.at(-1)).toEqual([DAWNLIGHT_GLASSHOUSE.x, DAWNLIGHT_GLASSHOUSE.z]);
    expect(clearOfDawnlightTrail(DAWNLIGHT_GLASSHOUSE.centerX, DAWNLIGHT_GLASSHOUSE.centerZ)).toBe(
      false,
    );
    expect(clearOfDawnlightTrail(26, 2)).toBe(true);
    expect(DESTINATIONS.some((destination) => destination.id === DAWNLIGHT_GLASSHOUSE.id)).toBe(
      true,
    );
    expect(
      EDGES.filter(([a, b]) => a === DAWNLIGHT_GLASSHOUSE.id || b === DAWNLIGHT_GLASSHOUSE.id),
    ).toHaveLength(1);
    for (let seat = 0; seat < 8; seat++) {
      const outward = planRoute(`home-${seat}`, DAWNLIGHT_GLASSHOUSE.id);
      expect(outward.ids).toContain('promenade');
      expect(outward.ids.at(-1)).toBe(DAWNLIGHT_GLASSHOUSE.id);
      expect(planRoute(DAWNLIGHT_GLASSHOUSE.id, `home-${seat}`).points).toEqual(
        [...outward.points].reverse(),
      );
    }
    for (const [start, end] of EDGES) {
      if (!start.startsWith('dawnlight:') && !end.startsWith('dawnlight:')) continue;
      const from = NODES[start],
        to = NODES[end];
      const horizontal = Math.hypot(to[0] - from[0], to[2] - from[2]);
      expect(horizontal).toBeLessThan(2.2);
      expect(Math.abs(to[1] - from[1]) / horizontal, `${start} → ${end} grade`).toBeLessThan(0.35);
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const x = from[0] + (to[0] - from[0]) * t;
        const y = from[1] + (to[1] - from[1]) * t;
        const z = from[2] + (to[2] - from[2]) * t;
        const clearance = y - renderedTerrainHeight(x, z);
        expect(clearance, `${start} → ${end} at ${t}`).toBeGreaterThan(0.015);
        expect(clearance, `${start} → ${end} at ${t}`).toBeLessThan(0.24);
      }
    }
    const distanceToEdge = (
      x: number,
      z: number,
      from: (typeof NODES)[string],
      to: (typeof NODES)[string],
    ) => {
      const dx = to[0] - from[0],
        dz = to[2] - from[2];
      const length = dx * dx + dz * dz;
      const t = length
        ? Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[2]) * dz) / length))
        : 0;
      return Math.hypot(x - from[0] - t * dx, z - from[2] - t * dz);
    };
    for (const [start, end] of EDGES) {
      if (
        start.startsWith('dawnlight:') ||
        end.startsWith('dawnlight:') ||
        start.startsWith('windward:') ||
        end.startsWith('windward:') ||
        end === 'promenade-rest' ||
        end === 'promenade'
      )
        continue;
      for (let index = 1; index < EAST_TRAIL_XZ.length; index++) {
        const from = EAST_TRAIL_XZ[index - 1];
        const to = EAST_TRAIL_XZ[index];
        for (let sample = 1; sample <= 4; sample++) {
          const t = sample / 4;
          const x = from[0] + (to[0] - from[0]) * t;
          const z = from[1] + (to[1] - from[1]) * t;
          expect(
            distanceToEdge(x, z, NODES[start], NODES[end]),
            `${start} → ${end} near Dawnlight`,
          ).toBeGreaterThan(0.8);
        }
      }
    }
  });
  it('releases the common hub before Dawnlight and meadow trips run independently', () => {
    const traffic = new NavigationTraffic();
    const east = planRoute('home-0', DAWNLIGHT_GLASSHOUSE.id);
    const meadow = planRoute('home-1', 'meadow:lookout');
    expect(traffic.acquire('east', east.ids)).toBe(true);
    expect(traffic.acquire('meadow', meadow.ids)).toBe(false);
    traffic.releasePassed('east', east.lengths[east.ids.indexOf('dawnlight:trail-2')] + 1);
    expect(traffic.acquire('meadow', meadow.ids)).toBe(true);
    expect(traffic.acquire('east', east.ids, true)).toBe(false);
    expect(traffic.acquire('third', planRoute('home-2', DAWNLIGHT_GLASSHOUSE.id).ids)).toBe(false);
    traffic.release('meadow');
    expect(traffic.acquire('east', east.ids, true)).toBe(true);
  });
  it('keeps Windward and Dawnlight exclusive at their fork, then prioritizes return', () => {
    const traffic = new NavigationTraffic();
    const mill = planRoute('home-0', WINDWARD_MILL.id);
    const glasshouse = planRoute('home-1', DAWNLIGHT_GLASSHOUSE.id);
    expect(traffic.reserveDestination('mill', WINDWARD_MILL.id)).toBe(true);
    expect(traffic.reserveDestination('another', WINDWARD_MILL.id)).toBe(false);
    expect(traffic.acquire('mill', mill.ids)).toBe(true);
    expect(traffic.acquire('glasshouse', glasshouse.ids)).toBe(false);
    traffic.releasePassed('mill', mill.lengths[mill.ids.indexOf('windward:branch-8')] + 1);
    expect(traffic.acquire('glasshouse', glasshouse.ids)).toBe(true);
    expect(traffic.acquire('mill', mill.ids, true)).toBe(false);
    expect(traffic.acquire('third', planRoute('home-2', WINDWARD_MILL.id).ids)).toBe(false);
    traffic.release('glasshouse');
    expect(traffic.acquire('mill', mill.ids, true)).toBe(true);
  });
  it('connects both trail turnouts as clear terminal branches for every seat', () => {
    for (const turnout of TRAIL_TURNOUTS) {
      const approach = `${turnout.id}:approach`;
      expect(DESTINATIONS.some((destination) => destination.id === turnout.id)).toBe(true);
      expect(NODES[approach]).toEqual([...turnoutPoint(turnout.trailIndex, turnout.side, 2.5)]);
      expect(NODES[turnout.id]).toEqual([...turnoutPoint(turnout.trailIndex, turnout.side, 4.8)]);
      expect(EDGES.filter(([a, b]) => a === turnout.id || b === turnout.id)).toHaveLength(1);
      for (let seat = 0; seat < 8; seat++) {
        const outward = planRoute(`home-${seat}`, turnout.id);
        expect(outward.ids.slice(-3)).toEqual([
          `meadow:trail-${turnout.trailIndex}`,
          approach,
          turnout.id,
        ]);
        const home = planRoute(turnout.id, `home-${seat}`);
        expect(home.points).toEqual([...outward.points].reverse());
      }
      for (const [start, end] of [
        [`meadow:trail-${turnout.trailIndex}`, approach],
        [approach, turnout.id],
      ]) {
        const a = NODES[start],
          b = NODES[end];
        for (let step = 0; step <= 40; step++) {
          const t = step / 40;
          const x = a[0] + (b[0] - a[0]) * t;
          const y = a[1] + (b[1] - a[1]) * t;
          const z = a[2] + (b[2] - a[2]) * t;
          const clearance = y - renderedTerrainHeight(x, z);
          expect(clearance, `${start} → ${end} at ${t}`).toBeGreaterThan(0.015);
          expect(clearance, `${start} → ${end} at ${t}`).toBeLessThan(0.22);
        }
      }
    }
  });
  it('keeps turnout resting pads clear of existing walking lanes', () => {
    const distanceToEdge = (
      x: number,
      z: number,
      from: (typeof NODES)[string],
      to: (typeof NODES)[string],
    ) => {
      const dx = to[0] - from[0],
        dz = to[2] - from[2];
      const length = dx * dx + dz * dz;
      const t = length
        ? Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[2]) * dz) / length))
        : 0;
      return Math.hypot(x - from[0] - t * dx, z - from[2] - t * dz);
    };
    for (const turnout of TRAIL_TURNOUTS) {
      const center = NODES[turnout.id];
      for (const [start, end] of EDGES) {
        if (start.startsWith(turnout.id) || end.startsWith(turnout.id)) continue;
        expect(
          distanceToEdge(center[0], center[2], NODES[start], NODES[end]),
          `${turnout.id} overlaps ${start} → ${end}`,
        ).toBeGreaterThan(0.8);
      }
    }
  });
  it('keeps the southern water above its basin and the shore trail dry', () => {
    for (let step = 0; step < 36; step++) {
      const angle = (step / 36) * Math.PI * 2;
      for (let radius = 0; radius <= waterRadiusAt(angle); radius += 0.5) {
        const x = SOUTHWIND_MERE.x + Math.cos(angle) * radius;
        const z = SOUTHWIND_MERE.z + Math.sin(angle) * radius;
        expect(renderedTerrainHeight(x, z)).toBeLessThan(SOUTHWIND_WATER_Y - 0.01);
      }
      const x = SOUTHWIND_MERE.x + Math.cos(angle) * 8.5;
      const z = SOUTHWIND_MERE.z + Math.sin(angle) * 8.5;
      const inside = terrainHeight(x - Math.cos(angle) * 0.001, z - Math.sin(angle) * 0.001);
      const outside = terrainHeight(x + Math.cos(angle) * 0.001, z + Math.sin(angle) * 0.001);
      expect(Math.abs(inside - outside)).toBeLessThan(0.02);
    }
    for (const [start, end] of EDGES) {
      for (const id of [start, end])
        if (!id.startsWith('southwind:'))
          expect(clearOfSouthwindMere(NODES[id][0], NODES[id][2])).toBe(true);
      if (![start, end].some((id) => id.startsWith('southwind:'))) continue;
      const a = NODES[start],
        b = NODES[end];
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[2] + (b[2] - a[2]) * t;
        const angle = Math.atan2(z - SOUTHWIND_MERE.z, x - SOUTHWIND_MERE.x);
        expect(distanceToSouthwindMere(x, z)).toBeGreaterThan(waterRadiusAt(angle) + 1.5);
      }
    }
  });
  it('connects every seat to the dry Southwind shore on the authored centerline', () => {
    expect(SOUTHWIND_TRAIL_XZ[0]).toEqual([-6.2, 7.7]);
    expect(SOUTHWIND_TRAIL_XZ.at(-1)).toEqual([SOUTHWIND_SHORE.x, SOUTHWIND_SHORE.z]);
    expect(
      EDGES.filter(([a, b]) => a === SOUTHWIND_SHORE.id || b === SOUTHWIND_SHORE.id),
    ).toHaveLength(1);
    for (let seat = 0; seat < 8; seat++) {
      const route = planRoute(`home-${seat}`, SOUTHWIND_SHORE.id);
      expect(route.ids.at(-1)).toBe(SOUTHWIND_SHORE.id);
      expect(route.ids).toContain('court-front');
      expect(planRoute(SOUTHWIND_SHORE.id, `home-${seat}`).points).toEqual(
        [...route.points].reverse(),
      );
    }
  });
  it('samples the actual coarse landscape triangles at vertices and within both faces', () => {
    const step = LANDSCAPE_SIZE / LANDSCAPE_SEGMENTS;
    const x0 = -LANDSCAPE_SIZE / 2 + 67 * step;
    const z0 = -LANDSCAPE_SIZE / 2 + 55 * step;
    const h00 = terrainHeight(x0, z0);
    const h10 = terrainHeight(x0 + step, z0);
    const h01 = terrainHeight(x0, z0 + step);
    const h11 = terrainHeight(x0 + step, z0 + step);
    expect(renderedTerrainHeight(x0, z0)).toBeCloseTo(h00);
    expect(renderedTerrainHeight(x0 + step * 0.2, z0 + step * 0.3)).toBeCloseTo(
      h00 + 0.2 * (h10 - h00) + 0.3 * (h01 - h00),
    );
    expect(renderedTerrainHeight(x0 + step * 0.7, z0 + step * 0.6)).toBeCloseTo(
      h11 + 0.3 * (h01 - h11) + 0.4 * (h10 - h11),
    );
    expect(walkwayHeight(x0, z0, 0.045)).toBeCloseTo(h00 + 0.045);
  });
  it('keeps every outside route chord above the rendered landscape without high floating', () => {
    let min = Infinity,
      max = -Infinity,
      minAt = '',
      maxAt = '';
    for (const [start, end] of EDGES) {
      if (
        ![start, end].some(
          (id) =>
            id.startsWith('meadow:') ||
            id.startsWith('orchard:') ||
            id.startsWith('observatory:') ||
            id.startsWith('woodland:') ||
            id.startsWith('northstar:') ||
            id.startsWith('southwind:'),
        )
      )
        continue;
      const from = NODES[start],
        to = NODES[end];
      for (let step = 0; step <= 50; step++) {
        const t = step / 50;
        const x = from[0] + (to[0] - from[0]) * t;
        const y = from[1] + (to[1] - from[1]) * t;
        const z = from[2] + (to[2] - from[2]) * t;
        const c = y - renderedTerrainHeight(x, z);
        if (c < min) {
          min = c;
          minAt = `${start} → ${end} at ${t.toFixed(2)}`;
        }
        if (c > max) {
          max = c;
          maxAt = `${start} → ${end} at ${t.toFixed(2)}`;
        }
      }
    }
    expect(min, minAt).toBeGreaterThan(0.015);
    expect(max, maxAt).toBeLessThan(0.22);
  });
  it('connects every seat to every destination with reversible, bounded routes', () => {
    for (let seat = 0; seat < 8; seat++)
      for (const destination of DESTINATIONS) {
        const route = planRoute(`home-${seat}`, destination.node);
        expect(route.points[0]).toEqual(NODES[`home-${seat}`]);
        expect(planRoute(destination.node, `home-${seat}`).points).toEqual(
          [...route.points].reverse(),
        );
        expect(route.lengths.at(-1)).toBeGreaterThan(0);
        for (const [index, [x, y, z]] of route.points.entries()) {
          if (
            route.ids[index].startsWith('meadow:') ||
            route.ids[index].startsWith('orchard:') ||
            route.ids[index].startsWith('observatory:') ||
            route.ids[index].startsWith('woodland:') ||
            route.ids[index].startsWith('northstar:') ||
            route.ids[index].startsWith('southwind:') ||
            route.ids[index].startsWith('dawnlight:') ||
            route.ids[index].startsWith('windward:')
          ) {
            if (
              !route.ids[index].startsWith('southwind:') &&
              !route.ids[index].startsWith('dawnlight:') &&
              !route.ids[index].startsWith('windward:')
            )
              expect(z).toBeLessThan(-10);
            expect(y - renderedTerrainHeight(x, z)).toBeGreaterThanOrEqual(0.04);
            expect(y - renderedTerrainHeight(x, z)).toBeLessThanOrEqual(0.22);
            continue;
          }
          expect(Math.abs(x)).toBeLessThan(WORLD.width / 2);
          expect(Math.abs(z)).toBeLessThan(WORLD.depth / 2);
          expect(y).toBeGreaterThanOrEqual(0.4);
          expect(y).toBeLessThanOrEqual(1.1);
        }
      }
  });
  it('follows the meadow trail and stays above its terrain through the lookout branch', () => {
    const route = planRoute('center', 'meadow:lookout');
    expect(route.ids[0]).toBe('center');
    for (let index = 0; index <= 12; index++) {
      const node = `meadow:trail-${index}`;
      expect(route.ids).toContain(node);
      const trail = meadowTrailPoint(index);
      expect(NODES[node][0]).toBe(trail[0]);
      expect(NODES[node][2]).toBe(trail[2]);
      expect(NODES[node][1] - trail[1]).toBeCloseTo(0.025);
    }
    expect(route.ids.at(-1)).toBe('meadow:lookout');
    expect(NODES['meadow:lookout'][0]).toBe(LOOKOUT.x);
    expect(NODES['meadow:lookout'][2]).toBe(LOOKOUT.z);
    let lowestClearance = Infinity,
      highestClearance = -Infinity,
      lowestAt = '',
      closestPost = Infinity;
    for (let index = 1; index < route.points.length; index++) {
      const from = route.points[index - 1],
        to = route.points[index];
      for (let step = 0; step <= 10; step++) {
        const t = step / 10,
          x = from[0] + (to[0] - from[0]) * t,
          y = from[1] + (to[1] - from[1]) * t,
          z = from[2] + (to[2] - from[2]) * t;
        const clearance = y - renderedTerrainHeight(x, z);
        if (clearance < lowestClearance) {
          lowestClearance = clearance;
          lowestAt = `${route.ids[index - 1]} → ${route.ids[index]} at ${t}`;
        }
        highestClearance = Math.max(highestClearance, clearance);
        if (route.ids[index].startsWith('meadow:branch') || route.ids[index] === 'meadow:lookout')
          for (const postX of [-2.35, 2.35])
            for (const postZ of [-2.2, 2.2])
              closestPost = Math.min(
                closestPost,
                Math.hypot(x - LOOKOUT.x - postX, z - LOOKOUT.z - postZ),
              );
      }
    }
    expect(lowestClearance, lowestAt).toBeGreaterThan(0.01);
    expect(highestClearance).toBeLessThan(0.22);
    expect(closestPost).toBeGreaterThan(0.65);
  });
  it('branches to Orchard Commons after trail sample 22 without changing the lookout route', () => {
    const orchard = planRoute('center', 'orchard:commons'),
      lookout = planRoute('center', 'meadow:lookout');
    expect(orchard.ids).toContain('meadow:trail-22');
    expect(lookout.ids).toContain('meadow:trail-12');
    expect(lookout.ids).not.toContain('meadow:trail-13');
    expect(lookout.ids).not.toContain('orchard:branch-1');
    for (let index = 1; index <= 7; index++)
      expect(orchard.ids).toContain(`orchard:branch-${index}`);
    expect(orchard.ids.at(-1)).toBe('orchard:commons');
    expect(NODES['orchard:commons']).toEqual([
      ORCHARD.x,
      terrainHeight(ORCHARD.x, ORCHARD.z) + 0.12,
      ORCHARD.z,
    ]);
    let lowestBranchClearance = Infinity,
      lowestPadClearance = Infinity;
    for (let index = 1; index < orchard.points.length; index++) {
      const from = orchard.points[index - 1],
        to = orchard.points[index];
      if (orchard.ids[index] !== 'meadow:trail-0')
        expect(orchard.lengths[index] - orchard.lengths[index - 1]).toBeLessThan(5.5);
      for (let step = 0; step <= 10; step++) {
        const t = step / 10,
          x = from[0] + (to[0] - from[0]) * t,
          y = from[1] + (to[1] - from[1]) * t,
          z = from[2] + (to[2] - from[2]) * t;
        expect(
          y - terrainHeight(x, z),
          `${orchard.ids[index - 1]} → ${orchard.ids[index]}`,
        ).toBeGreaterThan(0.01);
        expect(y - terrainHeight(x, z)).toBeLessThan(0.3);
        if (orchard.ids[index].startsWith('orchard:'))
          lowestBranchClearance = Math.min(lowestBranchClearance, y - renderedTerrainHeight(x, z));
        if (orchard.ids[index] === 'orchard:commons')
          lowestPadClearance = Math.min(lowestPadClearance, y - renderedTerrainHeight(x, z));
      }
    }
    // Sample the renderer's actual landscape triangle grid so the branch and
    // arrival pad do not sink into the visible landscape.
    expect(lowestBranchClearance).toBeGreaterThan(0.03);
    expect(lowestPadClearance).toBeGreaterThan(0.08);
    for (const [x, z] of [
      [ORCHARD.x - 3, ORCHARD.z],
      [ORCHARD.x + 3, ORCHARD.z],
      [ORCHARD.x, ORCHARD.z - 3],
      [ORCHARD.x, ORCHARD.z + 3],
    ])
      expect(terrainHeight(x, z)).toBeCloseTo(terrainHeight(ORCHARD.x, ORCHARD.z));
  });
  it('branches west to Cedar Observatory after trail sample 16 with clear terrain chords', () => {
    const cedar = planRoute('center', 'observatory:cedar');
    const lookout = planRoute('center', 'meadow:lookout');
    const orchard = planRoute('center', 'orchard:commons');
    expect(cedar.ids).toContain('meadow:trail-16');
    expect(cedar.ids).not.toContain('meadow:trail-17');
    expect(lookout.ids).not.toContain('observatory:branch-1');
    expect(orchard.ids).not.toContain('observatory:branch-1');
    expect(orchard.ids).toContain('meadow:trail-22');
    for (let index = 1; index <= 8; index++)
      expect(cedar.ids).toContain(`observatory:branch-${index}`);
    expect(cedar.ids.at(-1)).toBe('observatory:cedar');
    expect(NODES['observatory:cedar']).toEqual([
      OBSERVATORY.x,
      terrainHeight(OBSERVATORY.x, OBSERVATORY.z) + 0.12,
      OBSERVATORY.z,
    ]);
    let branchClearance = Infinity;
    for (let index = 1; index < cedar.points.length; index++) {
      if (!cedar.ids[index].startsWith('observatory:')) continue;
      const from = cedar.points[index - 1];
      const to = cedar.points[index];
      expect(cedar.lengths[index] - cedar.lengths[index - 1]).toBeLessThan(5.5);
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const x = from[0] + (to[0] - from[0]) * t;
        const y = from[1] + (to[1] - from[1]) * t;
        const z = from[2] + (to[2] - from[2]) * t;
        branchClearance = Math.min(branchClearance, y - renderedTerrainHeight(x, z));
      }
    }
    expect(branchClearance).toBeGreaterThan(0.015);
    for (const [x, z] of [
      [OBSERVATORY.x - 3, OBSERVATORY.z],
      [OBSERVATORY.x + 3, OBSERVATORY.z],
      [OBSERVATORY.x, OBSERVATORY.z - 3],
      [OBSERVATORY.x, OBSERVATORY.z + 3],
    ])
      expect(terrainHeight(x, z)).toBeCloseTo(terrainHeight(OBSERVATORY.x, OBSERVATORY.z));
  });
  it('keeps transit lanes outside desk and chair footprints with body clearance', () => {
    for (const [from, to] of EDGES) {
      const a = NODES[from],
        b = NODES[to];
      for (let t = 0; t <= 1; t += 0.02) {
        const x = a[0] + (b[0] - a[0]) * t,
          z = a[2] + (b[2] - a[2]) * t;
        for (const [sx, , sz] of SEATS) {
          const table = Math.abs(x - sx) < 0.8 + 0.3 && Math.abs(z - sz - 0.2) < 0.5 + 0.3;
          const chair =
            Math.abs(x - sx) < 0.365 + 0.3 && z > sz - 1.04 - 0.3 && z < sz - 0.36 + 0.3;
          expect(table || chair, `${from} → ${to}, near desk ${sx},${sz}`).toBe(false);
        }
      }
    }
  });
  it('reserves destinations exclusively and acquires entire corridors atomically', () => {
    const traffic = new NavigationTraffic();
    expect(traffic.reserveDestination('a', 'bench')).toBe(true);
    expect(traffic.reserveDestination('b', 'bench')).toBe(false);
    expect(traffic.acquire('a', ['x', 'y'])).toBe(true);
    expect(traffic.acquire('b', ['z', 'y'])).toBe(false);
    expect(traffic.acquire('c', ['z', 'w'])).toBe(true); // failed acquisition holds nothing
    traffic.release('a');
    expect(traffic.reserveDestination('b', 'bench')).toBe(true);
    expect(traffic.acquire('b', ['x', 'y'])).toBe(true);
  });
  it('opens a cleared branch while reserving the route ahead and prioritizing a return', () => {
    const traffic = new NavigationTraffic(),
      garden = planRoute('home-0', 'garden-west'),
      cafe = planRoute('home-1', 'coffee'),
      studio = planRoute('home-4', 'garden-east');
    expect(traffic.acquire('garden-bound', garden.ids)).toBe(true);
    expect(traffic.acquire('cafe-bound', cafe.ids)).toBe(false);
    traffic.releasePassed('garden-bound', garden.lengths[garden.ids.indexOf('center')] + 1);
    expect(traffic.acquire('cafe-bound', cafe.ids)).toBe(true);
    expect(traffic.acquire('studio-bound', studio.ids)).toBe(false);
    expect(traffic.acquire('garden-bound', garden.ids, true)).toBe(false);
    expect(traffic.acquire('new-cafe-trip', cafe.ids)).toBe(false);
    traffic.release('cafe-bound');
    expect(traffic.acquire('garden-bound', garden.ids, true)).toBe(true);
  });
  it('treats overlapping physical lanes as shared even when their waypoint names differ', () => {
    const traffic = new NavigationTraffic(),
      homeLane = planRoute('home-1', 'join-1'),
      windowLane = planRoute('cafe-aisle', 'window-approach');
    expect(homeLane.ids.some((id) => windowLane.ids.includes(id))).toBe(false);
    expect(traffic.acquire('home', homeLane.ids)).toBe(true);
    expect(traffic.acquire('window', windowLane.ids)).toBe(false);
    traffic.releasePassed('home', homeLane.lengths.at(-1)! + 1);
    expect(traffic.acquire('window', windowLane.ids)).toBe(true);
  });
  it('allows a lookout trip after an orchard walker clears the shared trail junction', () => {
    const traffic = new NavigationTraffic(),
      orchard = planRoute('home-0', 'orchard:commons'),
      lookout = planRoute('home-1', 'meadow:lookout');
    expect(traffic.acquire('orchard', orchard.ids)).toBe(true);
    expect(traffic.acquire('lookout', lookout.ids)).toBe(false);
    traffic.releasePassed('orchard', orchard.lengths[orchard.ids.indexOf('meadow:trail-16')] + 1);
    expect(traffic.acquire('lookout', lookout.ids)).toBe(true);
    expect(traffic.acquire('orchard', orchard.ids, true)).toBe(false);
    traffic.release('lookout');
    expect(traffic.acquire('orchard', orchard.ids, true)).toBe(true);
  });
  it('shares Cedar trail safely with Lookout and Orchard trips and prioritizes its return', () => {
    const traffic = new NavigationTraffic();
    const cedar = planRoute('home-0', 'observatory:cedar');
    const lookout = planRoute('home-1', 'meadow:lookout');
    const orchard = planRoute('home-2', 'orchard:commons');
    expect(traffic.reserveDestination('cedar', 'observatory:cedar')).toBe(true);
    expect(traffic.reserveDestination('other', 'observatory:cedar')).toBe(false);
    expect(traffic.acquire('cedar', cedar.ids)).toBe(true);
    expect(traffic.acquire('lookout', lookout.ids)).toBe(false);
    expect(traffic.acquire('orchard', orchard.ids)).toBe(false);
    traffic.releasePassed('cedar', cedar.lengths[cedar.ids.indexOf('observatory:branch-3')] + 1);
    expect(traffic.acquire('lookout', lookout.ids)).toBe(true);
    expect(traffic.acquire('orchard', orchard.ids)).toBe(false);
    const returnTrip = planRoute('observatory:cedar', 'home-0');
    expect(traffic.acquire('cedar', returnTrip.ids, true)).toBe(false);
    traffic.release('lookout');
    expect(traffic.acquire('orchard', orchard.ids)).toBe(false);
    expect(traffic.acquire('cedar', returnTrip.ids, true)).toBe(true);
    traffic.release('cedar');
    expect(traffic.acquire('orchard', orchard.ids)).toBe(true);
  });
  it('keeps a blocked urgent return ahead of a third entrant while freeing its distant tail', () => {
    const traffic = new NavigationTraffic();
    const northstar = planRoute('home-0', NORTHSTAR_OUTPOST.id);
    const lookout = planRoute('home-1', 'meadow:lookout');
    const third = planRoute('home-2', NORTHSTAR_OUTPOST.id);
    const distal = planRoute(northstar.ids.at(-8)!, NORTHSTAR_OUTPOST.id);
    const current = northstar.lengths[northstar.ids.indexOf('northstar:trail-15')];
    expect(traffic.acquire('leader', northstar.ids)).toBe(true);
    traffic.releasePassed('leader', current);
    expect(traffic.acquire('paused-follower', lookout.ids)).toBe(true);
    expect(traffic.acquireReturn('leader', northstar.ids, current)).toBe(false);
    expect(traffic.acquire('third', third.ids)).toBe(false);
    // The paused follower obstructs the return prefix, not the unused outpost tail.
    expect(traffic.acquire('distal', distal.ids)).toBe(true);
    traffic.release('paused-follower');
    expect(traffic.acquireReturn('leader', northstar.ids, current)).toBe(true);
    expect(traffic.acquire('third', third.ids)).toBe(false);
    traffic.release('leader');
    expect(traffic.acquire('third', third.ids)).toBe(false);
    traffic.release('distal');
    expect(traffic.acquire('third', third.ids)).toBe(true);
  });
  it('protects an occupied destination during a blocked return handoff', () => {
    const traffic = new NavigationTraffic();
    const trip = planRoute('home-0', NORTHSTAR_OUTPOST.id);
    const blocker = planRoute('home-1', 'meadow:lookout');
    const next = planRoute('northstar:trail-32', NORTHSTAR_OUTPOST.id);
    const end = trip.lengths.at(-1)!;
    expect(traffic.reserveDestination('leader', NORTHSTAR_OUTPOST.id)).toBe(true);
    expect(traffic.acquire('leader', trip.ids)).toBe(true);
    traffic.releasePassed('leader', end + 1);
    expect(traffic.acquire('paused-blocker', blocker.ids)).toBe(true);
    expect(traffic.acquireReturn('leader', trip.ids, end)).toBe(false);
    traffic.releaseDestination('leader', NORTHSTAR_OUTPOST.id);
    expect(traffic.reserveDestination('next', NORTHSTAR_OUTPOST.id)).toBe(true);
    expect(traffic.acquire('next', next.ids)).toBe(false);
    traffic.release('paused-blocker');
    expect(traffic.acquireReturn('leader', trip.ids, end)).toBe(true);
    expect(traffic.acquire('next', next.ids)).toBe(false);
    traffic.release('leader');
    expect(traffic.acquire('next', next.ids)).toBe(true);
  });
  it("releases only an interrupted trip's unused tail while preserving return priority", () => {
    const traffic = new NavigationTraffic();
    const northstar = planRoute('home-0', NORTHSTAR_OUTPOST.id);
    const current = northstar.lengths[northstar.ids.indexOf('northstar:trail-15')];
    expect(northstar.lengths.at(-1)! - current).toBeGreaterThan(20);
    const distalStart = northstar.ids.at(-8)!;
    const distal = planRoute(distalStart, NORTHSTAR_OUTPOST.id);
    const third = planRoute('home-1', NORTHSTAR_OUTPOST.id);
    expect(traffic.reserveDestination('leader', NORTHSTAR_OUTPOST.id)).toBe(true);
    expect(traffic.acquire('leader', northstar.ids)).toBe(true);
    traffic.releasePassed('leader', current);
    // The distal block is still part of the outbound lease before interruption.
    expect(traffic.acquire('distal', distal.ids)).toBe(false);
    expect(traffic.acquireReturn('leader', northstar.ids, current)).toBe(true);
    traffic.releaseDestination('leader', NORTHSTAR_OUTPOST.id);
    expect(traffic.reserveDestination('distal', NORTHSTAR_OUTPOST.id)).toBe(true);
    expect(traffic.acquire('distal', distal.ids)).toBe(true);
    // A third home departure still meets the returner's protected shared lane.
    expect(traffic.acquire('third', third.ids)).toBe(false);
    traffic.releasePassed('leader', 0, true);
    expect(traffic.acquire('third', third.ids)).toBe(false);
    traffic.release('distal');
    expect(traffic.acquire('third', third.ids)).toBe(true);
  });
});

describe('resident journeys', () => {
  it('visits Windward Mill and reverses continuously when work resumes', () => {
    const traffic = new NavigationTraffic();
    const motion = new ResidentJourney(3, 'demo-3', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== WINDWARD_MILL.id)
        expect(traffic.reserveDestination('scene', destination.id)).toBe(true);
    let arrived = false;
    let previous = motion.position;
    for (let frame = 0; frame < 220 * 60; frame++) {
      motion.update(agent(3), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (motion.activity === `Resting at ${WINDWARD_MILL.label}`) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(motion.position[0]).toBeCloseTo(WINDWARD_MILL.x);
    expect(motion.position[2]).toBeCloseTo(WINDWARD_MILL.z);
    advance(motion, agent(3, 'working'), 220);
    expect(motion.activity).toBe('At desk');
    expect(traffic.reserveDestination('next', WINDWARD_MILL.id)).toBe(true);
  });
  it('visits Dawnlight and retraces the eastern route when work resumes', () => {
    const traffic = new NavigationTraffic();
    const motion = new ResidentJourney(2, 'demo-2', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== DAWNLIGHT_GLASSHOUSE.id)
        expect(traffic.reserveDestination('scene', destination.id)).toBe(true);
    let arrived = false;
    let previous = motion.position;
    for (let frame = 0; frame < 180 * 60; frame++) {
      motion.update(agent(2), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (motion.activity === `Resting at ${DAWNLIGHT_GLASSHOUSE.label}`) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(motion.position[0]).toBeCloseTo(DAWNLIGHT_GLASSHOUSE.x);
    expect(motion.position[2]).toBeCloseTo(DAWNLIGHT_GLASSHOUSE.z);
    const returning = agent(2, 'working');
    for (let frame = 0; frame < 180 * 60; frame++) {
      motion.update(returning, 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      expect(motion.opacity).toBe(1);
      previous = next;
      if (motion.activity === 'At desk') break;
    }
    expect(motion.activity).toBe('At desk');
    expect(traffic.reserveDestination('next', DAWNLIGHT_GLASSHOUSE.id)).toBe(true);
  });
  it('walks beyond the home zone, rests at a destination, and returns continuously for work', () => {
    const motion = new ResidentJourney(0, 'demo-2', new NavigationTraffic());
    let visited = false,
      previous = motion.position;
    for (let i = 0; i < 100 * 60; i++) {
      motion.update(agent(), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((v, axis) => v - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (motion.activity === 'Resting at resource lab') {
        visited = true;
        break;
      }
    }
    expect(visited).toBe(true);
    advance(motion, agent(0, 'working'), 70);
    expect(motion.activity).toBe('At desk');
    expect(motion.clip(agent(0, 'working'))).toBe('DeskType');
  });
  it('reverses an interrupted outing without teleporting and never invents task state', () => {
    const motion = new ResidentJourney(0, 'demo-2', new NavigationTraffic());
    advance(motion, agent(), 24);
    const before = motion.position;
    const waiting = agent(0, 'waiting');
    motion.update(waiting, 1 / 60, options);
    expect(motion.activity).toBe('Returning to desk');
    expect(Math.hypot(...motion.position.map((v, i) => v - before[i]))).toBeLessThan(0.05);
    expect(waiting.status).toBe('waiting');
    advance(motion, waiting, 60);
    expect(motion.clip(waiting)).toBe('DeskWait');
  });
  it('waits safely when work interrupts a trip after another resident enters the cleared branch', () => {
    const traffic = new NavigationTraffic(),
      motion = new ResidentJourney(0, 'demo-2', traffic),
      cafe = planRoute('home-1', 'coffee');
    let passedCenter = false;
    for (let frame = 0; frame < 120 * 60; frame++) {
      motion.update(agent(), 1 / 60, options);
      if (motion.activity.startsWith('Walking to') && motion.position[0] > 1) {
        passedCenter = true;
        break;
      }
    }
    expect(passedCenter).toBe(true);
    expect(traffic.acquire('cafe-traveler', cafe.ids)).toBe(true);
    const before = motion.position;
    motion.update(agent(0, 'working'), 1 / 60, options);
    expect(motion.activity).toBe('Waiting for a clear path');
    expect(motion.position).toEqual(before);
    traffic.release('cafe-traveler');
    motion.update(agent(0, 'working'), 1 / 60, options);
    expect(motion.activity).toBe('Returning to desk');
    expect(Math.hypot(...motion.position.map((v, axis) => v - before[axis]))).toBeLessThan(0.05);
    advance(motion, agent(0, 'working'), 70);
    expect(motion.activity).toBe('At desk');
  });
  it('walks to the distant survey lookout and returns along the trail for work', () => {
    const traffic = new NavigationTraffic(),
      motion = new ResidentJourney(0, 'demo-2', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== 'meadow:lookout')
        expect(traffic.reserveDestination('scene', destination.id)).toBe(true);
    let arrived = false,
      previous = motion.position;
    for (let frame = 0; frame < 180 * 60; frame++) {
      motion.update(agent(), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (motion.activity === 'Resting at survey lookout') {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(motion.position[0]).toBeCloseTo(LOOKOUT.x);
    expect(motion.position[2]).toBeCloseTo(LOOKOUT.z);
    advance(motion, agent(0, 'working'), 180);
    expect(motion.activity).toBe('At desk');
    expect(traffic.reserveDestination('another-resident', 'meadow:lookout')).toBe(true);
  });
  it('reverses continuously from the meadow trail when a task needs input', () => {
    const traffic = new NavigationTraffic(),
      motion = new ResidentJourney(0, 'demo-2', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== 'meadow:lookout') traffic.reserveDestination('scene', destination.id);
    let reachedMeadow = false;
    for (let frame = 0; frame < 130 * 60; frame++) {
      motion.update(agent(), 1 / 60, options);
      if (motion.position[2] < -27) {
        reachedMeadow = true;
        break;
      }
    }
    expect(reachedMeadow).toBe(true);
    const before = motion.position,
      waiting = agent(0, 'waiting');
    motion.update(waiting, 1 / 60, options);
    expect(motion.activity).toBe('Returning to desk');
    expect(Math.hypot(...motion.position.map((value, axis) => value - before[axis]))).toBeLessThan(
      0.05,
    );
    advance(motion, waiting, 150);
    expect(motion.activity).toBe('At desk');
    expect(motion.clip(waiting)).toBe('DeskWait');
  });
  it('reaches Orchard Commons and retraces the long route when work interrupts the visit', () => {
    const traffic = new NavigationTraffic(),
      motion = new ResidentJourney(3, 'demo-3', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== 'orchard:commons') traffic.reserveDestination('scene', destination.id);
    let arrived = false,
      previous = motion.position;
    for (let frame = 0; frame < 240 * 60; frame++) {
      motion.update(agent(3), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (motion.activity === 'Resting at expedition base') {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(motion.position[0]).toBeCloseTo(ORCHARD.x);
    expect(motion.position[2]).toBeCloseTo(ORCHARD.z);
    const working = agent(3, 'working'),
      before = motion.position;
    motion.update(working, 1 / 60, options);
    expect(Math.hypot(...motion.position.map((value, axis) => value - before[axis]))).toBeLessThan(
      0.05,
    );
    advance(motion, working, 240);
    expect(motion.activity).toBe('At desk');
    expect(working.status).toBe('working');
    expect(traffic.reserveDestination('next', 'orchard:commons')).toBe(true);
  });
  it('visits Cedar Observatory continuously and retraces its route when work starts', () => {
    const traffic = new NavigationTraffic();
    const motion = new ResidentJourney(2, 'demo-2', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== 'observatory:cedar')
        expect(traffic.reserveDestination('scene', destination.id)).toBe(true);
    let arrived = false;
    let previous = motion.position;
    for (let frame = 0; frame < 220 * 60; frame++) {
      motion.update(agent(2), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (motion.activity === 'Resting at deep sky array') {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(motion.position[0]).toBeCloseTo(OBSERVATORY.x);
    expect(motion.position[2]).toBeCloseTo(OBSERVATORY.z);
    const working = agent(2, 'working');
    const before = motion.position;
    motion.update(working, 1 / 60, options);
    expect(Math.hypot(...motion.position.map((value, axis) => value - before[axis]))).toBeLessThan(
      0.05,
    );
    advance(motion, working, 220);
    expect(motion.activity).toBe('At desk');
    expect(working.status).toBe('working');
    expect(traffic.reserveDestination('next', 'observatory:cedar')).toBe(true);
  });
  it('walks the long woodland branch and returns continuously after an interruption', () => {
    const traffic = new NavigationTraffic();
    const motion = new ResidentJourney(2, 'demo-2', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== WOODLAND_HOLLOW.id)
        expect(traffic.reserveDestination('scene', destination.id)).toBe(true);
    let reachedBranch = false;
    let previous = motion.position;
    for (let frame = 0; frame < 220 * 60; frame++) {
      motion.update(agent(2), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (
        next[0] < -45 &&
        next[2] > -45 &&
        motion.activity === `Walking to ${WOODLAND_HOLLOW.label}`
      ) {
        reachedBranch = true;
        break;
      }
    }
    expect(reachedBranch).toBe(true);
    const working = agent(2, 'working');
    let faded = false;
    for (let frame = 0; frame < 220 * 60 && motion.activity !== 'At desk'; frame++) {
      motion.update(working, 1 / 60, options);
      const next = motion.position;
      const jump = Math.hypot(...next.map((value, axis) => value - previous[axis]));
      expect(jump).toBeLessThan(0.06);
      if (motion.opacity < 0.99) faded = true;
      previous = next;
    }
    expect(faded).toBe(false);
    expect(motion.activity).toBe('At desk');
    expect(working.status).toBe('working');
    expect(traffic.reserveDestination('next', WOODLAND_HOLLOW.id)).toBe(true);
  });
  it('completes a visit to Lantern Hollow before returning', () => {
    const traffic = new NavigationTraffic();
    const motion = new ResidentJourney(3, 'demo-3', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== WOODLAND_HOLLOW.id)
        expect(traffic.reserveDestination('scene', destination.id)).toBe(true);
    let arrived = false;
    let previous = motion.position;
    for (let frame = 0; frame < 240 * 60; frame++) {
      motion.update(agent(3), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (motion.activity === `Resting at ${WOODLAND_HOLLOW.label}`) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(motion.position[0]).toBeCloseTo(WOODLAND_HOLLOW.x);
    expect(motion.position[2]).toBeCloseTo(WOODLAND_HOLLOW.z);
    advance(motion, agent(3, 'working'), 240);
    expect(motion.activity).toBe('At desk');
    expect(traffic.reserveDestination('next', WOODLAND_HOLLOW.id)).toBe(true);
  });
  it('reaches Northstar Outpost and retraces its long route when work interrupts', () => {
    const traffic = new NavigationTraffic();
    const motion = new ResidentJourney(3, 'demo-3', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== NORTHSTAR_OUTPOST.id)
        expect(traffic.reserveDestination('scene', destination.id)).toBe(true);
    let arrived = false;
    let previous = motion.position;
    for (let frame = 0; frame < 290 * 60; frame++) {
      motion.update(agent(3), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (motion.activity === `Resting at ${NORTHSTAR_OUTPOST.label}`) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(motion.position[0]).toBeCloseTo(NORTHSTAR_OUTPOST.x);
    expect(motion.position[2]).toBeCloseTo(NORTHSTAR_OUTPOST.z);
    const working = agent(3, 'working');
    let faded = false;
    for (let frame = 0; frame < 290 * 60 && motion.activity !== 'At desk'; frame++) {
      motion.update(working, 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      if (motion.opacity < 0.99) faded = true;
      previous = next;
    }
    expect(faded).toBe(false);
    expect(motion.activity).toBe('At desk');
    expect(traffic.reserveDestination('next', NORTHSTAR_OUTPOST.id)).toBe(true);
  });
  it('reverses an interrupted Northstar branch outing without a jump or hidden relocation', () => {
    const traffic = new NavigationTraffic();
    const motion = new ResidentJourney(2, 'demo-2', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== NORTHSTAR_OUTPOST.id)
        expect(traffic.reserveDestination('scene', destination.id)).toBe(true);
    let reachedSpur = false;
    let previous = motion.position;
    for (let frame = 0; frame < 230 * 60; frame++) {
      motion.update(agent(2), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (
        next[0] > 26 &&
        next[2] < -89 &&
        motion.activity === `Walking to ${NORTHSTAR_OUTPOST.label}`
      ) {
        reachedSpur = true;
        break;
      }
    }
    expect(reachedSpur).toBe(true);
    const working = agent(2, 'working');
    let faded = false;
    for (let frame = 0; frame < 230 * 60 && motion.activity !== 'At desk'; frame++) {
      motion.update(working, 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      if (motion.opacity < 0.99) faded = true;
      previous = next;
    }
    expect(faded).toBe(false);
    expect(motion.activity).toBe('At desk');
    expect(traffic.reserveDestination('next', NORTHSTAR_OUTPOST.id)).toBe(true);
  });
  it('returns continuously while a paused traveler holds the now-unused Northstar tail', () => {
    const traffic = new NavigationTraffic();
    const motion = new ResidentJourney(2, 'demo-2', traffic);
    for (const destination of DESTINATIONS)
      if (destination.id !== NORTHSTAR_OUTPOST.id)
        expect(traffic.reserveDestination('scene', destination.id)).toBe(true);
    let reachedSpur = false;
    for (let frame = 0; frame < 230 * 60; frame++) {
      motion.update(agent(2), 1 / 60, options);
      if (
        motion.position[0] > 26 &&
        motion.position[2] < -89 &&
        motion.activity === `Walking to ${NORTHSTAR_OUTPOST.label}`
      ) {
        reachedSpur = true;
        break;
      }
    }
    expect(reachedSpur).toBe(true);
    const working = agent(2, 'working');
    const before = motion.position;
    motion.update(working, 1 / 60, options);
    expect(motion.activity).toBe('Returning to desk');
    expect(traffic.reserveDestination('distal', NORTHSTAR_OUTPOST.id)).toBe(true);
    const branch = planRoute('northstar:trail-32', NORTHSTAR_OUTPOST.id);
    expect(traffic.acquire('distal', branch.ids)).toBe(true);
    const third = planRoute('home-1', NORTHSTAR_OUTPOST.id);
    expect(traffic.acquire('third', third.ids)).toBe(false);
    let previous = motion.position;
    let faded = false;
    let minSeparation = Infinity;
    for (let frame = 0; frame < 230 * 60 && motion.activity !== 'At desk'; frame++) {
      motion.update(working, 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((value, axis) => value - previous[axis]))).toBeLessThan(0.06);
      minSeparation = Math.min(
        minSeparation,
        Math.hypot(
          next[0] - NODES['northstar:trail-32'][0],
          next[2] - NODES['northstar:trail-32'][2],
        ),
      );
      if (motion.opacity < 0.99) faded = true;
      previous = next;
    }
    expect(
      Math.hypot(...motion.position.map((value, axis) => value - before[axis])),
    ).toBeGreaterThan(10);
    expect(minSeparation).toBeGreaterThan(0.8);
    expect(faded).toBe(false);
    expect(motion.activity).toBe('At desk');
    traffic.release('distal');
    expect(traffic.reserveDestination('next', NORTHSTAR_OUTPOST.id)).toBe(true);
    expect(traffic.acquire('third', third.ids)).toBe(true);
  });
  it('keeps Northstar and Orchard trips exclusive on their shared approach', () => {
    const traffic = new NavigationTraffic();
    const northstar = planRoute('home-0', NORTHSTAR_OUTPOST.id);
    const orchard = planRoute('home-1', 'orchard:commons');
    expect(traffic.acquire('northstar', northstar.ids)).toBe(true);
    expect(traffic.acquire('orchard', orchard.ids)).toBe(false);
    traffic.releasePassed(
      'northstar',
      northstar.lengths[northstar.ids.indexOf('orchard:branch-3')] + 1,
    );
    expect(traffic.acquire('orchard', orchard.ids)).toBe(false);
    traffic.releaseCorridor('northstar');
    expect(traffic.acquire('orchard', orchard.ids)).toBe(true);
  });
  it('does not roam from unknown, disconnected, stale, paused, or reduced states', () => {
    for (const state of [
      agent(0, 'unknown'),
      agent(0, 'disconnected'),
      { ...agent(), telemetryStale: true },
    ]) {
      const m = new ResidentJourney(0, state.id, new NavigationTraffic());
      advance(m, state, 90);
      expect(m.activity).toBe('Near desk');
    }
    for (const override of [{ playing: false }, { reduced: true }, { outings: false }]) {
      const m = new ResidentJourney(0, 'demo-0', new NavigationTraffic());
      advance(m, agent(), 90, override);
      expect(m.activity).toBe('Near desk');
    }
  });
  it('freezes an outing, returns when disabled, and releases leases when disposed', () => {
    const traffic = new NavigationTraffic(),
      m = new ResidentJourney(0, 'demo-2', traffic);
    advance(m, agent(), 24);
    const p = m.position;
    advance(m, agent(), 10, { playing: false });
    expect(m.position).toEqual(p);
    advance(m, agent(), 70, { outings: false });
    expect(m.activity).toBe('Near desk');
    m.dispose();
    expect(traffic.acquire('replacement', Object.keys(NODES))).toBe(true);
  });
  it('completes departure from a distant destination even while simulation is paused', () => {
    const m = new ResidentJourney(0, 'demo-2', new NavigationTraffic());
    advance(m, agent(), 24);
    advance(m, agent(), 90, { leaving: true, playing: false });
    expect(m.exited).toBe(true);
    expect(m.opacity).toBe(0);
  });
});

it('assigns stable appearance and bounded personality independent of seat assignment', () => {
  expect(new Set(initialAgents().map((a) => residentStyle(a.id).accessory)).size).toBe(8);
  expect(residentStyle('claude/session-abc')).toEqual(residentStyle('claude/session-abc'));
  for (const a of initialAgents()) {
    const style = residentStyle(a.id);
    expect(ACCESSORIES).toContain(style.accessory);
    expect(style.pace).toBeGreaterThanOrEqual(1.08);
    expect(style.pace).toBeLessThanOrEqual(1.32);
  }
});

it('lets returning residents claim a shared route before another leisure departure', () => {
  const traffic = new NavigationTraffic();
  expect(traffic.acquire('traveler', ['a', 'b'])).toBe(true);
  expect(traffic.acquire('returning', ['b', 'c'], true)).toBe(false);
  expect(traffic.acquire('new-outing', ['c', 'd'])).toBe(false);
  traffic.release('traveler');
  expect(traffic.acquire('returning', ['b', 'c'], true)).toBe(true);
  traffic.release('returning');
  expect(traffic.acquire('new-outing', ['c', 'd'])).toBe(true);
});

it('protects the café communal table, counter, planters, studio bookcase, and basin', () => {
  const obstacles = [
    [-6.5, -6.5, 2.25, 0.5],
    [-11.45, -7.12, 0.915, 1.425],
    [-9.9, 0.23, 1, 0.21],
    [-3.2, 0.23, 1, 0.21],
    [10.25, -8, 0.9, 0.35],
    [-2.2, 8, 0.92, 0.92],
  ];
  for (const [from, to] of EDGES) {
    const a = NODES[from],
      b = NODES[to];
    for (let t = 0; t <= 1; t += 0.025)
      for (const [ox, oz, w, d] of obstacles) {
        const x = a[0] + (b[0] - a[0]) * t,
          z = a[2] + (b[2] - a[2]) * t;
        expect(
          Math.abs(x - ox) < w + 0.3 && Math.abs(z - oz) < d + 0.3,
          `${from} → ${to} intersects scenery ${ox},${oz}`,
        ).toBe(false);
      }
  }
});

it('lets eight residents share destinations without body overlaps or starvation', () => {
  const traffic = new NavigationTraffic();
  const motions = Array.from({ length: 8 }, (_, i) => new ResidentJourney(i, `demo-${i}`, traffic));
  for (const destination of DESTINATIONS)
    if (destination.id !== 'meadow:lookout') traffic.reserveDestination('scene', destination.id);
  const visited = new Set<number>();
  let lookoutVisited = false,
    sceneReleased = false;
  let closest = Infinity,
    closestAt = '';
  for (let frame = 0; frame < 420 * 30; frame++) {
    motions.forEach((m, i) => {
      m.update(agent(i), 1 / 30, options);
      if (m.activity.startsWith('Resting at')) visited.add(i);
      if (m.activity === 'Resting at survey lookout') lookoutVisited = true;
      if (!sceneReleased && m.activity === 'Walking to survey lookout') {
        traffic.release('scene');
        sceneReleased = true;
      }
    });
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) {
        const a = motions[i].position,
          b = motions[j].position;
        const gap = Math.hypot(a[0] - b[0], a[2] - b[2]);
        if (gap < closest) {
          closest = gap;
          closestAt = `${frame / 30}s ${i}:${motions[i].activity} ${a} / ${j}:${motions[j].activity} ${b}`;
        }
      }
  }
  expect(closest, closestAt).toBeGreaterThan(0.6);
  expect(visited.size).toBe(8);
  expect(lookoutVisited).toBe(true);
});

it('fades an offsite removal in place without waiting for a frozen corridor', () => {
  const traffic = new NavigationTraffic(),
    m = new ResidentJourney(0, 'demo-2', traffic);
  advance(m, agent(), 24);
  const p = m.position;
  advance(m, agent(), 1, { leaving: true, playing: false });
  expect(m.exited).toBe(true);
  expect(m.position).toEqual(p);
  expect(traffic.acquire('replacement', Object.keys(NODES))).toBe(true);
});

it('returns from the eastern trail rest when a task needs input', () => {
  const traffic = new NavigationTraffic();
  const motion = new ResidentJourney(0, 'demo-2', traffic);
  for (const destination of DESTINATIONS)
    if (destination.id !== 'meadow:rest-east') traffic.reserveDestination('scene', destination.id);
  let arrived = false;
  for (let frame = 0; frame < 180 * 60; frame++) {
    motion.update(agent(), 1 / 60, options);
    if (motion.activity === 'Resting at eastern trail rest') {
      arrived = true;
      break;
    }
  }
  expect(arrived).toBe(true);
  const before = motion.position;
  const waiting = agent(0, 'waiting');
  motion.update(waiting, 1 / 60, options);
  expect(Math.hypot(...motion.position.map((value, axis) => value - before[axis]))).toBeLessThan(
    0.06,
  );
  advance(motion, waiting, 150);
  expect(motion.clip(waiting)).toBe('DeskWait');
  expect(waiting.status).toBe('waiting');
  expect(traffic.reserveDestination('next', 'meadow:rest-east')).toBe(true);
});

it('shows the southern outing in the demo and yields immediately to reported work', () => {
  const traffic = new NavigationTraffic();
  const motion = new ResidentJourney(6, 'demo-6', traffic);
  let arrived = false;
  for (let frame = 0; frame < 120 * 60; frame++) {
    motion.update(agent(6), 1 / 60, options);
    if (motion.activity === 'Resting at Southwind Crater rim') {
      arrived = true;
      break;
    }
  }
  expect(arrived).toBe(true);
  const waiting = agent(6, 'waiting');
  motion.update(waiting, 1 / 60, options);
  expect(motion.activity).toBe('Returning to desk');
  advance(motion, waiting, 100);
  expect(motion.clip(waiting)).toBe('DeskWait');
  expect(waiting.status).toBe('waiting');
  expect(traffic.reserveDestination('next', SOUTHWIND_SHORE.id)).toBe(true);
});

it('rejoins home invisibly when an interrupted meadow return stays blocked', () => {
  const traffic = new NavigationTraffic();
  const motion = new ResidentJourney(3, 'demo-3', traffic);
  for (const destination of DESTINATIONS)
    if (destination.id !== 'orchard:commons') traffic.reserveDestination('scene', destination.id);
  let followerHeld = false;
  const follower = planRoute('home-1', 'meadow:lookout');
  for (let frame = 0; frame < 180 * 60; frame++) {
    motion.update(agent(3), 1 / 60, options);
    if (motion.position[2] < -49 && traffic.acquire('follower', follower.ids)) {
      followerHeld = true;
      break;
    }
  }
  expect(followerHeld).toBe(true);
  const waiting = agent(3, 'working');
  advance(motion, waiting, 3);
  const pausedPosition = motion.position;
  advance(motion, waiting, 30, { playing: false });
  expect(motion.position).toEqual(pausedPosition);
  expect(motion.opacity).toBe(1);
  advance(motion, waiting, 5.1);
  expect(motion.opacity).toBeGreaterThan(0);
  expect(motion.opacity).toBeLessThan(1);
  let lastVisible: typeof motion.position | null = motion.position;
  let becameInvisible = false;
  for (let frame = 0; frame < 2 * 60; frame++) {
    motion.update(waiting, 1 / 60, { ...options, playing: false });
    const next = motion.position;
    if (motion.opacity > 0.15) {
      if (lastVisible)
        expect(Math.hypot(...next.map((value, axis) => value - lastVisible![axis]))).toBeLessThan(
          0.08,
        );
      lastVisible = next;
    } else {
      becameInvisible = true;
      lastVisible = null;
    }
  }
  expect(becameInvisible).toBe(true);
  expect(motion.opacity).toBe(0);
  expect(motion.position[2]).toBeGreaterThan(-10);
  advance(motion, waiting, 1, { playing: false });
  expect(motion.opacity).toBe(0);
  advance(motion, waiting, 1);
  expect(motion.opacity).toBe(1);
  expect(waiting.status).toBe('working');
  expect(traffic.reserveDestination('next', 'orchard:commons')).toBe(true);
  traffic.release('follower');
  expect(traffic.acquire('another', planRoute('home-2', 'orchard:commons').ids)).toBe(true);
});

it('shows the lookout promptly in ordinary demo pacing without forced destinations', () => {
  // Match the default 6.5s demo tick and its 60s idle window with deterministic choices.
  const results = [];
  for (let run = 1; run <= 4; run++) {
    let seed = run;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const agents = initialAgents().map((entry) => ({ ...entry, updatedAt: 0 }));
    const traffic = new NavigationTraffic();
    const motions = agents.map((entry, seat) => new ResidentJourney(seat, entry.id, traffic));
    let starts = 0,
      arrivals = 0,
      firstArrival = -1,
      firstStart = -1,
      closest = Infinity;
    let scoutFirstStatusChange = -1,
      scoutSecondStatusChange = -1,
      scoutFirstReturn = -1,
      scoutHome = -1;
    const last = motions.map(() => '');
    for (let frame = 0; frame < 900 * 30; frame++) {
      const time = frame / 30;
      motions.forEach((motion, index) => {
        motion.update(agents[index], 1 / 30, { ...options, now: time * 1000 });
        if (motion.activity !== last[index] && motion.activity === 'Walking to survey lookout') {
          starts++;
          if (firstStart < 0) firstStart = time;
        }
        if (motion.activity !== last[index] && motion.activity === 'Resting at survey lookout') {
          arrivals++;
          if (firstArrival < 0) firstArrival = time;
        }
        if (
          index === 7 &&
          firstArrival >= 0 &&
          scoutFirstReturn < 0 &&
          motion.activity === 'Returning to desk'
        )
          scoutFirstReturn = time;
        if (
          index === 7 &&
          scoutFirstReturn >= 0 &&
          scoutHome < 0 &&
          (motion.activity === 'Near desk' || motion.activity === 'At desk')
        )
          scoutHome = time;
        last[index] = motion.activity;
      });
      for (let i = 0; i < motions.length; i++)
        for (let j = i + 1; j < motions.length; j++) {
          const a = motions[i].position,
            b = motions[j].position;
          closest = Math.min(closest, Math.hypot(a[0] - b[0], a[2] - b[2]));
        }
      if (frame > 0 && frame % 195 === 0) {
        const index = Math.floor(random() * agents.length),
          current = agents[index];
        if (current.status === 'idle' && time * 1000 - current.updatedAt < 60000) continue;
        const next =
          current.status === 'working'
            ? 'tool'
            : current.status === 'tool'
              ? random() > 0.75
                ? 'waiting'
                : 'completed'
              : current.status === 'completed'
                ? 'idle'
                : current.status === 'idle'
                  ? 'working'
                  : current.status;
        agents[index] = { ...current, status: next, updatedAt: time * 1000 };
        if (index === 7 && next !== current.status) {
          if (scoutFirstStatusChange < 0) scoutFirstStatusChange = time;
          else if (scoutSecondStatusChange < 0) scoutSecondStatusChange = time;
        }
      }
    }
    results.push({
      run,
      starts,
      arrivals,
      firstStart,
      firstArrival,
      scoutFirstStatusChange,
      scoutSecondStatusChange,
      scoutFirstReturn,
      scoutHome,
      closest,
    });
  }
  for (const result of results) {
    expect(result.firstStart, `seed ${result.run}`).toBeLessThan(20);
    expect(result.firstArrival, `seed ${result.run}`).toBeGreaterThan(0);
    expect(result.firstArrival, `seed ${result.run}`).toBeLessThan(80);
    expect(result.scoutFirstStatusChange, `seed ${result.run}`).toBeGreaterThan(
      result.firstArrival,
    );
    expect(result.scoutHome - result.scoutFirstReturn, `seed ${result.run}`).toBeLessThan(70);
    expect(result.scoutHome, `seed ${result.run}`).toBeLessThan(result.scoutSecondStatusChange);
    expect(result.closest, `seed ${result.run}`).toBeGreaterThan(0.6);
  }
});

it('keeps eight mixed-status residents moving without collisions or indefinite route waits', () => {
  const agents = initialAgents().map((entry) => ({
    ...entry,
    status: 'idle' as typeof entry.status,
  }));
  const traffic = new NavigationTraffic(),
    motions = agents.map((entry, seat) => new ResidentJourney(seat, entry.id, traffic));
  const visited = new Set<number>(),
    waitingFor = motions.map(() => 0),
    returningSince = motions.map(() => -1);
  let closest = Infinity,
    maxWait = 0,
    longestReturn = 0,
    interruptions = 0,
    completedReturns = 0;
  for (let frame = 0; frame < 960 * 30; frame++) {
    const time = frame / 30;
    motions.forEach((motion, seat) => {
      const phase = (time + seat * 17) % 180;
      const status = phase < 110 ? 'idle' : phase < 145 ? 'working' : 'waiting';
      if (agents[seat].status !== status) {
        if (
          status === 'working' &&
          (motion.activity.startsWith('Walking to') || motion.activity.startsWith('Resting at'))
        ) {
          returningSince[seat] = time;
          interruptions++;
        }
        agents[seat] = { ...agents[seat], status, updatedAt: time * 1000 };
      }
      motion.update(agents[seat], 1 / 30, { ...options, now: time * 1000 });
      if (motion.activity.startsWith('Resting at')) visited.add(seat);
      waitingFor[seat] =
        motion.activity === 'Waiting for a clear path' ? waitingFor[seat] + 1 / 30 : 0;
      maxWait = Math.max(maxWait, waitingFor[seat]);
      if (
        returningSince[seat] >= 0 &&
        (motion.activity === 'At desk' || motion.activity === 'Near desk')
      ) {
        longestReturn = Math.max(longestReturn, time - returningSince[seat]);
        returningSince[seat] = -1;
        completedReturns++;
      }
    });
    for (let i = 0; i < motions.length; i++)
      for (let j = i + 1; j < motions.length; j++) {
        const a = motions[i].position,
          b = motions[j].position;
        closest = Math.min(closest, Math.hypot(a[0] - b[0], a[2] - b[2]));
      }
  }
  expect(visited.size).toBe(8);
  expect(interruptions).toBeGreaterThan(0);
  expect(completedReturns).toBeGreaterThan(0);
  const longestDirectReturn =
    Math.max(
      ...SEATS.flatMap((_, seat) =>
        DESTINATIONS.map((destination) =>
          planRoute(destination.node, `home-${seat}`).lengths.at(-1)!,
        ),
      ),
    ) / 1.08;
  const returnBudget = longestDirectReturn + 20;
  const pendingReturns = returningSince.filter((since) => since >= 0);
  expect(maxWait).toBeLessThan(90);
  expect(longestReturn).toBeLessThan(returnBudget);
  expect(interruptions - completedReturns).toBe(pendingReturns.length);
  // Two residents can enter their working phase in the final 18 seconds of this run.
  // Bound both unfinished returns by elapsed time as well as the longest route.
  expect(pendingReturns.length).toBeLessThanOrEqual(2);
  for (const since of pendingReturns) {
    expect(960 - since).toBeLessThan(returnBudget);
    expect(960 - since).toBeLessThan(20);
  }
  expect(closest).toBeGreaterThan(0.6);
});
