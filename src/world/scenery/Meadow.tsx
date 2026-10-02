import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { LOOKOUT } from '../layout';
import { meadowTrailPoint, terrainHeight } from '../terrain';

const OAK = { x: 18.5, z: -44 } as const;
const PATCH_CENTERS: [number, number][] = [
  [-15, -22],
  [-17, -38],
  [-19, -57],
  [-12, -72],
  [19, -23],
  [25, -31],
  [25, -56],
  [14, -69],
];

function clearOfRoutes(x: number, z: number) {
  const index = Math.max(0, Math.min(34, Math.round((-10.2 - z) / 2.35)));
  const trail = meadowTrailPoint(index);
  if (Math.abs(x - trail[0]) < 3.1 && Math.abs(z - trail[2]) < 2.6) return false;
  return Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) >= LOOKOUT.focusRadius + 1.6;
}

function MeadowPatches() {
  const quality = useWorld((state) => state.quality);
  const hummocks = useRef<THREE.InstancedMesh>(null);
  const blooms = useRef<THREE.InstancedMesh>(null);
  const stones = useRef<THREE.InstancedMesh>(null);
  const patches = useMemo(() => {
    const count = quality === 'high' ? 240 : 104;
    return Array.from({ length: count }, (_, i) => {
      const [cx, cz] = PATCH_CENTERS[i % PATCH_CENTERS.length];
      const ring = Math.floor(i / PATCH_CENTERS.length);
      const spread = Math.sqrt((ring + 0.5) / (count / PATCH_CENTERS.length)) * 8.5;
      const angle = i * 2.399963;
      const x = cx + Math.cos(angle) * spread;
      const z = cz + Math.sin(angle) * spread;
      const size = 0.66 + ((i * 11) % 17) * 0.045;
      return { x, z, y: terrainHeight(x, z), size, shade: i % 4 };
    }).filter(({ x, z }) => clearOfRoutes(x, z));
  }, [quality]);
  const flowers = useMemo(
    () => (quality === 'high' ? patches.filter((_, i) => i % 3 === 0) : []),
    [patches, quality],
  );
  const rocks = useMemo(() => {
    const count = quality === 'high' ? 42 : 20;
    return Array.from({ length: count }, (_, i) => {
      const [cx, cz] = PATCH_CENTERS[(i * 3) % PATCH_CENTERS.length];
      const angle = i * 2.399963;
      const radius = 4.5 + ((i * 7) % 15) * 0.31;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      return { x, z, y: terrainHeight(x, z), size: 0.37 + (i % 5) * 0.095, shade: i % 3 };
    }).filter(({ x, z }) => clearOfRoutes(x, z) && Math.hypot(x - OAK.x, z - OAK.z) > 3.5);
  }, [quality]);
  useEffect(() => {
    if (!hummocks.current || !stones.current || (flowers.length && !blooms.current)) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const greens = ['#779361', '#8fa472', '#6f8d65', '#a4ae79'].map((c) => new THREE.Color(c));
    const petals = ['#dfad81', '#e7cb91', '#d79b87', '#eadab0'].map((c) => new THREE.Color(c));
    const stoneColors = ['#b0aa8d', '#d0c4a1', '#9ba18a'].map((c) => new THREE.Color(c));
    patches.forEach(({ x, y, z, size, shade }, i) => {
      matrix.compose(
        position.set(x, y + size * 0.15, z),
        rotation,
        scale.set(size, size * 0.23, size * 0.76),
      );
      hummocks.current!.setMatrixAt(i, matrix);
      hummocks.current!.setColorAt(i, greens[shade]);
    });
    flowers.forEach(({ x, y, z, size, shade }, i) => {
      matrix.compose(position.set(x, y + size * 0.31, z), rotation, scale.setScalar(size * 0.115));
      blooms.current!.setMatrixAt(i, matrix);
      blooms.current!.setColorAt(i, petals[shade]);
    });
    rocks.forEach(({ x, y, z, size, shade }, i) => {
      matrix.compose(
        position.set(x, y + size * 0.27, z),
        rotation,
        scale.set(size, size * 0.6, size * 0.8),
      );
      stones.current!.setMatrixAt(i, matrix);
      stones.current!.setColorAt(i, stoneColors[shade]);
    });
    for (const mesh of [hummocks.current, blooms.current, stones.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [patches, flowers, rocks]);
  return (
    <group name="meadow-patches">
      <instancedMesh ref={hummocks} args={[undefined, undefined, patches.length]}>
        <sphereGeometry args={[1, 7, 5]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      {flowers.length > 0 && (
        <instancedMesh ref={blooms} args={[undefined, undefined, flowers.length]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial roughness={1} flatShading />
        </instancedMesh>
      )}
      <instancedMesh ref={stones} args={[undefined, undefined, rocks.length]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

function AmberOak() {
  const ground = terrainHeight(OAK.x, OAK.z);
  const branches = useRef<THREE.InstancedMesh>(null);
  const canopy = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!branches.current || !canopy.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const branchPoses: [number, number, number, number, number][] = [
      [1.05, 4.8, 0, 0, -0.65],
      [-1.1, 5.1, 0.2, 0, 0.72],
      [0, 5.2, 1.05, 0.68, 0],
      [-0.3, 5.5, -0.95, -0.63, 0],
    ];
    branchPoses.forEach(([x, y, z, rx, rz], i) => {
      rotation.setFromEuler(new THREE.Euler(rx, 0, rz));
      matrix.compose(position.set(x, y, z), rotation, scale.setScalar(1));
      branches.current!.setMatrixAt(i, matrix);
    });
    const lobes: [number, number, number, number, number][] = [
      [0, 7, 0, 2.4, 0],
      [2.2, 6.7, 0.2, 2, 1],
      [-2.2, 6.8, 0, 2.1, 2],
      [0.1, 7.4, 1.9, 1.9, 1],
      [-0.4, 7.5, -1.7, 1.8, 0],
      [1.2, 8.35, 0.7, 1.7, 3],
      [-1.1, 8.2, -0.4, 1.7, 1],
    ];
    const leaves = ['#cfa869', '#dfbd83', '#b98e61', '#e5ca91'].map((c) => new THREE.Color(c));
    lobes.forEach(([x, y, z, size, shade], i) => {
      rotation.identity();
      matrix.compose(position.set(x, y, z), rotation, scale.set(size, size * 0.74, size * 0.9));
      canopy.current!.setMatrixAt(i, matrix);
      canopy.current!.setColorAt(i, leaves[shade]);
    });
    for (const mesh of [branches.current, canopy.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, []);
  return (
    <group name="amber-oak" position={[OAK.x, ground, OAK.z]}>
      <mesh position={[0, 2.8, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.52, 5.6, 7]} />
        <meshStandardMaterial color="#705746" roughness={1} flatShading />
      </mesh>
      <instancedMesh ref={branches} args={[undefined, undefined, 4]} castShadow>
        <cylinderGeometry args={[0.13, 0.23, 2.65, 6]} />
        <meshStandardMaterial color="#705746" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={canopy} args={[undefined, undefined, 7]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

export function MeadowScenery() {
  return (
    <group name="meadow-scenery">
      <MeadowPatches />
      <AmberOak />
    </group>
  );
}
