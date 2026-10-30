import type { ZoneName } from '../layout';
import { footprint, type Side } from './habitatLayout';

// Dollhouse reveal: close cameras and selected residents open a module up by
// fading its roof and the walls between the camera and the interior.

/** Camera-to-module distance at which the module is fully open. */
export const REVEAL_NEAR = 22;
/** Distance beyond which the module is fully closed. */
export const REVEAL_FAR = 30;

export function revealAmount(distance: number, forced = false) {
  if (forced) return 1;
  const t = Math.min(1, Math.max(0, (REVEAL_FAR - distance) / (REVEAL_FAR - REVEAL_NEAR)));
  return t * t * (3 - 2 * t);
}

/** True when the camera is beyond this wall, so the wall stands between it and the room. */
export function sideFacesCamera(side: Side, zone: ZoneName, camera: { x: number; z: number }) {
  const { minX, maxX, minZ, maxZ } = footprint(zone);
  switch (side) {
    case 'south':
      return camera.z > maxZ;
    case 'north':
      return camera.z < minZ;
    case 'east':
      return camera.x > maxX;
    case 'west':
      return camera.x < minX;
  }
}

/** Opacity for a faded part: `floor` is the fraction that stays as a ghost outline. */
export function fadedOpacity(base: number, fade: number, floor: number) {
  return base * (floor + (1 - floor) * (1 - fade));
}
