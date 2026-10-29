// Shared, terrain-independent placement for the observatory-to-woodland spur.
export const WOODLAND_HOLLOW = {
  id: 'woodland:hollow',
  label: 'Basalt Field Station',
  x: -83,
  z: -20,
  clearingRadius: 5,
  focusRadius: 9,
} as const;

export const WOODLAND_SHELTER_XZ = [-88, -16.5] as const;

type GroundPoint = readonly [number, number];
export const WOODLAND_BRANCH: readonly GroundPoint[] = [
  [-27, -50],
  [-27, -45],
  [-31, -40],
  [-40, -35],
  [-50, -31],
  [-60, -27],
  [-70, -23],
  [-77, -21],
  [WOODLAND_HOLLOW.x, WOODLAND_HOLLOW.z],
];

// Subdivide authored controls so navigation chords and the visible ribbon share one centerline.
export const WOODLAND_TRAIL_XZ: readonly GroundPoint[] = WOODLAND_BRANCH.flatMap((from, index) => {
  const to = WOODLAND_BRANCH[index + 1];
  if (!to) return [from];
  const sections = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 2);
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

// Keep the open shelter footprint separate from the resident arrival clearing.
export function clearOfWoodlandShelter(x: number, z: number, margin = 0) {
  return Math.hypot(x - WOODLAND_SHELTER_XZ[0], z - WOODLAND_SHELTER_XZ[1]) >= 4.8 + margin;
}

// False means scenery must leave the walkable spur or either clearing empty.
export function clearOfWoodlandHollow(x: number, z: number, margin = 0) {
  if (
    Math.hypot(x - WOODLAND_HOLLOW.x, z - WOODLAND_HOLLOW.z) <
    WOODLAND_HOLLOW.clearingRadius + margin
  )
    return false;
  for (let index = 1; index < WOODLAND_BRANCH.length; index++)
    if (distanceToSegment(x, z, WOODLAND_BRANCH[index - 1], WOODLAND_BRANCH[index]) < 2.5 + margin)
      return false;
  return true;
}
