// Shared 2D plan for the eastern walking route. Scenery and navigation apply
// walkwayHeight separately so this placement module has no terrain dependency.
export const DAWNLIGHT_GLASSHOUSE = {
  id: 'dawnlight:glasshouse',
  label: 'Dawnlight glasshouse',
  x: 48,
  z: 31,
  centerX: 43,
  centerZ: 26,
  clearingRadius: 8.5,
  focusRadius: 12,
} as const;

type GroundPoint = readonly [number, number];
const CONTROLS: readonly GroundPoint[] = [
  [0.1, 8],
  [12, 10],
  [20, 12],
  [28, 17],
  [36, 22],
  [43, 27],
  [DAWNLIGHT_GLASSHOUSE.x, DAWNLIGHT_GLASSHOUSE.z],
];

export const EAST_TRAIL_XZ: readonly GroundPoint[] = CONTROLS.flatMap((from, index) => {
  const to = CONTROLS[index + 1];
  if (!to) return [from];
  const sections = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 2.1);
  return Array.from({ length: sections }, (_, section) => {
    const t = section / sections;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as const;
  });
});

function distanceToSegment(x: number, z: number, from: GroundPoint, to: GroundPoint) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared))
    : 0;
  return Math.hypot(x - from[0] - t * dx, z - from[1] - t * dz);
}

export function clearOfDawnlightTrail(x: number, z: number, margin = 0) {
  if (
    Math.hypot(x - DAWNLIGHT_GLASSHOUSE.centerX, z - DAWNLIGHT_GLASSHOUSE.centerZ) <=
    DAWNLIGHT_GLASSHOUSE.clearingRadius + margin
  )
    return false;
  for (let index = 1; index < EAST_TRAIL_XZ.length; index++)
    if (distanceToSegment(x, z, EAST_TRAIL_XZ[index - 1], EAST_TRAIL_XZ[index]) <= 2.2 + margin)
      return false;
  return true;
}
