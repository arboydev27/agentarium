import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EDGES, NODES } from '../navigation';
import type { Placement } from './habitatLayout';

// Test-only helpers: load the shipping kit GLB without textures and sweep the
// resident body along every route chord against a placed module's triangles.

export async function loadKitScene() {
  const bytes = await readFile(
    new URL('../../../public/models/world-kit/colony-hardware.glb', import.meta.url),
  );
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: 'geometry-test-textures',
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  const { scene } = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  return { scene, bytes: bytes.length };
}

export function placeModule(scene: THREE.Object3D, placement: Placement) {
  const source = scene.getObjectByName(placement.module);
  if (!source) throw new Error(`World kit is missing ${placement.module}`);
  const model = source.clone(true);
  model.position.fromArray(placement.position);
  model.rotation.set(0, placement.rotationY, 0);
  model.scale.fromArray(placement.scale);
  model.updateMatrixWorld(true);
  return model;
}

export function worldBounds(model: THREE.Object3D) {
  return new THREE.Box3().setFromObject(model);
}

export function worldTriangles(model: THREE.Object3D) {
  const triangles: THREE.Triangle[] = [];
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    const vertices = geometry.getAttribute('position');
    const index = geometry.index;
    for (let i = 0; i < (index?.count ?? vertices.count); i += 3) {
      const point = (offset: number) =>
        new THREE.Vector3()
          .fromBufferAttribute(vertices, index ? index.getX(i + offset) : i + offset)
          .applyMatrix4(object.matrixWorld);
      triangles.push(new THREE.Triangle(point(0), point(1), point(2)));
    }
  });
  return triangles;
}

export const BODY_RADIUS = 0.45;

/** First route chord whose swept body touches the placed model, or null when clear. */
export function firstRouteCollision(model: THREE.Object3D) {
  const bounds = worldBounds(model);
  let triangles: THREE.Triangle[] | null = null;
  const body = new THREE.Sphere(new THREE.Vector3(), BODY_RADIUS);
  const closest = new THREE.Vector3();
  for (const [from, to] of EDGES) {
    const a = new THREE.Vector3(...NODES[from]);
    const b = new THREE.Vector3(...NODES[to]);
    const steps = Math.ceil(a.distanceTo(b) / 0.25);
    for (let i = 0; i <= steps; i++) {
      body.center.lerpVectors(a, b, i / steps);
      body.center.y += 1;
      if (!bounds.intersectsSphere(body)) continue;
      triangles ??= worldTriangles(model);
      const hit = triangles.some((triangle) => {
        triangle.closestPointToPoint(body.center, closest);
        return closest.distanceToSquared(body.center) < body.radius * body.radius;
      });
      if (hit) return `${from} → ${to} at ${body.center.toArray().map((v) => v.toFixed(2))}`;
    }
  }
  return null;
}
