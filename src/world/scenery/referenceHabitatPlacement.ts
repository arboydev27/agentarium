// Keep the reference asset north/east of the existing expedition arrival corridor.
export const REFERENCE_HABITAT = { x: 43.8, z: -77, width: 7.2, depth: 4.35 } as const;

// The camera's approach corridor stays open as well as the site's footprint.
export function clearOfReferenceHabitat(x: number, z: number, margin = 0) {
  if (Math.hypot(x - REFERENCE_HABITAT.x, z - REFERENCE_HABITAT.z) < 18 + margin) return false;
  const ax = REFERENCE_HABITAT.x,
    az = REFERENCE_HABITAT.z;
  const dx = 61 - ax,
    dz = -55 - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz) > 6 + margin;
}
