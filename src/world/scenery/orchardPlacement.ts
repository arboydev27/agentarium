import { CAMERA_VIEWS, ORCHARD } from '../layout';
import { meadowTrailPoint } from '../terrain';

export const ORCHARD_BRANCH: readonly [number, number][] = [
  [10, -64],
  [20, -66.5],
  [29, -68.5],
  [ORCHARD.x, ORCHARD.z],
];

export const ORCHARD_PAVILION = { x: ORCHARD.x + 7.8, z: ORCHARD.z - 7 } as const;

function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

// Existing meadow detail and distant grove trees must not occupy the arrival
// route, level commons, or the pavilion footprint.
export function clearOfOrchard(x: number, z: number, margin = 0) {
  if (Math.hypot(x - ORCHARD.x, z - ORCHARD.z) < ORCHARD.clearingRadius + 2.7 + margin)
    return false;
  if (Math.hypot(x - ORCHARD_PAVILION.x, z - ORCHARD_PAVILION.z) < 4.6 + margin) return false;
  const [startX, , startZ] = meadowTrailPoint(22);
  const points: readonly [number, number][] = [[startX, startZ], ...ORCHARD_BRANCH];
  for (let i = 1; i < points.length; i++) {
    if (distanceToSegment(x, z, ...points[i - 1], ...points[i]) < 2.65 + margin) return false;
  }
  return true;
}

// Frame the commons from its camera bookmark through an opening in the older
// pine grove. Orchard trees remain beside the opening and give it depth.
export function clearOfOrchardView(x: number, z: number) {
  const [cameraX, , cameraZ] = CAMERA_VIEWS.orchard.pos;
  return (
    distanceToSegment(x, z, cameraX, cameraZ, ORCHARD.x, ORCHARD.z) >= 6.6 &&
    distanceToSegment(x, z, cameraX, cameraZ, ORCHARD_PAVILION.x, ORCHARD_PAVILION.z) >= 5.2
  );
}
