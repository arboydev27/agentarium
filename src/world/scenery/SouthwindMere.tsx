import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { renderedTerrainHeight, SOUTHWIND_WATER_Y, walkwayHeight } from '../terrain';
import { Box, Cylinder, Sign } from '../primitives';
import { SOUTHWIND_SHORE } from './southwindTrailPlacement';
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

function OverlookSurface() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const { x: centerX, z: centerZ } = SOUTHWIND_SHORE;
    const segments = 28;
    positions.push(centerX, walkwayHeight(centerX, centerZ, 0.1), centerZ);
    for (let index = 0; index <= segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const radius = 2.35 + 0.12 * Math.sin(angle * 5);
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      positions.push(x, walkwayHeight(x, z, 0.1), z);
      if (index > 0) indices.push(0, index, index + 1);
    }
    const surface = new THREE.BufferGeometry();
    surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    surface.setIndex(indices);
    surface.computeVertexNormals();
    return surface;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="southwind-dry-overlook" geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#b08e68" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function OverlookFurniture({ quality }: { quality: 'high' | 'low' }) {
  const { x, z } = SOUTHWIND_SHORE;
  const benchX = x - 0.55;
  const benchZ = z + 2.55;
  const signX = x + 1.65;
  const signZ = z + 2.45;
  const westX = x - 2.18;
  return (
    <group name="southwind-overlook-furniture">
      {/* A low open rail preserves the view west across the water. */}
      {[-1.1, 1.1].map((offset) => (
        <group key={offset} position={[westX, walkwayHeight(westX, z + offset, 0.1), z + offset]}>
          <Box pos={[0, 0.47, 0]} size={[0.13, 0.94, 0.13]} color="#76624d" radius={0} />
        </group>
      ))}
      <Box
        pos={[westX, walkwayHeight(westX, z, 0.1) + 0.86, z]}
        size={[0.12, 0.12, 2.34]}
        color="#987656"
        radius={0}
      />
      <group
        position={[benchX, walkwayHeight(benchX, benchZ, 0.1), benchZ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <Box pos={[0, 0.48, 0]} size={[1.6, 0.13, 0.52]} color="#aa815b" radius={0} />
        <Box pos={[0, 0.85, 0.24]} size={[1.6, 0.62, 0.11]} color="#75907c" radius={0} />
        {[-0.62, 0.62].map((side) => (
          <Box
            key={side}
            pos={[side, 0.25, 0]}
            size={[0.12, 0.5, 0.43]}
            color="#765b46"
            radius={0}
          />
        ))}
      </group>
      <group
        position={[signX, walkwayHeight(signX, signZ, 0.1), signZ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <Cylinder pos={[0, 0.91, 0]} r={0.075} h={1.82} color="#715d49" />
        <Sign
          text="SOUTHWIND MERE"
          pos={[0, 1.75, 0.07]}
          size={[2.05, 0.48]}
          background="#496b69"
          color="#f0e8d0"
        />
      </group>
      {quality === 'high' && (
        <>
          <Box
            pos={[westX, walkwayHeight(westX, z, 0.1) + 0.48, z]}
            size={[0.085, 0.085, 2.34]}
            color="#a88662"
            radius={0}
          />
          <Box
            pos={[x + 0.75, walkwayHeight(x + 0.75, z - 2.42, 0.1) + 0.16, z - 2.42]}
            size={[1.7, 0.2, 0.2]}
            color="#c2a27a"
            radius={0}
          />
        </>
      )}
    </group>
  );
}

export function SouthwindMere() {
  const quality = useWorld((state) => state.quality);
  return (
    <group name="southwind-mere-scenery">
      <Shoreline />
      <Water />
      <Shore quality={quality} />
      <OverlookSurface />
      <OverlookFurniture quality={quality} />
    </group>
  );
}
