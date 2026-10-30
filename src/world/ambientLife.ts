// Pure helpers for ambient life: blowing dust, dust devils, beacon pulses and
// the spaceport rover's patrol. Everything here is decorative and deterministic
// in time; nothing reads or writes resident state.

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
