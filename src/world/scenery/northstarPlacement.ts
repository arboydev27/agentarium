// Terrain-independent plan for the orchard approach to the northern outpost.
export const NORTHSTAR_OUTPOST = {
  id: 'northstar:outpost',
  label: 'Northstar Outpost',
  x: 43,
  z: -112,
  centerX: 43,
  centerZ: -112,
  clearingRadius: 6,
  focusRadius: 11,
} as const;

export const NORTHSTAR_TOWER_XZ = [49, -118] as const;

type GroundPoint = readonly [number, number];
export const NORTHSTAR_BRANCH: readonly GroundPoint[] = [
  [15, -65.25],
  [16, -72],
  [19, -79],
  [23, -86],
  [28, -94],
  [35, -103],
  [NORTHSTAR_OUTPOST.x, NORTHSTAR_OUTPOST.z],
];

export const NORTHSTAR_TRAIL_XZ: readonly GroundPoint[] = NORTHSTAR_BRANCH.flatMap(
  (from, index) => {
    const to = NORTHSTAR_BRANCH[index + 1];
    if (!to) return [from];
    const sections = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 1.8);
    return Array.from({ length: sections }, (_, section) => {
      const t = section / sections;
      return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as const;
    });
  },
);

function distanceToSegment(x: number, z: number, from: GroundPoint, to: GroundPoint) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared))
    : 0;
  return Math.hypot(x - from[0] - t * dx, z - from[1] - t * dz);
}

// False means optional vegetation and props must keep the path or outpost arrival open.
export function clearOfNorthstarTrail(x: number, z: number, margin = 0) {
  if (
    Math.hypot(x - NORTHSTAR_OUTPOST.x, z - NORTHSTAR_OUTPOST.z) <
    NORTHSTAR_OUTPOST.clearingRadius + margin
  )
    return false;
  for (let index = 1; index < NORTHSTAR_BRANCH.length; index++)
    if (
      distanceToSegment(x, z, NORTHSTAR_BRANCH[index - 1], NORTHSTAR_BRANCH[index]) <
      2.5 + margin
    )
      return false;
  return true;
}

// Reserve the signal tower independently of the terminal resident clearing.
export function clearOfNorthstarStructure(x: number, z: number, margin = 0) {
  return Math.hypot(x - NORTHSTAR_TOWER_XZ[0], z - NORTHSTAR_TOWER_XZ[1]) >= 4.5 + margin;
}
