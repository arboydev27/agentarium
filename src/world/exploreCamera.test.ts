import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_PAN_BOUNDS } from './cameraPan';
import {
  CAMERA_CLEARANCE,
  cameraFloor,
  clampCameraPosition,
  EXPLORE_MAX_POLAR,
  EXPLORE_MIN_DISTANCE,
  groundHit,
  screenRay,
  travelDestination,
} from './exploreCamera';
import { CAMERA_VIEWS, WORLD_VIEWS } from './layout';
import { presetCamera, presetPosition, SURFACE_FAR } from './perspective';
import { renderedTerrainHeight, terrainHeight } from './terrain';

const ASPECT = 16 / 10;

describe('explore camera', () => {
  it('keeps the eye a clearance above both height fields, and never lowers it', () => {
    expect(CAMERA_CLEARANCE).toBeGreaterThanOrEqual(1);
    for (const [x, z] of [
      [0, 0],
      [19, -4],
      [-48, 45],
      [13.5, -38],
      [76, -12],
      [-150, 120],
      [205, -205],
    ]) {
      const floor = cameraFloor(x, z);
      expect(floor - terrainHeight(x, z)).toBeGreaterThanOrEqual(CAMERA_CLEARANCE - 1e-9);
      expect(floor - renderedTerrainHeight(x, z)).toBeGreaterThanOrEqual(CAMERA_CLEARANCE - 1e-9);
      const high = new THREE.Vector3(x, floor + 5, z);
      expect(clampCameraPosition(high)).toBe(0);
      expect(high.y).toBe(floor + 5);
      const low = new THREE.Vector3(x, floor - 3, z);
      expect(clampCameraPosition(low)).toBeCloseTo(3, 9);
      expect(low.y).toBe(floor);
      expect(clampCameraPosition(low)).toBe(0);
    }
  });

  it('holds every sampled path from a preset down to its ground above the terrain, and a sweep of the travel area', () => {
    for (const view of WORLD_VIEWS) {
      const from = presetPosition(view, ASPECT);
      const [lx, , lz] = CAMERA_VIEWS[view].look;
      const to = new THREE.Vector3(lx, terrainHeight(lx, lz) - 2, lz);
      for (let i = 0; i <= 40; i++) {
        const position = from.clone().lerp(to, i / 40);
        clampCameraPosition(position);
        expect(position.y, `${view} step ${i}`).toBeGreaterThanOrEqual(
          Math.max(
            terrainHeight(position.x, position.z),
            renderedTerrainHeight(position.x, position.z),
          ) +
            CAMERA_CLEARANCE -
            1e-9,
        );
      }
    }
    for (let x = CAMERA_PAN_BOUNDS.minX; x <= CAMERA_PAN_BOUNDS.maxX; x += 30)
      for (let z = CAMERA_PAN_BOUNDS.minZ; z <= CAMERA_PAN_BOUNDS.maxZ; z += 30) {
        const position = new THREE.Vector3(x, -20, z);
        clampCameraPosition(position);
        expect(position.y).toBeGreaterThanOrEqual(terrainHeight(x, z) + CAMERA_CLEARANCE - 1e-9);
      }
  });

  it('marches a ray to the ground under every preset look point and along every preset centre ray', () => {
    for (const view of WORLD_VIEWS) {
      const camera = presetCamera(view, ASPECT);
      const [lx, ly, lz] = CAMERA_VIEWS[view].look;
      // Aimed at the ground beneath the look point, the march lands on it.
      const underLook = new THREE.Vector3(lx, terrainHeight(lx, lz), lz);
      const aimed = groundHit(camera.position, underLook.clone().sub(camera.position));
      expect(aimed, view).not.toBeNull();
      expect(Math.hypot(aimed!.x - lx, aimed!.z - lz), view).toBeLessThan(0.05);
      expect(Math.abs(aimed!.y - terrainHeight(aimed!.x, aimed!.z))).toBeLessThan(1e-6);
      // The centre of the frame meets the ground on the ray, at or past the look point.
      const centre = groundHit(camera.position, screenRay(camera, 0, 0));
      expect(centre, `${view} centre`).not.toBeNull();
      const toLook = new THREE.Vector3(lx, ly, lz).distanceTo(camera.position);
      expect(centre!.distance).toBeGreaterThanOrEqual(toLook - 0.5);
      expect(centre!.distance).toBeLessThanOrEqual(SURFACE_FAR);
      const along = camera.position
        .clone()
        .addScaledVector(screenRay(camera, 0, 0), centre!.distance);
      expect(along.distanceTo(new THREE.Vector3(centre!.x, centre!.y, centre!.z))).toBeLessThan(
        1e-3,
      );
    }
    // Looking at the sky, or starting under the ground, finds nothing.
    expect(groundHit(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 1, 0))).toBeNull();
    expect(groundHit(new THREE.Vector3(0, 80, 0), new THREE.Vector3(1, 0.2, 0))).toBeNull();
    expect(groundHit(new THREE.Vector3(0, -5, 0), new THREE.Vector3(0, -1, 0))).toBeNull();
  });

  it('keeps double-click travel inside the camera bounds', () => {
    expect(travelDestination({ x: 300, z: -400 })).toEqual({
      x: CAMERA_PAN_BOUNDS.maxX,
      z: CAMERA_PAN_BOUNDS.minZ,
    });
    expect(travelDestination({ x: 12.5, z: -3 })).toEqual({ x: 12.5, z: -3 });
    // A shallow ray from the edge of the travel area lands far outside it; travel stops at the edge.
    const camera = new THREE.PerspectiveCamera(38, ASPECT, 0.5, SURFACE_FAR);
    camera.position.set(CAMERA_PAN_BOUNDS.maxX, 30, 0);
    camera.lookAt(CAMERA_PAN_BOUNDS.maxX + 200, 0, 0);
    camera.updateMatrixWorld();
    const hit = groundHit(camera.position, screenRay(camera, 0, 0));
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeGreaterThan(CAMERA_PAN_BOUNDS.maxX);
    expect(travelDestination(hit!).x).toBe(CAMERA_PAN_BOUNDS.maxX);
  });

  it('lets the orbit come down to head height and a little below its target plane', () => {
    expect(EXPLORE_MIN_DISTANCE).toBeLessThan(4);
    expect(EXPLORE_MIN_DISTANCE).toBeGreaterThan(CAMERA_CLEARANCE);
    expect(EXPLORE_MAX_POLAR).toBeGreaterThan(Math.PI / 2 - 0.05);
    expect(EXPLORE_MAX_POLAR).toBeLessThan(Math.PI / 2 + 0.3);
    const camera = presetCamera('overview', ASPECT);
    const forward = camera.getWorldDirection(new THREE.Vector3());
    expect(screenRay(camera, 0, 0).dot(forward)).toBeCloseTo(1, 6);
  });
});
