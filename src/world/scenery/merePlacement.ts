export const SOUTHWIND_MERE = { x: -55, z: 45, waterRadius: 7.4, shoreRadius: 16 } as const;

export function waterRadiusAt(angle: number) {
  return (
    SOUTHWIND_MERE.waterRadius *
    (1 + 0.06 * Math.sin(angle * 3 + 0.5) + 0.045 * Math.cos(angle * 5 - 0.7))
  );
}

export function distanceToSouthwindMere(x: number, z: number) {
  return Math.hypot(x - SOUTHWIND_MERE.x, z - SOUTHWIND_MERE.z);
}

export function clearOfSouthwindMere(x: number, z: number, margin = 0) {
  return distanceToSouthwindMere(x, z) > SOUTHWIND_MERE.shoreRadius + margin;
}
