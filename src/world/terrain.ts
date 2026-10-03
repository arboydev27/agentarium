import * as THREE from 'three';
import type { Point } from './motion';
import { LOOKOUT, OBSERVATORY, ORCHARD } from './layout';

// Match Landscape's PlaneGeometry dimensions and subdivisions. The mesh is
// sampled only at vertices, so its rendered surface differs from terrainHeight
// between vertices.
export const LANDSCAPE_SIZE = 600;
export const LANDSCAPE_SEGMENTS = 128;

function meadowHeight(x: number, z: number) {
  const distance = Math.hypot(x, z);
  const beyondDistrict = THREE.MathUtils.smoothstep(distance, 16, 34);
  const distantRidge = THREE.MathUtils.smoothstep(distance, 38, 105);
  const northernRise = THREE.MathUtils.smoothstep(-z, 16, 68);
  const folds = Math.sin(x * 0.085) * Math.cos(z * 0.061) * 0.8 + Math.sin((x + z) * 0.044) * 0.55;
  const northernCrest = 7.2 + Math.sin(x * 0.061) * 2.3 + Math.sin(x * 0.135 + 0.8) * 1.1;
  const meadow =
    -1.55 +
    beyondDistrict * (0.55 + folds * 0.45) +
    distantRidge * (2.8 + folds) +
    northernRise * northernCrest;
  const districtEdge = Math.max(Math.abs(x) / 15.8, Math.abs(z) / 12.6);
  const plateau = 1 - THREE.MathUtils.smoothstep(districtEdge, 1, 1.9);
  return THREE.MathUtils.lerp(meadow, 0.39, plateau);
}

export function terrainHeight(x: number, z: number) {
  let ground = meadowHeight(x, z);
  const lookoutClearing =
    1 -
    THREE.MathUtils.smoothstep(
      Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z),
      LOOKOUT.clearingRadius,
      LOOKOUT.clearingRadius + 4.3,
    );
  ground = THREE.MathUtils.lerp(ground, meadowHeight(LOOKOUT.x, LOOKOUT.z), lookoutClearing);
  const orchardClearing =
    1 -
    THREE.MathUtils.smoothstep(
      Math.hypot(x - ORCHARD.x, z - ORCHARD.z),
      ORCHARD.clearingRadius,
      ORCHARD.clearingRadius + 4.3,
    );
  ground = THREE.MathUtils.lerp(ground, meadowHeight(ORCHARD.x, ORCHARD.z), orchardClearing);
  const observatoryClearing =
    1 -
    THREE.MathUtils.smoothstep(
      Math.hypot(x - OBSERVATORY.x, z - OBSERVATORY.z),
      OBSERVATORY.clearingRadius,
      OBSERVATORY.clearingRadius + 4.3,
    );
  return THREE.MathUtils.lerp(
    ground,
    meadowHeight(OBSERVATORY.x, OBSERVATORY.z),
    observatoryClearing,
  );
}

// Exact height of Landscape's indexed triangles at a point. Keep this in sync
// with the PlaneGeometry sampling constants used by the renderer.
export function renderedTerrainHeight(x: number, z: number) {
  const step = LANDSCAPE_SIZE / LANDSCAPE_SEGMENTS;
  const half = LANDSCAPE_SIZE / 2;
  const gx = Math.max(0, Math.min(LANDSCAPE_SEGMENTS, (x + half) / step));
  const gz = Math.max(0, Math.min(LANDSCAPE_SEGMENTS, (z + half) / step));
  const ix = Math.min(LANDSCAPE_SEGMENTS - 1, Math.floor(gx));
  const iz = Math.min(LANDSCAPE_SEGMENTS - 1, Math.floor(gz));
  const tx = gx - ix;
  const tz = gz - iz;
  const x0 = ix * step - half;
  const z0 = iz * step - half;
  const h00 = terrainHeight(x0, z0);
  const h10 = terrainHeight(x0 + step, z0);
  const h01 = terrainHeight(x0, z0 + step);
  const h11 = terrainHeight(x0 + step, z0 + step);
  // PlaneGeometry's triangles use the (x0,z1)–(x1,z0) diagonal after
  // rotateX(-PI/2): (00,01,10) and (01,11,10).
  return tx + tz <= 1
    ? h00 + tx * (h10 - h00) + tz * (h01 - h00)
    : h11 + (1 - tx) * (h01 - h11) + (1 - tz) * (h10 - h11);
}

// Shared surface for visible paths and walkable route nodes. A positive lift
// keeps the path above either the smooth height field or its coarse mesh.
export function walkwayHeight(x: number, z: number, lift = 0.08) {
  return Math.max(terrainHeight(x, z), renderedTerrainHeight(x, z)) + lift;
}

// Samples lie along the center of the visible meadow trail, numbered from the
// current district toward the hills. The trail is a walkable route only where
// navigation.ts explicitly connects its nodes.
export function meadowTrailPoint(index: number): Point {
  const z = -10.2 - index * 2.35;
  const x = 4.4 * Math.sin(index * 0.17) + index * 0.16;
  return [x, walkwayHeight(x, z, 0.045), z];
}
