// Shared plan geometry for the walk from the courtyard to Southwind Mere's dry east shore.
// Keep this module independent of terrain: scenery and navigation apply their own walkable y.
export const SOUTHWIND_SHORE = {
  id: 'southwind:east-shore',
  label: 'Southwind Mere shore',
  x: -42,
  z: 43,
  clearingRadius: 2.8,
  focusRadius: 7,
} as const;

type GroundPoint = readonly [number, number];
const START: GroundPoint = [-6.2, 7.7];
const CONTROL_ONE: GroundPoint = [-19, 15.5];
const CONTROL_TWO: GroundPoint = [-35, 38.5];
const END: GroundPoint = [SOUTHWIND_SHORE.x, SOUTHWIND_SHORE.z];

export const SOUTHWIND_TRAIL_XZ: readonly GroundPoint[] = Array.from({ length: 19 }, (_, index) => {
  const t = index / 18;
  const u = 1 - t;
  const point = (axis: 0 | 1) =>
    u * u * u * START[axis] +
    3 * u * u * t * CONTROL_ONE[axis] +
    3 * u * t * t * CONTROL_TWO[axis] +
    t * t * t * END[axis];
  return [point(0), point(1)] as const;
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

export function clearOfSouthwindTrail(x: number, z: number, margin = 0) {
  if (
    Math.hypot(x - SOUTHWIND_SHORE.x, z - SOUTHWIND_SHORE.z) <=
    SOUTHWIND_SHORE.clearingRadius + margin
  )
    return false;
  for (let index = 1; index < SOUTHWIND_TRAIL_XZ.length; index++)
    if (
      distanceToSegment(x, z, SOUTHWIND_TRAIL_XZ[index - 1], SOUTHWIND_TRAIL_XZ[index]) <=
      2.2 + margin
    )
      return false;
  return true;
}
