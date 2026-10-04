import { EAST_TRAIL_XZ } from './dawnlightPlacement';

// Windward shares Dawnlight's safe promenade exit before turning north-east.
// Keep these plan coordinates independent of terrain and layout modules.
export const WINDWARD_MILL = {
  id: 'windward:mill',
  label: 'Windward Mill',
  centerX: 72,
  centerZ: -19,
  x: 76,
  z: -12,
  footprintRadius: 5.5,
  clearingRadius: 9,
  focusRadius: 12,
} as const;

export const WINDWARD_DAWNLIGHT_BRANCH_INDEX = 6;
type GroundPoint = readonly [number, number];
const CONTROLS: readonly GroundPoint[] = [
  EAST_TRAIL_XZ[WINDWARD_DAWNLIGHT_BRANCH_INDEX],
  [16, 7],
  [24, 0],
  [36, -5],
  [49, -10],
  [60, -13],
  [68, -13],
  [WINDWARD_MILL.x, WINDWARD_MILL.z],
];

export const WINDWARD_BRANCH_XZ: readonly GroundPoint[] = CONTROLS.flatMap((from, index) => {
  const to = CONTROLS[index + 1];
  if (!to) return [from];
  const sections = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 2.1);
  return Array.from({ length: sections }, (_, section) => {
    const t = section / sections;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as const;
  });
});

export const WINDWARD_TRAIL_XZ: readonly GroundPoint[] = [
  ...EAST_TRAIL_XZ.slice(0, WINDWARD_DAWNLIGHT_BRANCH_INDEX),
  ...WINDWARD_BRANCH_XZ,
];

function distanceToSegment(x: number, z: number, from: GroundPoint, to: GroundPoint) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared))
    : 0;
  return Math.hypot(x - from[0] - t * dx, z - from[1] - t * dz);
}

export function clearOfWindwardTrail(x: number, z: number, margin = 0) {
  if (
    Math.hypot(x - WINDWARD_MILL.centerX, z - WINDWARD_MILL.centerZ) <=
    WINDWARD_MILL.clearingRadius + margin
  )
    return false;
  for (let index = 1; index < WINDWARD_TRAIL_XZ.length; index++)
    if (
      distanceToSegment(x, z, WINDWARD_TRAIL_XZ[index - 1], WINDWARD_TRAIL_XZ[index]) <=
      2.2 + margin
    )
      return false;
  return true;
}
