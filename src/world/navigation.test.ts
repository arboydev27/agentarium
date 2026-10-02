import { describe, expect, it } from 'vitest';
import { initialAgents } from '../state';
import { LOOKOUT, SEATS, WORLD } from './layout';
import { DESTINATIONS, NODES, EDGES, planRoute, NavigationTraffic } from './navigation';
import { ResidentJourney } from './journey';
import { residentStyle, ACCESSORIES } from './personality';
import { meadowTrailPoint, terrainHeight } from './terrain';
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
          if (route.ids[index].startsWith('meadow:')) {
            expect(z).toBeLessThan(-10);
            expect(y - terrainHeight(x, z)).toBeGreaterThanOrEqual(0.04);
            expect(y - terrainHeight(x, z)).toBeLessThanOrEqual(0.11);
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
        const clearance = y - terrainHeight(x, z);
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
    expect(highestClearance).toBeLessThan(0.2);
    expect(closestPost).toBeGreaterThan(0.65);
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
