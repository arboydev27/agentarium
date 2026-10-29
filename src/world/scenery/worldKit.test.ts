import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { EDGES, NODES } from '../navigation';
import { renderedTerrainHeight } from '../terrain';
import { BIOLAB_HABITATS } from './dawnlightPlacement';
import { WOODLAND_SHELTER_XZ } from './woodlandPlacement';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

it('exports reusable hardware within its original placement envelopes', async () => {
  const bytes = await readFile(
    new URL('../../../public/models/world-kit/colony-hardware.glb', import.meta.url),
  );
  expect(bytes.length).toBeLessThan(10 * 1024 * 1024);
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
  for (const [name, maximum] of [
    ['pressure-habitat', [6.3, 3.8, 6.4]],
    ['solar-rack', [4.3, 2.2, 2.5]],
    ['sensor-mast', [2.5, 4.2, 1.2]],
    ['service-wall', [10.4, 5.4, 2.5]],
    ['resource-tank', [1.25, 1.7, 1.1]],
    ['survey-rover', [2.1, 2.8, 2.6]],
    ['survey-rocket', [2.1, 6.6, 2.1]],
    ['launch-gantry', [3, 8.5, 0.8]],
    ['control-cabin', [3.4, 2.4, 2.9]],
    ['communications-dish', [2.2, 4.2, 2.2]],
    ['workstation', [1.65, 1.3, 1.8]],
    ['telescope', [2.2, 3.6, 1.1]],
    ['orbital-relay', [6.4, 2.7, 2.2]],
    ['survey-console', [2.5, 1.6, 1.3]],
    ['sample-cabinet', [1.1, 1.5, 1.6]],
  ] as const) {
    const root = scene.getObjectByName(name);
    expect(root, name).toBeDefined();
    const size = new THREE.Box3().setFromObject(root!).getSize(new THREE.Vector3());
    size.toArray().forEach((value, i) => {
      expect(value, `${name} axis ${i}`).toBeGreaterThan(0.5);
      expect(value, `${name} axis ${i}`).toBeLessThan(maximum[i] + 1e-5);
    });
    let meshes = 0;
    root!.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes++;
    });
    expect(meshes).toBeLessThanOrEqual(8);
  }
});

it('keeps the exported structures outside resident walking corridors', async () => {
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
  // Audit fixture mirrors runtime placements; geometry comes from the shipping GLB.
  const placements: [string, number, number, number?, number?, number?][] = [
    ...BIOLAB_HABITATS.map(({ x, z }): [string, number, number] => ['pressure-habitat', x, z]),
    ['pressure-habitat', 72, -19],
    ['pressure-habitat', ...WOODLAND_SHELTER_XZ],
    ['solar-rack', 45, 14],
    ['sensor-mast', 50, 21, 1.25],
    ['solar-rack', 30, -75],
    ['solar-rack', 30, -79],
    ['sensor-mast', 31, -65],
    ['solar-rack', -93.5, -19.5, 1, 0.4],
    ['sensor-mast', -87, -10.5, 1.375],
    ['sensor-mast', 75, -24, 1.75],
    ['sensor-mast', 9.7, -40.5, 1.3],
    ['sensor-mast', 17.3, -40.5, 0.9],
    ['telescope', -31.25, -51.55],
    ['survey-console', 13.5, -40.4],
    ['sample-cabinet', -39, 43],
    ['communications-dish', -1.5, 8.1, 1, 0, 0.49],
    ['service-wall', -7, -8.9, 1, 0, 0.68],
    ['service-wall', 7, -8.4, 1, 0, 1.1],
    ['control-cabin', 43.5, -118],
    ['launch-gantry', 46.4, -118],
    ['survey-rover', 54.6, -115, 1, -0.5],
    ...[3, 5.5, 8, 10.5].map((x): [string, number, number, number, number, number] => [
      'resource-tank',
      x,
      12.5,
      1,
      0,
      0.55,
    ]),
    ...[0, 1, 2].flatMap((row) =>
      [0, 1].map((col): [string, number, number, number, number] => [
        'solar-rack',
        64 - col * 5,
        -24 + row * 4,
        1,
        -0.25,
      ]),
    ),
  ];
  const body = new THREE.Sphere(new THREE.Vector3(), 0.45);
  for (const [name, x, z, scaleY = 1, turn = 0, floor] of placements) {
    const model = scene.getObjectByName(name)!.clone(true);
    model.position.set(x, floor ?? renderedTerrainHeight(x, z), z);
    model.rotation.y = turn;
    model.scale.y = scaleY;
    if (name === 'service-wall') model.scale.x = x < 0 ? 1.15 : 0.9;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const triangles: THREE.Triangle[] = [];
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry,
        vertices = geometry.getAttribute('position'),
        index = geometry.index;
      for (let i = 0; i < (index?.count ?? vertices.count); i += 3) {
        const point = (offset: number) =>
          new THREE.Vector3()
            .fromBufferAttribute(vertices, index ? index.getX(i + offset) : i + offset)
            .applyMatrix4(object.matrixWorld);
        triangles.push(new THREE.Triangle(point(0), point(1), point(2)));
      }
    });
    const closest = new THREE.Vector3();
    for (const [from, to] of EDGES) {
      const a = new THREE.Vector3(...NODES[from]),
        b = new THREE.Vector3(...NODES[to]);
      const steps = Math.ceil(a.distanceTo(b) / 0.25);
      for (let i = 0; i <= steps; i++) {
        body.center.lerpVectors(a, b, i / steps);
        body.center.y += 1;
        if (!bounds.intersectsSphere(body)) continue;
        // Test real surfaces: a canopy's enclosing box includes traversable air beneath it.
        const collision = triangles.some((triangle) => {
          triangle.closestPointToPoint(body.center, closest);
          return closest.distanceToSquared(body.center) < body.radius * body.radius;
        });
        expect(collision, `${name} at ${x},${z}: ${from} → ${to}`).toBe(false);
      }
    }
  }
});
