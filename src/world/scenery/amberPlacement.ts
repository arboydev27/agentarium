// Scenic-only western landform. It has no resident route, destination node, or
// task meaning. Clearing is reserved for its authored rock and sparse foliage.
export const AMBER_BLUFF = {
  id: 'amber:bluff',
  label: 'Amber Bluff',
  x: -104,
  z: 88,
  footprintRadius: 11,
  clearingRadius: 14,
  focusRadius: 16,
} as const;

export function clearOfAmberBluff(x: number, z: number, margin = 0) {
  return Math.hypot(x - AMBER_BLUFF.x, z - AMBER_BLUFF.z) >= AMBER_BLUFF.clearingRadius + margin;
}
