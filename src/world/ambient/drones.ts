import { ROOF_DISH, roofTop } from '../habitat/habitatLayout';
import { LOOKOUT, ZONES, type ZoneName } from '../layout';
import type { Point } from '../motion';
import { terrainHeight } from '../terrain';

// Two maintenance drones: routes, dock pads and the altitude profile. Pure and
// deterministic in time; nothing here reads or writes resident state. Drones
// are small (DRONE_SIZE across) and cruise well above every lane and roof, so
// they are never a body in a corridor and never mistaken for a resident.

/** Rotor tip to rotor tip, in metres. */
export const DRONE_SIZE = 0.6;
/** Cruise speed between stops, metres per second. */
export const DRONE_SPEED = 2.4;
/** Lowest cruise height over the colony, well above every roof and lane; higher stops raise it. */
export const DRONE_CRUISE = 6.5;
/** Metres a drone keeps above any lane it passes over. */
export const DRONE_LANE_CLEARANCE = 3;
/** Height of a docked drone's body above its pad. */
export const DOCK_HEIGHT = 0.32;
export const DOCK_PAUSE = 9;
export const HOVER_PAUSE = 6;

export type DroneStop = { id: string; point: Point; kind: 'dock' | 'hover'; pause: number };
export type DroneRoute = {
  id: 'west' | 'east';
  stops: readonly DroneStop[];
  /** Seconds of head start, so the two drones are never in step. */
  phase: number;
};
export type DroneState = 'dock' | 'hover' | 'travel';
export type DronePose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  state: DroneState;
  /** Rotor spin angle in radians. */
  rotor: number;
};

/** Ground pads outside the decks, clear of every lane and the yard hardware. */
export const DOCK_PADS: readonly { id: string; x: number; z: number }[] = [
  { id: 'pad-west', x: -14.5, z: -1.2 },
  { id: 'pad-east', x: 14, z: -10.5 },
];
/** Top surface of a pad. */
export function dockPadPoint(pad: { x: number; z: number }): Point {
  return [pad.x, terrainHeight(pad.x, pad.z) + 0.06, pad.z];
}

const dock = (pad: (typeof DOCK_PADS)[number]): DroneStop => {
  const [x, y, z] = dockPadPoint(pad);
  return { id: pad.id, point: [x, y + DOCK_HEIGHT, z], kind: 'dock', pause: DOCK_PAUSE };
};
const roof = (zone: ZoneName): DroneStop => {
  const [cx, , cz] = ZONES[zone].center;
  return {
    id: `${zone}-roof`,
    point: [cx, roofTop(zone) + 1.6, cz],
    kind: 'hover',
    pause: HOVER_PAUSE,
  };
};
const RELAY_MAST = { x: LOOKOUT.x - 6.5, z: LOOKOUT.z - 6, platform: 8.6 } as const;

export const DRONE_ROUTES: readonly DroneRoute[] = [
  {
    id: 'west',
    phase: 0,
    stops: [
      dock(DOCK_PADS[0]),
      roof('café'),
      {
        id: 'dish',
        point: [ROOF_DISH.x + 1.3, roofTop(ROOF_DISH.zone) + 5.2, ROOF_DISH.z],
        kind: 'hover',
        pause: HOVER_PAUSE,
      },
      roof('courtyard'),
    ],
  },
  {
    id: 'east',
    phase: 23,
    stops: [
      dock(DOCK_PADS[1]),
      roof('studio'),
      roof('garden'),
      {
        id: 'relay',
        point: [
          RELAY_MAST.x + 1.4,
          terrainHeight(RELAY_MAST.x, RELAY_MAST.z) + RELAY_MAST.platform + 1.4,
          RELAY_MAST.z,
        ],
        kind: 'hover',
        pause: HOVER_PAUSE,
      },
    ],
  },
];

const smooth = (t: number) => {
  const s = Math.min(1, Math.max(0, t));
  return s * s * (3 - 2 * s);
};

/** Vertical speed on take-off and landing, metres per second. */
export const DRONE_CLIMB = 1.8;
/** Cruise height for a leg: above both ends, and never below the colony minimum. */
export function legCruise(from: number, to: number) {
  return Math.max(from + 1.2, to + 1.2, DRONE_CRUISE);
}

type Leg = {
  from: DroneStop;
  to: DroneStop;
  start: number;
  cruise: number;
  climb: number;
  cross: number;
  descend: number;
};
const timelines = new Map<string, { legs: Leg[]; cycle: number }>();
// Each leg is a take-off straight up to cruise, a level crossing, and a landing
// straight down, so a drone never cuts through a wall or a roof edge on its way.
function timeline(route: DroneRoute) {
  let cached = timelines.get(route.id);
  if (cached) return cached;
  const legs: Leg[] = [];
  let clock = 0;
  route.stops.forEach((stop, index) => {
    const next = route.stops[(index + 1) % route.stops.length];
    const cruise = legCruise(stop.point[1], next.point[1]);
    const climb = Math.max(1, Math.abs(cruise - stop.point[1]) / DRONE_CLIMB);
    const cross = Math.max(
      1.5,
      Math.hypot(next.point[0] - stop.point[0], next.point[2] - stop.point[2]) / DRONE_SPEED,
    );
    const descend = Math.max(1, Math.abs(cruise - next.point[1]) / DRONE_CLIMB);
    legs.push({ from: stop, to: next, start: clock, cruise, climb, cross, descend });
    clock += stop.pause + climb + cross + descend;
  });
  cached = { legs, cycle: clock };
  timelines.set(route.id, cached);
  return cached;
}
/** Seconds for one lap of the route, pauses included. */
export function droneCycle(route: DroneRoute) {
  return timeline(route).cycle;
}

/** Where a drone is at `time`; reduced motion parks it on its pad with still rotors. */
export function dronePose(route: DroneRoute, time: number, reduced = false): DronePose {
  const { legs, cycle } = timeline(route);
  const home = route.stops[0].point;
  if (reduced) return { x: home[0], y: home[1], z: home[2], heading: 0, state: 'dock', rotor: 0 };
  const t = (((time + route.phase) % cycle) + cycle) % cycle;
  const rotor = time * 42;
  const bob = Math.sin(time * 2.3 + route.phase);
  for (const leg of legs) {
    const local = t - leg.start;
    const total = leg.from.pause + leg.climb + leg.cross + leg.descend;
    if (local < 0 || local >= total) continue;
    const [ax, ay, az] = leg.from.point;
    const [bx, by, bz] = leg.to.point;
    const heading = Math.atan2(bx - ax, bz - az);
    if (local < leg.from.pause) {
      const hover = leg.from.kind === 'dock' ? 0 : bob * 0.1;
      return { x: ax, y: ay + hover, z: az, heading: time * 0.25, state: leg.from.kind, rotor };
    }
    let phase = local - leg.from.pause;
    if (phase < leg.climb) {
      const s = smooth(phase / leg.climb);
      return { x: ax, y: ay + (leg.cruise - ay) * s, z: az, heading, state: 'travel', rotor };
    }
    phase -= leg.climb;
    if (phase < leg.cross) {
      const s = smooth(phase / leg.cross);
      return {
        x: ax + (bx - ax) * s,
        y: leg.cruise + bob * 0.06,
        z: az + (bz - az) * s,
        heading,
        state: 'travel',
        rotor,
      };
    }
    phase -= leg.cross;
    const s = smooth(phase / leg.descend);
    return { x: bx, y: leg.cruise + (by - leg.cruise) * s, z: bz, heading, state: 'travel', rotor };
  }
  const [x, y, z] = home;
  return { x, y, z, heading: 0, state: 'dock', rotor };
}

/** Emissive strength of the drone's light: a short flash every 1.4 s, steady under reduced motion. */
export function droneBlink(time: number, reduced: boolean) {
  if (reduced) return 1.2;
  const phase = time % 1.4;
  return phase < 0.1 ? 3.2 : 0.25;
}
