// Pure helpers for ambient life: blowing dust, dust devils, beacon pulses, the
// rover loops, the roof dish's tracking and the telescope's slews. Everything here
// is decorative and deterministic in time; nothing reads or writes resident state.

import { NORTHSTAR_TOWER_XZ } from './scenery/northstarPlacement';
import { WINDWARD_MILL } from './scenery/windwardPlacement';

export type GroundPose = { x: number; z: number; heading: number };

/** Prevailing wind on the plains, in metres per second (world X/Y/Z). */
export const WIND: readonly [number, number, number] = [-1.7, 0.12, 0.95];

/** Dust particle count per quality tier; low quality draws none. */
export const DUST_COUNT = { high: 1400, low: 0 } as const;
/** Box the dust field wraps inside, centred on the camera focus. */
export const DUST_BOX: readonly [number, number, number] = [150, 22, 150];

/**
 * Dust devils wander on open plains well away from the colony, its trails and
 * every authored destination. Each loops around its own centre.
 */
export const DUST_DEVILS: readonly {
  center: readonly [number, number];
  radius: number;
  period: number;
  height: number;
}[] = [
  // North-west and north-east of the colony, in view of the Overview and Horizon shots.
  { center: [-45, -120], radius: 14, period: 150, height: 16 },
  { center: [80, -160], radius: 18, period: 190, height: 19 },
  // East, in view of the Dawnlight and Helios shots.
  { center: [125, 95], radius: 22, period: 170, height: 14 },
];
/** Seconds of each devil's cycle; it is alive for `DEVIL_ACTIVE` of them. */
export const DEVIL_CYCLE = 70;
export const DEVIL_ACTIVE = 42;

/** 0..1 presence of a devil (fade in, hold, fade out), and its ground pose. */
export function dustDevilState(time: number, index: number) {
  const devil = DUST_DEVILS[index];
  const phase = (time + index * 23.7) % DEVIL_CYCLE;
  const presence = phase >= DEVIL_ACTIVE ? 0 : Math.min(1, phase / 6, (DEVIL_ACTIVE - phase) / 8);
  const angle = ((time + index * 41) / devil.period) * Math.PI * 2;
  const wobble = Math.sin(time * 0.37 + index) * 3;
  return {
    presence,
    x: devil.center[0] + Math.cos(angle) * devil.radius + wobble,
    z: devil.center[1] + Math.sin(angle) * devil.radius * 0.7,
    spin: time * 2.6 + index,
  };
}

/** Beacon lights breathe on a slow blink; reduced motion holds them steady. */
export function beaconPulse(time: number, reduced: boolean) {
  if (reduced) return 2;
  const t = (time % 1.6) / 1.6;
  const flash = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 6);
  return 0.9 + 1.9 * flash;
}

/** The spaceport rover's loop east of the pad, in pad-local metres. */
export const ROVER_LOOP = { center: [10.6, 1] as const, radii: [4.6, 3.4] as const, period: 48 };

export function roverPatrolPose(time: number): GroundPose {
  const { center, radii, period } = ROVER_LOOP;
  const a = (time / period) * Math.PI * 2;
  const x = center[0] + Math.cos(a) * radii[0];
  const z = center[1] + Math.sin(a) * radii[1];
  // Heading follows the tangent; the kit rover faces +Z.
  const dx = -Math.sin(a) * radii[0];
  const dz = Math.cos(a) * radii[1];
  return { x, z, heading: Math.atan2(dx, dz) };
}

/** Expanding dust wash under a launching rocket: scale and opacity for `seconds` since ignition. */
export function launchDustWash(seconds: number) {
  if (seconds < 0 || seconds > 3) return { scale: 0, opacity: 0 };
  const t = seconds / 3;
  return { scale: 1 + 13 * Math.sqrt(t), opacity: 0.55 * (1 - t) * (1 - t) };
}

export type RoverLoopId = 'northstar' | 'helios' | 'plains';
export type RoverLoop = {
  id: RoverLoopId;
  /** Ellipse centre in world metres. */
  center: readonly [number, number];
  radii: readonly [number, number];
  /** Seconds per lap. */
  period: number;
  /** Metres either side of the path kept free of rocks and groundcover. */
  margin: number;
};

/**
 * Every rover loop in world space. The spaceport loop is the pad-local
 * ROVER_LOOP above; the Helios rover circles the open ground east of the habitat,
 * inside its shot and clear of the trail that ends south-east of it; the plains
 * rover surveys the flats west of the northern trail, between the colony and the
 * Deep Sky Array.
 */
export const ROVER_LOOPS: readonly RoverLoop[] = [
  {
    id: 'northstar',
    center: [
      NORTHSTAR_TOWER_XZ[0] + ROVER_LOOP.center[0],
      NORTHSTAR_TOWER_XZ[1] + ROVER_LOOP.center[1],
    ],
    radii: ROVER_LOOP.radii,
    period: ROVER_LOOP.period,
    margin: 2.2,
  },
  {
    id: 'helios',
    center: [WINDWARD_MILL.centerX + 13, WINDWARD_MILL.centerZ - 4],
    radii: [5, 5.5],
    period: 60,
    margin: 2.2,
  },
  { id: 'plains', center: [-16, -32], radii: [9, 7], period: 110, margin: 2.4 },
];

export function roverLoopById(id: RoverLoopId): RoverLoop {
  return ROVER_LOOPS.find((loop) => loop.id === id)!;
}

/** World pose on a loop at `time`; `phase` offsets the start point in seconds. */
export function roverLoopPose(loop: RoverLoop, time: number, phase = 0): GroundPose {
  const a = ((time + phase) / loop.period) * Math.PI * 2;
  const x = loop.center[0] + Math.cos(a) * loop.radii[0];
  const z = loop.center[1] + Math.sin(a) * loop.radii[1];
  const dx = -Math.sin(a) * loop.radii[0];
  const dz = Math.cos(a) * loop.radii[1];
  return { x, z, heading: Math.atan2(dx, dz) };
}

/**
 * False within a loop's margin (plus `extra`) of its path, so decorative rocks
 * and groundcover never stand where a rover drives. The ring distance is taken
 * in normalised ellipse space scaled by the smaller radius, which errs wide.
 */
export function clearOfRoverLoops(x: number, z: number, extra = 0) {
  for (const loop of ROVER_LOOPS) {
    const dx = (x - loop.center[0]) / loop.radii[0];
    const dz = (z - loop.center[1]) / loop.radii[1];
    const ring = Math.abs(Math.hypot(dx, dz) - 1) * Math.min(loop.radii[0], loop.radii[1]);
    if (ring < loop.margin + extra) return false;
  }
  return true;
}

/** Dust kicked up behind a moving rover: a soft puff that breathes a little. */
export function roverDustPuff(time: number, reduced: boolean) {
  if (reduced) return { scale: 0, opacity: 0 };
  return {
    scale: 1.35 + Math.sin(time * 5.3) * 0.2,
    opacity: 0.2 + Math.sin(time * 7.1 + 1) * 0.06,
  };
}

const smooth = (t: number) => {
  const s = Math.min(1, Math.max(0, t));
  return s * s * (3 - 2 * s);
};

/**
 * The Comms Court roof dish tracks slowly across the sky, swings back in a few
 * seconds and holds while it re-acquires. Yaw is radians around the mount.
 */
export const DISH_TRACK = { start: -0.35, sweep: 1.15, track: 58, slew: 3, hold: 11 } as const;
export function dishTrackPose(time: number): { yaw: number; tracking: boolean } {
  const { start, sweep, track, slew, hold } = DISH_TRACK;
  const t = time % (track + slew + hold);
  if (t < track) return { yaw: start + (sweep * t) / track, tracking: true };
  if (t < track + slew)
    return { yaw: start + sweep * (1 - smooth((t - track) / slew)), tracking: false };
  return { yaw: start, tracking: false };
}

/**
 * The Deep Sky telescope dwells on each target in turn and slews between them by
 * the short way round. The yaw path is cumulative so a slew never wraps mid-way;
 * these targets' short arcs sum to zero, so each cycle ends where it began.
 */
export const TELESCOPE_TARGETS: readonly number[] = [0.35, -1.25, 1.1, 2.3];
export const TELESCOPE_DWELL = 20;
export const TELESCOPE_SLEW = 4;
const shortArc = (from: number, to: number) => {
  let arc = (to - from) % (Math.PI * 2);
  if (arc > Math.PI) arc -= Math.PI * 2;
  if (arc < -Math.PI) arc += Math.PI * 2;
  return arc;
};
/** Continuous yaw at the start of each dwell, ending with the return to the first target. */
const TELESCOPE_PATH: readonly number[] = TELESCOPE_TARGETS.reduce<number[]>(
  (path, target, index) => {
    const next = TELESCOPE_TARGETS[(index + 1) % TELESCOPE_TARGETS.length];
    path.push(path[index] + shortArc(target, next));
    return path;
  },
  [TELESCOPE_TARGETS[0]],
);
export function telescopeSlewPose(time: number): { yaw: number; slewing: boolean } {
  const step = TELESCOPE_DWELL + TELESCOPE_SLEW;
  const count = TELESCOPE_TARGETS.length;
  const cycle = step * count;
  const laps = Math.floor(time / cycle);
  const t = time - laps * cycle;
  const index = Math.floor(t / step);
  const local = t - index * step;
  const base = laps * (TELESCOPE_PATH[count] - TELESCOPE_PATH[0]);
  const from = base + TELESCOPE_PATH[index];
  const to = base + TELESCOPE_PATH[index + 1];
  if (local < TELESCOPE_DWELL) return { yaw: from, slewing: false };
  return {
    yaw: from + (to - from) * smooth((local - TELESCOPE_DWELL) / TELESCOPE_SLEW),
    slewing: true,
  };
}
