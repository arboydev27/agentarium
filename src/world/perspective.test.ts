import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_VIEWS, WORLD_VIEWS } from './layout';
import {
  fitDistance,
  presetCamera,
  presetPosition,
  SURFACE_FOV,
  SURFACE_MAX_DISTANCE,
} from './perspective';

describe('perspective presets', () => {
  it('fits the taller of the two span dimensions', () => {
    const square = fitDistance([10, 10], 90, 1);
    expect(square).toBeCloseTo(5, 5);
    // A wide span on a square viewport is limited by width.
    expect(fitDistance([20, 10], 90, 1)).toBeCloseTo(10, 5);
    // A wider viewport relaxes the width limit back to the height limit.
    expect(fitDistance([20, 10], 90, 2)).toBeCloseTo(5, 5);
  });

  it('keeps every preset direction and stays within the surface orbit', () => {
    for (const view of WORLD_VIEWS) {
      const preset = CAMERA_VIEWS[view];
      const look = new THREE.Vector3(...preset.look);
      const authored = new THREE.Vector3(...preset.pos).sub(look).normalize();
      const fitted = presetPosition(view, 16 / 10).sub(look);
      expect(fitted.length()).toBeLessThan(SURFACE_MAX_DISTANCE);
      expect(fitted.length()).toBeGreaterThan(5);
      expect(fitted.normalize().dot(authored)).toBeCloseTo(1, 4);
    }
  });

  it('keeps the horizon preset where it was authored', () => {
    expect(presetPosition('horizon', 1.5).toArray()).toEqual(CAMERA_VIEWS.horizon.pos);
  });

  it('builds a camera that looks at the preset focus', () => {
    const camera = presetCamera('overview', 1.6);
    expect(camera.fov).toBe(SURFACE_FOV);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const toLook = new THREE.Vector3(...CAMERA_VIEWS.overview.look)
      .sub(camera.position)
      .normalize();
    expect(forward.dot(toLook)).toBeCloseTo(1, 4);
  });
});
