import * as THREE from 'three';
import type { Point } from './motion';
import { LOOKOUT, ORCHARD } from './layout';

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
  return THREE.MathUtils.lerp(ground, meadowHeight(ORCHARD.x, ORCHARD.z), orchardClearing);
}

// Samples lie along the center of the visible meadow trail, numbered from the
// current district toward the hills. The trail is a walkable route only where
// navigation.ts explicitly connects its nodes.
export function meadowTrailPoint(index: number): Point {
  const z = -10.2 - index * 2.35;
  const x = 4.4 * Math.sin(index * 0.17) + index * 0.16;
  return [x, terrainHeight(x, z) + 0.045, z];
}
