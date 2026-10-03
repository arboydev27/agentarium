import { CAMERA_VIEWS, OBSERVATORY } from '../layout';
import { meadowTrailPoint } from '../terrain';

export const OBSERVATORY_BRANCH: readonly [number, number][] = [
  [-4, -47.8],
  [-12, -49],
  [-20, -50],
  [-27, -50],
  [OBSERVATORY.x, OBSERVATORY.z],
];

function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared))
    : 0;
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

export function clearOfObservatory(x: number, z: number, margin = 0) {
  if (Math.hypot(x - OBSERVATORY.x, z - OBSERVATORY.z) < OBSERVATORY.clearingRadius + 2.7 + margin)
    return false;
  const [startX, , startZ] = meadowTrailPoint(16);
  const points: readonly [number, number][] = [[startX, startZ], ...OBSERVATORY_BRANCH];
  for (let index = 1; index < points.length; index++) {
    const [ax, az] = points[index - 1];
    const [bx, bz] = points[index];
    if (distanceToSegment(x, z, ax, az, bx, bz) < 2.65 + margin) return false;
  }
  return true;
}

export function clearOfObservatoryView(x: number, z: number) {
  const [cameraX, , cameraZ] = CAMERA_VIEWS.observatory.pos;
  return distanceToSegment(x, z, cameraX, cameraZ, OBSERVATORY.x, OBSERVATORY.z) >= 6.6;
}
