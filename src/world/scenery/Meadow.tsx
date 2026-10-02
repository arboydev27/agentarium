import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { terrainHeight } from '../terrain';
import { MeadowChunks } from './MeadowChunks';

const OAK = { x: 18.5, z: -44 } as const;
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
      <MeadowChunks />
      <AmberOak />
    </group>
  );
}
