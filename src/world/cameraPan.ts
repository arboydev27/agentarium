import { MathUtils, Vector3 } from 'three';

export type PanKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

// Keep the orbit target inside the populated part of the finite landscape.
// At the 190-unit orbit limit, an axis-aligned camera remains 195 units from
// the +/-510-unit ground-mesh edge, 30 beyond the 165-unit fog far distance.
export const CAMERA_PAN_BOUNDS = { minX: -125, maxX: 125, minZ: -125, maxZ: 125 } as const;

export function isPanKey(key: string): key is PanKey {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
}

export function clampPanDelta(target: Vector3) {
  return new Vector3(
    MathUtils.clamp(target.x, CAMERA_PAN_BOUNDS.minX, CAMERA_PAN_BOUNDS.maxX) - target.x,
    0,
    MathUtils.clamp(target.z, CAMERA_PAN_BOUNDS.minZ, CAMERA_PAN_BOUNDS.maxZ) - target.z,
  );
}

export function keyboardPanDelta(
  cameraPosition: Vector3,
  cameraTarget: Vector3,
  destination: Vector3,
  key: PanKey,
  distance: number,
) {
  // Project the view onto the ground plane so Horizon's shallow angle never
  // turns an arrow press into vertical movement or a change of orbit tilt.
  const forward = new Vector3(
    cameraTarget.x - cameraPosition.x,
    0,
    cameraTarget.z - cameraPosition.z,
  );
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  forward.normalize();
  const right = new Vector3(-forward.z, 0, forward.x);
  const direction =
    key === 'ArrowUp'
      ? forward
      : key === 'ArrowDown'
        ? forward.negate()
        : key === 'ArrowRight'
          ? right
          : right.negate();
  const nextX = MathUtils.clamp(
    destination.x + direction.x * distance,
    CAMERA_PAN_BOUNDS.minX,
    CAMERA_PAN_BOUNDS.maxX,
  );
  const nextZ = MathUtils.clamp(
    destination.z + direction.z * distance,
    CAMERA_PAN_BOUNDS.minZ,
    CAMERA_PAN_BOUNDS.maxZ,
  );
  return new Vector3(nextX - destination.x, 0, nextZ - destination.z);
}
