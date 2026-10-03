import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { renderedTerrainHeight, SOUTHWIND_WATER_Y } from '../terrain';
import { SOUTHWIND_MERE, waterRadiusAt } from './merePlacement';

const REEDS_HIGH = 44;
const REEDS_LOW = 18;

function Water() {
  const geometry = useMemo(() => {
    const vertices = [0, 0.002, 0];
    const deep = new THREE.Color('#397d83');
    const edge = new THREE.Color('#78ada3');
    const colors = [deep.r, deep.g, deep.b];
    const indices: number[] = [];
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const radius = waterRadiusAt(angle);
      vertices.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      colors.push(edge.r, edge.g, edge.b);
      if (i > 0) indices.push(0, i, i + 1);
    }
    const water = new THREE.BufferGeometry();
    water.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    water.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    water.setIndex(indices);
    water.computeVertexNormals();
    return water;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={[SOUTHWIND_MERE.x, SOUTHWIND_WATER_Y, SOUTHWIND_MERE.z]}>
      <meshStandardMaterial
        vertexColors
        roughness={0.78}
        metalness={0.04}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Shoreline() {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      for (const radius of [waterRadiusAt(angle) - 0.05, 10.6 + 0.35 * Math.sin(angle * 3 + 0.5)]) {
        const x = SOUTHWIND_MERE.x + Math.cos(angle) * radius;
        const z = SOUTHWIND_MERE.z + Math.sin(angle) * radius;
        vertices.push(x, Math.max(renderedTerrainHeight(x, z), SOUTHWIND_WATER_Y) + 0.025, z);
      }
      if (i > 0) {
        const previous = (i - 1) * 2;
        indices.push(
          previous,
          previous + 1,
          previous + 2,
          previous + 1,
          previous + 3,
          previous + 2,
        );
      }
    }
    const shore = new THREE.BufferGeometry();
    shore.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    shore.setIndex(indices);
    shore.computeVertexNormals();
    return shore;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#d2cba6" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Shore({ quality }: { quality: 'high' | 'low' }) {
  const reeds = useRef<THREE.InstancedMesh>(null);
  const stones = useRef<THREE.InstancedMesh>(null);
  const reedCount = quality === 'high' ? REEDS_HIGH : REEDS_LOW;
  const stoneCount = quality === 'high' ? 22 : 10;
  useEffect(() => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    if (reeds.current) {
      for (let i = 0; i < reedCount; i++) {
        const angle = i * 2.399963 + 0.2;
        const radius = 9.7 + ((i * 13) % 17) * 0.105;
        const x = SOUTHWIND_MERE.x + Math.cos(angle) * radius;
        const z = SOUTHWIND_MERE.z + Math.sin(angle) * radius;
        const height = 0.46 + ((i * 7) % 9) * 0.085;
        matrix.compose(
          position.set(x, renderedTerrainHeight(x, z) + height * 0.48, z),
          rotation,
          scale.set(0.065, height, 0.065),
        );
        reeds.current.setMatrixAt(i, matrix);
        reeds.current.setColorAt(i, new THREE.Color(i % 3 ? '#668365' : '#9eaa75'));
      }
      reeds.current.instanceMatrix.needsUpdate = true;
      if (reeds.current.instanceColor) reeds.current.instanceColor.needsUpdate = true;
      reeds.current.computeBoundingSphere();
    }
    if (stones.current) {
      for (let i = 0; i < stoneCount; i++) {
        const angle = i * 2.399963 + 1.1;
        const radius = 10.4 + ((i * 11) % 13) * 0.27;
        const x = SOUTHWIND_MERE.x + Math.cos(angle) * radius;
        const z = SOUTHWIND_MERE.z + Math.sin(angle) * radius;
        const size = 0.31 + ((i * 5) % 6) * 0.08;
        matrix.compose(
          position.set(x, renderedTerrainHeight(x, z) + size * 0.19, z),
          rotation,
          scale.set(size, size * 0.4, size * 0.8),
        );
        stones.current.setMatrixAt(i, matrix);
        stones.current.setColorAt(i, new THREE.Color(i % 3 ? '#a9b19c' : '#d0c9ac'));
      }
      stones.current.instanceMatrix.needsUpdate = true;
      if (stones.current.instanceColor) stones.current.instanceColor.needsUpdate = true;
      stones.current.computeBoundingSphere();
    }
  }, [quality, reedCount, stoneCount]);
  return (
    <>
      <instancedMesh ref={reeds} args={[undefined, undefined, reedCount]}>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={stones} args={[undefined, undefined, stoneCount]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </>
  );
}

export function SouthwindMere() {
  const quality = useWorld((state) => state.quality);
  return (
    <group name="southwind-mere-scenery">
      <Shoreline />
      <Water />
      <Shore quality={quality} />
    </group>
  );
}
