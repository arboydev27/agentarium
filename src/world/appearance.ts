import * as THREE from 'three';
import { residentStyle } from './personality';

// Original accessory geometry, attached in model space to the actual head bone.
// Body proportions stay unchanged so the shared keyboard/seat contract remains valid.
export function dressResident(model: THREE.Object3D, style: ReturnType<typeof residentStyle>) {
  const head = model.getObjectByName('Head');
  if (!head) throw new Error('Resident rig is missing its Head bone');
  const group = new THREE.Group();
  group.name = `accessory-${style.accessory}`;
  const owned: THREE.BufferGeometry[] = [];
  const material = new THREE.MeshStandardMaterial({
    color: style.accent,
    roughness: 0.65,
    transparent: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: '#304a43',
    roughness: 0.55,
    transparent: true,
  });
  const cream = new THREE.MeshStandardMaterial({
    color: style.trim,
    roughness: 0.85,
    transparent: true,
  });
  for (const mat of [material, dark, cream]) mat.userData.wardrobe = true;
  const add = (
    geometry: THREE.BufferGeometry,
    position: number[],
    mat = material,
    rotation?: number[],
  ) => {
    owned.push(geometry);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.fromArray(position);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const torus = (radius: number, tube: number) => new THREE.TorusGeometry(radius, tube, 6, 20);
  switch (style.accessory) {
    case 'headphones':
      add(torus(1.4, 0.12), [0, 3.85, 0], dark).scale.y = 0.85;
      for (const x of [-1.38, 1.38])
        add(new THREE.SphereGeometry(0.3, 10, 8), [x, 3.75, 0.1]).scale.set(0.5, 1, 1);
      break;
    case 'cap':
      add(
        new THREE.SphereGeometry(1.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        [0, 4.38, 0],
      ).scale.y = 0.45;
      add(new THREE.BoxGeometry(1.9, 0.09, 1.25), [0, 4.39, 0.85]);
      break;
    case 'antenna':
      for (const x of [-0.65, 0.65]) {
        add(new THREE.CylinderGeometry(0.055, 0.075, 0.6, 8), [x, 4.8, 0], dark);
        add(new THREE.SphereGeometry(0.17, 10, 8), [x, 5.13, 0]);
      }
      break;
    case 'glasses':
      for (const x of [-0.61, 0.61]) add(torus(0.48, 0.065), [x, 3.7, 1.48], dark);
      add(new THREE.BoxGeometry(0.26, 0.07, 0.07), [0, 3.7, 1.49], dark);
      break;
    case 'beret':
      add(new THREE.SphereGeometry(1.25, 14, 8), [0.12, 4.48, 0]).scale.set(1, 0.25, 0.88);
      add(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 8), [0.12, 4.83, 0], dark);
      break;
    case 'ear-fins':
      for (const x of [-1.35, 1.35])
        add(new THREE.ConeGeometry(0.24, 0.8, 4), [x, 4.12, 0], cream, [
          0,
          0,
          x > 0 ? -0.35 : 0.35,
        ]);
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        add(new THREE.SphereGeometry(0.19, 8, 6), [
          -1.07 + Math.cos(a) * 0.23,
          4.25 + Math.sin(a) * 0.23,
          1.05,
        ]).scale.z = 0.35;
      }
      add(new THREE.SphereGeometry(0.14, 8, 6), [-1.07, 4.25, 1.13], cream);
      break;
    case 'visor':
      add(new THREE.BoxGeometry(2.35, 0.16, 0.36), [0, 4.08, 1.4]);
      for (const x of [-1.2, 1.2]) add(new THREE.BoxGeometry(0.1, 0.16, 1.3), [x, 4.08, 0.9], dark);
      break;
  }
  model.add(group);
  model.updateMatrixWorld(true);
  head.attach(group);
  // Include materials even if a particular variant does not use all three.
  return {
    dispose: () => {
      group.removeFromParent();
      owned.forEach((g) => g.dispose());
      material.dispose();
      dark.dispose();
      cream.dispose();
    },
  };
}
