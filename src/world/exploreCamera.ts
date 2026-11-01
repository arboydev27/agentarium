import * as THREE from 'three';
import { CAMERA_PAN_BOUNDS } from './cameraPan';
import { SURFACE_FAR } from './perspective';
import { terrainHeight, walkwayHeight } from './terrain';

// The explore camera: the eye stays above the ground wherever the orbit puts
// it, the orbit may come down to head height and a little below its target's
// plane, and a double-click on the ground travels the orbit there. Pure
// helpers; World.tsx wires them into the camera frame loop and the controls.

/** Metres the eye keeps above the ground, whichever of the two height fields is higher there. */
export const CAMERA_CLEARANCE = 1.2;
/** Closest the orbit may zoom to its target, so the eye can stand at head height. */
export const EXPLORE_MIN_DISTANCE = 2.5;
/** Polar limit: a little below the target's horizontal plane, since the clearance keeps the eye up. */
export const EXPLORE_MAX_POLAR = Math.PI / 2 + 0.12;
/** Metres the ground march advances between height samples before it bisects the crossing. */
export const GROUND_MARCH_STEP = 1;

/** Lowest the eye may be at a ground position. */
export function cameraFloor(x: number, z: number) {
  return walkwayHeight(x, z, CAMERA_CLEARANCE);
}

/** Raise `position` onto the floor when it is under it; returns the lift applied, 0 when none. */
export function clampCameraPosition(position: THREE.Vector3) {
  const floor = cameraFloor(position.x, position.z);
  const lift = floor - position.y;
  if (lift <= 0) return 0;
  position.y = floor;
  return lift;
}

export type GroundHit = { x: number; y: number; z: number; distance: number };

/**
 * Where a ray meets the terrain: samples `terrainHeight` every GROUND_MARCH_STEP
 * metres along the ray and bisects the first crossing. Null when the ray stays
 * above the ground out to `maxDistance` or starts under it.
 */
export function groundHit(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance = SURFACE_FAR,
): GroundHit | null {
  const unit = direction.clone().normalize();
  const point = new THREE.Vector3();
  const above = (distance: number) => {
    point.copy(origin).addScaledVector(unit, distance);
    return point.y - terrainHeight(point.x, point.z);
  };
  if (above(0) <= 0) return null;
  let before = 0;
  for (let distance = GROUND_MARCH_STEP; distance <= maxDistance; distance += GROUND_MARCH_STEP) {
    if (above(distance) > 0) {
      before = distance;
      continue;
    }
    let low = before;
    let high = distance;
    for (let i = 0; i < 20; i++) {
      const middle = (low + high) / 2;
      if (above(middle) > 0) low = middle;
      else high = middle;
    }
    point.copy(origin).addScaledVector(unit, high);
    return { x: point.x, y: terrainHeight(point.x, point.z), z: point.z, distance: high };
  }
  return null;
}

/** The orbit target a double-click travels to: the hit's ground position, kept inside the travel bounds. */
export function travelDestination(hit: Pick<GroundHit, 'x' | 'z'>) {
  return {
    x: THREE.MathUtils.clamp(hit.x, CAMERA_PAN_BOUNDS.minX, CAMERA_PAN_BOUNDS.maxX),
    z: THREE.MathUtils.clamp(hit.z, CAMERA_PAN_BOUNDS.minZ, CAMERA_PAN_BOUNDS.maxZ),
  };
}

/** World direction of the ray through a viewport point in normalised device coordinates. */
export function screenRay(camera: THREE.Camera, ndcX: number, ndcY: number) {
  return new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
}
