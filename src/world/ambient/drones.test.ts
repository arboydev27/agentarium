import { describe, expect, it } from 'vitest';
import { roofTop, YARD_PROPS, ZONE_NAMES } from '../habitat/habitatLayout';
import { SEATS, ZONES } from '../layout';
import type { Point } from '../motion';
import { EDGES, NODES } from '../navigation';
import {
  DOCK_PADS,
  dockPadPoint,
  DRONE_CRUISE,
  DRONE_LANE_CLEARANCE,
  DRONE_ROUTES,
  DRONE_SIZE,
  DRONE_CLIMB,
  DRONE_SPEED,
  droneBlink,
  droneCycle,
  dronePose,
  legCruise,
} from './drones';

const segments = EDGES.map(([a, b]) => [NODES[a], NODES[b]] as const);
function distanceToSegmentXZ(x: number, z: number, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / length)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz);
}
const samples = (route: (typeof DRONE_ROUTES)[number], step = 0.2) => {
  const cycle = droneCycle(route);
  return Array.from({ length: Math.ceil(cycle / step) }, (_, i) => dronePose(route, i * step));
};

describe('maintenance drones', () => {
  it('fly at least three metres above every lane they pass over', () => {
    for (const route of DRONE_ROUTES) {
      for (const pose of samples(route)) {
        for (const [a, b] of segments) {
          if (distanceToSegmentXZ(pose.x, pose.z, a, b) > 1.2) continue;
          expect(pose.y - Math.max(a[1], b[1]), `${route.id} over a lane`).toBeGreaterThanOrEqual(
            DRONE_LANE_CLEARANCE,
          );
        }
        for (const [nx, ny, nz] of Object.values(NODES)) {
          if (Math.hypot(pose.x - nx, pose.z - nz) > 1.2) continue;
          expect(pose.y - ny, `${route.id} over a node`).toBeGreaterThanOrEqual(
            DRONE_LANE_CLEARANCE,
          );
        }
      }
    }
    // The lowest cruise clears every roof, and a tall stop lifts the whole crossing.
    for (const zone of ZONE_NAMES) expect(DRONE_CRUISE).toBeGreaterThan(roofTop(zone) + 1.5);
    expect(legCruise(4, 4)).toBe(DRONE_CRUISE);
    expect(legCruise(4, 14)).toBeCloseTo(15.2, 6);
  });

  it('docks on pads clear of routes, seats, decks and yard hardware', () => {
    for (const pad of DOCK_PADS) {
      for (const [a, b] of segments)
        expect(distanceToSegmentXZ(pad.x, pad.z, a, b), pad.id).toBeGreaterThan(3);
      for (const [nx, , nz] of Object.values(NODES))
        expect(Math.hypot(pad.x - nx, pad.z - nz), pad.id).toBeGreaterThan(3);
      for (const [sx, , sz] of SEATS) expect(Math.hypot(pad.x - sx, pad.z - sz)).toBeGreaterThan(3);
      for (const zone of Object.values(ZONES)) {
        const outside =
          Math.abs(pad.x - zone.center[0]) > zone.size[0] / 2 + 1 ||
          Math.abs(pad.z - zone.center[2]) > zone.size[1] / 2 + 1;
        expect(outside, pad.id).toBe(true);
      }
      for (const prop of YARD_PROPS)
        expect(Math.hypot(pad.x - prop.x, pad.z - prop.z), pad.id).toBeGreaterThan(2.5);
      const [x, y, z] = dockPadPoint(pad);
      expect([x, z]).toEqual([pad.x, pad.z]);
      expect(Number.isFinite(y)).toBe(true);
    }
    expect(
      Math.hypot(DOCK_PADS[0].x - DOCK_PADS[1].x, DOCK_PADS[0].z - DOCK_PADS[1].z),
    ).toBeGreaterThan(10);
  });

  it('parks on its pad under reduced motion with still rotors and a steady light', () => {
    for (const route of DRONE_ROUTES) {
      const parked = dronePose(route, 37.5, true);
      const home = route.stops[0].point;
      expect([parked.x, parked.y, parked.z]).toEqual(home);
      expect(parked.state).toBe('dock');
      expect(parked.rotor).toBe(0);
      // Each lap starts docked; the phase only shifts where in the lap time zero falls.
      const start = dronePose(route, -route.phase);
      expect(start.state).toBe('dock');
      expect([start.x, start.y, start.z]).toEqual(home);
    }
    for (const t of [0, 0.3, 1.1, 7]) expect(droneBlink(t, true)).toBe(droneBlink(0, true));
    const flashes = Array.from({ length: 28 }, (_, i) => droneBlink(i / 20, false));
    expect(Math.max(...flashes)).toBeGreaterThan(Math.min(...flashes) * 5);
  });

  it('moves continuously, visits every stop and returns to its pad each lap', () => {
    for (const route of DRONE_ROUTES) {
      const cycle = droneCycle(route);
      const path = samples(route, 0.1);
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const moved = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        // Eased phases peak at 1.5 times their mean speed; the bob adds a little.
        expect(moved, `${route.id} at ${i / 10}s`).toBeLessThan(
          Math.max(DRONE_SPEED, DRONE_CLIMB) * 0.1 * 1.55 + 0.03,
        );
      }
      for (const stop of route.stops) {
        const nearest = Math.min(
          ...path.map((pose) =>
            Math.hypot(pose.x - stop.point[0], pose.y - stop.point[1], pose.z - stop.point[2]),
          ),
        );
        expect(nearest, `${route.id} reaches ${stop.id}`).toBeLessThan(0.3);
      }
      const states = new Set(path.map((pose) => pose.state));
      expect([...states].sort()).toEqual(['dock', 'hover', 'travel']);
      const lap = dronePose(route, cycle);
      const first = dronePose(route, 0);
      expect(Math.hypot(lap.x - first.x, lap.y - first.y, lap.z - first.z)).toBeLessThan(0.01);
      expect(route.stops.length).toBeGreaterThanOrEqual(4);
    }
    expect(DRONE_ROUTES[0].phase).not.toBe(DRONE_ROUTES[1].phase);
    expect(DRONE_SIZE).toBeLessThanOrEqual(0.6);
  });
});
