import * as THREE from 'three';
import type { ScenicFrame, ScenicPoint } from './scenicVisibility';

/** Detail reach, in metres from the focus, for shots whose frame includes the horizon. */
export const HORIZON_GROUND_RADIUS = 150;

type GroundScratch = { near: THREE.Vector3; far: THREE.Vector3 };
const sharedScratch: GroundScratch = { near: new THREE.Vector3(), far: new THREE.Vector3() };

function groundIntersection(
  camera: THREE.Camera,
  ndcX: number,
  ndcY: number,
  height: number,
  scratch: GroundScratch,
): ScenicPoint | null {
  scratch.near.set(ndcX, ndcY, -1).unproject(camera);
  scratch.far.set(ndcX, ndcY, 1).unproject(camera);
  const dy = scratch.far.y - scratch.near.y;
  if (Math.abs(dy) < 0.025) return null;
  const t = (height - scratch.near.y) / dy;
  if (t < 0 || t > 1) return null;
  return {
    x: THREE.MathUtils.lerp(scratch.near.x, scratch.far.x, t),
    z: THREE.MathUtils.lerp(scratch.near.z, scratch.far.z, t),
  };
}

export function measureScenicFrame(camera: THREE.Camera): ScenicFrame {
  const scratch = sharedScratch;
  camera.updateMatrixWorld();
  const focus = groundIntersection(camera, 0, 0, 0, scratch);
  const cameraPoint = { x: camera.position.x, z: camera.position.z };
  if (!focus)
    return { focus: cameraPoint, camera: cameraPoint, visibleGroundRadius: HORIZON_GROUND_RADIUS };
  let radius = 0;
  for (const ndcX of [-1, 1]) {
    for (const ndcY of [-1, 1]) {
      const ground = groundIntersection(camera, ndcX, ndcY, 0, scratch);
      // A frame edge above the horizon sees the whole plain; mount detail only within a
      // finite reach so a composed shot does not load every landmark at once.
      if (!ground)
        return { focus, camera: cameraPoint, visibleGroundRadius: HORIZON_GROUND_RADIUS };
      radius = Math.max(radius, Math.hypot(ground.x - focus.x, ground.z - focus.z));
      // Tall landmarks can enter the view before their ground footprint does.
      const elevated = groundIntersection(camera, ndcX, ndcY, 12, scratch);
      if (elevated)
        radius = Math.max(radius, Math.hypot(elevated.x - focus.x, elevated.z - focus.z));
    }
  }
  return { focus, camera: cameraPoint, visibleGroundRadius: radius + 12 };
}
