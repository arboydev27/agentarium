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
import { SOUTHWIND_MERE, clearOfSouthwindMere, waterRadiusAt } from './scenery/merePlacement';
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
  it('keeps the scenic southern water above its rendered basin and away from routes', () => {
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
        expect(clearOfSouthwindMere(NODES[id][0], NODES[id][2])).toBe(true);
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
            id.startsWith('meadow:') || id.startsWith('orchard:') || id.startsWith('observatory:'),
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
            route.ids[index].startsWith('observatory:')
          ) {
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
    // Sample the renderer's actual 128×128 triangle grid so the branch and
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
});

describe('resident journeys', () => {
  it('walks beyond the home zone, rests at a destination, and returns continuously for work', () => {
    const motion = new ResidentJourney(0, 'demo-2', new NavigationTraffic());
    let visited = false,
      previous = motion.position;
    for (let i = 0; i < 100 * 60; i++) {
      motion.update(agent(), 1 / 60, options);
      const next = motion.position;
      expect(Math.hypot(...next.map((v, axis) => v - previous[axis]))).toBeLessThan(0.06);
      previous = next;
      if (motion.activity === 'Resting at garden terrace') {
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
  it('walks to the distant meadow lookout and returns along the trail for work', () => {
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
      if (motion.activity === 'Resting at meadow lookout') {
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
      if (motion.activity === 'Resting at orchard commons') {
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
      if (motion.activity === 'Resting at cedar observatory') {
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
      if (m.activity === 'Resting at meadow lookout') lookoutVisited = true;
      if (!sceneReleased && m.activity === 'Walking to meadow lookout') {
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
        if (motion.activity !== last[index] && motion.activity === 'Walking to meadow lookout') {
          starts++;
          if (firstStart < 0) firstStart = time;
        }
        if (motion.activity !== last[index] && motion.activity === 'Resting at meadow lookout') {
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
      ...SEATS.map((_, seat) => planRoute('orchard:commons', `home-${seat}`).lengths.at(-1)!),
    ) / 1.08;
  const returnBudget = longestDirectReturn + 20;
  const pendingReturns = returningSince.filter((since) => since >= 0);
  expect(maxWait).toBeLessThan(90);
  expect(longestReturn).toBeLessThan(returnBudget);
  expect(interruptions - completedReturns).toBe(pendingReturns.length);
  expect(pendingReturns.length).toBeLessThanOrEqual(1);
  for (const since of pendingReturns) expect(960 - since).toBeLessThan(returnBudget);
  expect(closest).toBeGreaterThan(0.6);
});
