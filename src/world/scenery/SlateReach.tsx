import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { renderedTerrainHeight } from '../terrain';
import { SLATE_REACH } from './slatePlacement';

const FINS = [
  { x: -2.2, z: 0.7, height: 7.8, width: 1.45, lean: -0.13, shade: '#849a9d' },
  { x: 0.2, z: -0.35, height: 10.2, width: 1.9, lean: 0.11, shade: '#647d83' },
  { x: 2.1, z: 0.8, height: 6.7, width: 1.55, lean: 0.19, shade: '#a0aead' },
] as const;

function SlateFins() {
  const fins = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!fins.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    FINS.forEach((fin, index) => {
      const x = SLATE_REACH.x + fin.x;
      const z = SLATE_REACH.z + fin.z;
      rotation.setFromEuler(new THREE.Euler(0.04 * index, 0.28 * index, fin.lean));
      matrix.compose(
        position.set(x, renderedTerrainHeight(x, z) + fin.height * 0.48, z),
        rotation,
        scale.set(fin.width, fin.height, fin.width * 0.7),
      );
      fins.current!.setMatrixAt(index, matrix);
      fins.current!.setColorAt(index, new THREE.Color(fin.shade));
    });
    fins.current.instanceMatrix.needsUpdate = true;
    if (fins.current.instanceColor) fins.current.instanceColor.needsUpdate = true;
    fins.current.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={fins} args={[undefined, undefined, FINS.length]} castShadow>
      <cylinderGeometry args={[0.35, 1, 1, 5]} />
      <meshStandardMaterial roughness={1} flatShading />
    </instancedMesh>
  );
}

function WindsweptCedar() {
  const x = SLATE_REACH.x + 4.1;
  const z = SLATE_REACH.z - 1.9;
  const ground = renderedTerrainHeight(x, z);
  return (
    <group name="slate-reach-cedar" position={[x, ground, z]} rotation={[0, 0, -0.2]}>
      <mesh position={[0, 1.65, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.32, 3.3, 6]} />
        <meshStandardMaterial color="#685e50" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.4, 4.15, 0]} castShadow>
        <coneGeometry args={[1.35, 3.5, 7]} />
        <meshStandardMaterial color="#4c6c64" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

function Scree() {
  const stones = useRef<THREE.InstancedMesh>(null);
  const sites = useMemo(
    () =>
      Array.from({ length: 15 }, (_, index) => {
        const angle = index * 2.399963;
        const radius = 2.9 + ((index * 7) % 11) * 0.2;
        return {
          x: SLATE_REACH.x + Math.cos(angle) * radius,
          z: SLATE_REACH.z + Math.sin(angle) * radius,
          size: 0.3 + (index % 5) * 0.08,
        };
      }),
    [],
  );
  useEffect(() => {
    if (!stones.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const shades = ['#71898a', '#9aa7a1', '#667e82'].map((shade) => new THREE.Color(shade));
    sites.forEach(({ x, z, size }, index) => {
      matrix.compose(
        position.set(x, renderedTerrainHeight(x, z) + size * 0.25, z),
        rotation,
        scale.set(size, size * 0.5, size * 0.85),
      );
      stones.current!.setMatrixAt(index, matrix);
      stones.current!.setColorAt(index, shades[index % shades.length]);
    });
    stones.current.instanceMatrix.needsUpdate = true;
    if (stones.current.instanceColor) stones.current.instanceColor.needsUpdate = true;
    stones.current.computeBoundingSphere();
  }, [sites]);
  return (
    <instancedMesh ref={stones} args={[undefined, undefined, sites.length]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={1} flatShading />
    </instancedMesh>
  );
}

export function SlateReach() {
  const quality = useWorld((state) => state.quality);
  return (
    <group name="slate-reach-scenic-only">
      <SlateFins />
      <WindsweptCedar />
      {quality === 'high' && <Scree />}
    </group>
  );
}
