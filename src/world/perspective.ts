import * as THREE from 'three';
import { CAMERA_VIEWS, type WorldView } from './layout';

/** Vertical field of view of the surface camera, in degrees. */
export const SURFACE_FOV = 38;
export const SURFACE_NEAR = 0.5;
export const SURFACE_FAR = 420;
/** Orbit distance at which the surface hands over to the planet view. */
export const SURFACE_MAX_DISTANCE = 190;

/**
 * Distance at which a preset's authored ground span fills the viewport.
 * Presets were authored for an orthographic camera, where `span` was the
 * visible width and height at the focus plane; this reproduces that framing
 * with perspective.
 */
export function fitDistance(span: readonly [number, number], fov: number, aspect: number) {
  const vertical = THREE.MathUtils.degToRad(fov);
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  return Math.max(span[1] / 2 / Math.tan(vertical / 2), span[0] / 2 / Math.tan(horizontal / 2));
}

/** Camera position for a preset: its authored direction at the fitted distance. */
export function presetPosition(
  view: WorldView,
  aspect: number,
  fov = SURFACE_FOV,
  target = new THREE.Vector3(),
) {
  const preset = CAMERA_VIEWS[view];
  const look = new THREE.Vector3(...preset.look);
  // Horizon was authored for perspective already; keep its exact placement.
  if (view === 'horizon') return target.fromArray(preset.pos);
  const direction = new THREE.Vector3(...preset.pos).sub(look).normalize();
  const distance = Math.min(fitDistance(preset.span, fov, aspect) * 1.04, SURFACE_MAX_DISTANCE - 5);
  return target.copy(look).addScaledVector(direction, distance);
}

export function presetCamera(view: WorldView, aspect: number) {
  const camera = new THREE.PerspectiveCamera(SURFACE_FOV, aspect, SURFACE_NEAR, SURFACE_FAR);
  camera.position.copy(presetPosition(view, aspect));
  camera.lookAt(new THREE.Vector3(...CAMERA_VIEWS[view].look));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}
