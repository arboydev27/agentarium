import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { WORLD_KIT_URL, type WorldKitModule } from '../scenery/WorldKit';
import type { Placement } from './habitatLayout';
import { fadedOpacity } from './reveal';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const ignoreRaycast: THREE.Object3D['raycast'] = () => {};
export const GLASS_OPACITY = 0.38;

type Part = {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  local: THREE.Matrix4;
  baseOpacity: number;
};

function prepareMaterial(source: THREE.Material): THREE.MeshStandardMaterial {
  const material = (source as THREE.MeshStandardMaterial).clone();
  if (material.name === 'blue reflective glazing') {
    // The kit authors glazing opaque; the habitats need to see through it.
    material.transparent = true;
    material.opacity = GLASS_OPACITY;
    material.depthWrite = false;
    material.color.set('#9fd3e6');
    material.roughness = 0.08;
    material.metalness = 0.25;
    material.envMapIntensity = 1.4;
  }
  return material;
}

/**
 * Draws one kit module at many placements with one instanced mesh per material
 * group. Materials are cloned per component so a `fade` ref can dim this set
 * (roof, a glazed side) without touching the shared GLTF cache.
 */
export function KitInstances({
  module,
  placements,
  fade,
  floor = 0,
}: {
  module: WorldKitModule;
  placements: readonly Placement[];
  /** 0 = solid, 1 = fully revealed; read every frame. */
  fade?: RefObject<number>;
  /** Fraction of opacity kept when fully revealed, so walls remain as ghost outlines. */
  floor?: number;
}) {
  const { scene } = useGLTF(WORLD_KIT_URL);
  const parts = useMemo(() => {
    const root = scene.getObjectByName(module);
    if (!root) throw new Error(`World kit is missing ${module}`);
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const result: Part[] = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = prepareMaterial(object.material as THREE.Material);
      result.push({
        geometry: object.geometry as THREE.BufferGeometry,
        material,
        local: inverse.clone().multiply(object.matrixWorld),
        baseOpacity: material.opacity,
      });
    });
    return result;
  }, [scene, module]);
  useEffect(() => () => parts.forEach((part) => part.material.dispose()), [parts]);
  if (!placements.length) return null;
  return (
    <>
      {parts.map((part, index) => (
        <Instances key={index} part={part} placements={placements} fade={fade} floor={floor} />
      ))}
    </>
  );
}

function Instances({
  part,
  placements,
  fade,
  floor,
}: {
  part: Part;
  placements: readonly Placement[];
  fade?: RefObject<number>;
  floor: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(-1);
  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    placements.forEach((placement, i) => {
      rotation.setFromAxisAngle(Y_AXIS, placement.rotationY);
      matrix
        .compose(position.fromArray(placement.position), rotation, scale.fromArray(placement.scale))
        .multiply(part.local);
      instanced.setMatrixAt(i, matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }, [placements, part]);
  useFrame(() => {
    const instanced = mesh.current;
    if (!instanced || !fade) return;
    const amount = fade.current ?? 0;
    if (Math.abs(amount - applied.current) < 0.002) return;
    applied.current = amount;
    const material = part.material;
    const opacity = fadedOpacity(part.baseOpacity, amount, floor);
    material.opacity = opacity;
    const fading = opacity < part.baseOpacity - 0.001;
    material.transparent = fading || part.baseOpacity < 1;
    material.depthWrite = !material.transparent;
    instanced.visible = opacity > 0.015;
    instanced.castShadow = opacity > part.baseOpacity * 0.5;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[part.geometry, part.material, placements.length]}
      castShadow
      receiveShadow
      raycast={ignoreRaycast}
    />
  );
}
