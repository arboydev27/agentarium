import * as THREE from 'three';
import { fbm } from './noise';

// Procedural rock bodies: a subdivided icosahedron displaced by layered noise
// and squashed below its resting plane so it sits in the ground rather than
// balancing on a point. Variants differ by seed only, so instancing stays cheap.

function rockDisplacement(x: number, y: number, z: number, seed: number) {
  // Three orthogonal 2D slices approximate 3D noise well enough for a rock.
  const a = fbm(x * 1.9 + seed, y * 1.9, { octaves: 3, seed: seed * 7 });
  const b = fbm(y * 1.9, z * 1.9 + seed, { octaves: 3, seed: seed * 7 + 1 });
  const c = fbm(z * 1.9 + seed, x * 1.9, { octaves: 3, seed: seed * 7 + 2 });
  return (a + b + c) / 3;
}

export function createRockGeometry(seed: number, detail = 2) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const point = new THREE.Vector3();
  const stretch = new THREE.Vector3(
    1 + fbm(seed, 0.3, { octaves: 1, seed: 1 }) * 0.25,
    0.72 + fbm(seed, 1.7, { octaves: 1, seed: 2 }) * 0.18,
    0.86 + fbm(seed, 2.9, { octaves: 1, seed: 3 }) * 0.22,
  );
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    const bulk = rockDisplacement(point.x, point.y, point.z, seed) * 0.38;
    const facet = rockDisplacement(point.x * 3.1, point.y * 3.1, point.z * 3.1, seed + 11) * 0.09;
    point.multiplyScalar(1 + bulk + facet).multiply(stretch);
    // Flatten the underside so the body reads as settled into the regolith.
    if (point.y < -0.3) point.y = -0.3 + (point.y + 0.3) * 0.25;
    position.setXYZ(i, point.x, point.y, point.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export const ROCK_VARIANT_COUNT = 4;

/** Height of the flattened underside below the rock's origin, in unit scale. */
export const ROCK_BASE_DEPTH = 0.3;

export function createRockVariants(detail = 2) {
  return Array.from({ length: ROCK_VARIANT_COUNT }, (_, variant) =>
    createRockGeometry(variant + 1, detail),
  );
}
