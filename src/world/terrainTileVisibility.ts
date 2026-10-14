import * as THREE from 'three';
import { TERRAIN_TILES } from './terrainTileGeometry';

export const WORLD_FOG_NEAR = 85;
export const WORLD_FOG_FAR = 165;

const orthographic = new THREE.OrthographicCamera();
const perspective = new THREE.PerspectiveCamera();
const projection = new THREE.Matrix4();
const view = new THREE.Matrix4();
const frustum = new THREE.Frustum();
const bounds = new THREE.Box3();

// Fog uses view depth rather than ground-plane distance. A clipped frustum
// therefore covers wide orthographic views that a camera-radius test misses.
// The vertical range conservatively contains the authored terrain height field.
export function visibleTerrainTileIds(
  camera: THREE.Camera,
  translation?: Readonly<{ x: number; y: number; z: number }>,
): string[] {
  let clipped: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  if (camera instanceof THREE.OrthographicCamera) {
    orthographic.copy(camera);
    clipped = orthographic;
  } else if (camera instanceof THREE.PerspectiveCamera) {
    perspective.copy(camera);
    clipped = perspective;
  } else return TERRAIN_TILES.map((tile) => tile.id);
  clipped.far = WORLD_FOG_FAR;
  clipped.updateProjectionMatrix();
  camera.updateMatrixWorld();
  view.copy(camera.matrixWorld);
  if (translation) {
    view.elements[12] += translation.x;
    view.elements[13] += translation.y;
    view.elements[14] += translation.z;
  }
  view.invert();
  projection.multiplyMatrices(clipped.projectionMatrix, view);
  frustum.setFromProjectionMatrix(projection);
  return TERRAIN_TILES.filter((tile) => {
    bounds.min.set(tile.minX, -4, tile.minZ);
    bounds.max.set(tile.maxX, 24, tile.maxZ);
    return frustum.intersectsBox(bounds);
  }).map((tile) => tile.id);
}
