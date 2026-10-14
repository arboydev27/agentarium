import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { Box, Cylinder, Sign } from '../primitives';
import { renderedTerrainHeight } from '../terrain';
import {
  WOODLAND_HOLLOW,
  clearOfWoodlandHollow,
  clearOfWoodlandShelter,
} from './woodlandPlacement';

const SHELTER = { x: -88, z: -16.5 } as const;
const FACING = Math.PI / 4;

function Shelter() {
  const quality = useWorld((state) => state.quality);
  const night = useWorld((state) => state.night);
  const ground = renderedTerrainHeight(SHELTER.x, SHELTER.z);
  return (
    <group
      name="woodland-lantern-shelter"
      position={[SHELTER.x, ground, SHELTER.z]}
      rotation={[0, FACING, 0]}
    >
      <Box pos={[0, -0.12, 0]} size={[4.5, 0.8, 3.45]} color="#a49a7d" radius={0} />
      <Box pos={[0, 0.28, 0]} size={[4.25, 0.17, 3.2]} color="#9b8564" radius={0} />
      {[-1.88, 1.88].flatMap((x) =>
        [-1.32, 1.32].map((z) => (
          <Box
            key={`${x}:${z}`}
            pos={[x, 1.5, z]}
            size={[0.18, 2.5, 0.18]}
            color="#6e5844"
            radius={0}
          />
        )),
      )}
      <Box
        pos={[-1.06, 3.07, 0]}
        size={[2.55, 0.19, 3.65]}
        rotation={[0, 0, 0.43]}
        color="#586d58"
        radius={0}
      />
      <Box
        pos={[1.06, 3.07, 0]}
        size={[2.55, 0.19, 3.65]}
        rotation={[0, 0, -0.43]}
        color="#6c7b61"
        radius={0}
      />
      <Box pos={[0, 3.61, 0]} size={[0.22, 0.16, 3.76]} color="#79664d" radius={0} />
      <Sign
        text="LANTERN HOLLOW"
        pos={[0, 2.38, 1.45]}
        size={[2.9, 0.46]}
        background="#3f5d4b"
        color="#efe2b5"
      />
      {[-1.22, 1.22].slice(0, quality === 'high' ? 2 : 1).map((x) => (
        <group key={x} position={[x, 0, 1.52]}>
          <Cylinder pos={[0, 2.27, 0]} r={0.045} h={0.47} color="#554e3c" />
          <mesh position={[0, 1.98, 0]}>
            <octahedronGeometry args={[0.27, 0]} />
            <meshStandardMaterial
              color="#f7d99f"
              emissive="#f0bc70"
              emissiveIntensity={night ? 1.3 : 0.14}
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ForestFurniture() {
  const night = useWorld((state) => state.night);
  const benchX = -88.5;
  const benchZ = -23.4;
  const heading = -0.3;
  const legGround = [-0.81, 0.81].map((offset) =>
    renderedTerrainHeight(benchX + Math.cos(heading) * offset, benchZ - Math.sin(heading) * offset),
  );
  const seatY = Math.max(...legGround) + 0.65;
  return (
    <group name="woodland-hollow-furniture">
      <group position={[benchX, 0, benchZ]} rotation={[0, heading, 0]}>
        <Box pos={[0, seatY, 0]} size={[2.1, 0.15, 0.62]} color="#887356" radius={0} />
        <Box pos={[0, seatY + 0.39, -0.25]} size={[2.1, 0.7, 0.13]} color="#887356" radius={0} />
        {[-0.81, 0.81].map((offset, index) => (
          <Box
            key={offset}
            pos={[offset, (seatY + legGround[index]) / 2, 0]}
            size={[0.13, seatY - legGround[index], 0.5]}
            color="#5d5e49"
            radius={0}
          />
        ))}
      </group>
      <group position={[-79.4, renderedTerrainHeight(-79.4, -15.1), -15.1]}>
        <Cylinder pos={[0, 0.78, 0]} r={0.07} h={1.55} color="#55705a" />
        <mesh position={[0, 1.57, 0]}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color="#f7d99f"
            emissive="#f0bc70"
            emissiveIntensity={night ? 1.2 : 0.12}
            roughness={0.6}
          />
        </mesh>
      </group>
    </group>
  );
}

function HollowFerns() {
  const quality = useWorld((state) => state.quality);
  const ferns = useRef<THREE.InstancedMesh>(null);
  const sites = useMemo(() => {
    const count = quality === 'high' ? 28 : 12;
    return Array.from({ length: count }, (_, index) => {
      const angle = index * 2.399963 + 0.2;
      const radius = 6.15 + (index % 4) * 0.49;
      const x = WOODLAND_HOLLOW.x + Math.cos(angle) * radius;
      const z = WOODLAND_HOLLOW.z + Math.sin(angle) * radius;
      return { x, z, size: 0.45 + (index % 5) * 0.08 };
    }).filter(
      ({ x, z }) =>
        clearOfWoodlandHollow(x, z, 0.9) &&
        clearOfWoodlandShelter(x, z, -0.6) &&
        Math.hypot(x + 88.5, z + 23.4) > 2.3,
    );
  }, [quality]);
  useLayoutEffect(() => {
    if (!ferns.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const greens = ['#76936d', '#90a178', '#64866c'].map((value) => new THREE.Color(value));
    sites.forEach(({ x, z, size }, index) => {
      matrix.compose(
        position.set(x, renderedTerrainHeight(x, z) + size * 0.45, z),
        rotation,
        scale.set(size, size, size),
      );
      ferns.current!.setMatrixAt(index, matrix);
      ferns.current!.setColorAt(index, greens[index % greens.length]);
    });
    const mesh = ferns.current;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return () => {
      mesh.dispose();
    };
  }, [sites]);
  return (
    <instancedMesh
      ref={ferns}
      args={[undefined, undefined, sites.length]}
      castShadow={quality === 'high'}
    >
      <coneGeometry args={[0.38, 1, 6]} />
      <meshStandardMaterial roughness={1} flatShading />
    </instancedMesh>
  );
}

export function LanternHollow() {
  return (
    <group name="lantern-hollow-destination">
      <Shelter />
      <ForestFurniture />
      <HollowFerns />
    </group>
  );
}
