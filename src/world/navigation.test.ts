import { describe, expect, it } from 'vitest';
import { initialAgents } from '../state';
import { SEATS, WORLD } from './layout';
import { DESTINATIONS, NODES, EDGES, planRoute, NavigationTraffic } from './navigation';
import { ResidentJourney } from './journey';
import { residentStyle, ACCESSORIES } from './personality';
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
        for (const [x, y, z] of route.points) {
          expect(Math.abs(x)).toBeLessThan(WORLD.width / 2);
          expect(Math.abs(z)).toBeLessThan(WORLD.depth / 2);
          expect(y).toBeGreaterThanOrEqual(0.4);
          expect(y).toBeLessThanOrEqual(1.1);
        }
      }
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
  const visited = new Set<number>();
  let closest = Infinity;
  for (let frame = 0; frame < 300 * 30; frame++) {
    motions.forEach((m, i) => {
      m.update(agent(i), 1 / 30, options);
      if (m.activity.startsWith('Resting at')) visited.add(i);
    });
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) {
        const a = motions[i].position,
          b = motions[j].position;
        closest = Math.min(closest, Math.hypot(a[0] - b[0], a[2] - b[2]));
      }
  }
  expect(closest).toBeGreaterThan(0.6);
  expect(visited.size).toBe(8);
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
