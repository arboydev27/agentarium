import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { Box, Cylinder, Sign } from '../primitives';
import { renderedTerrainHeight } from '../terrain';
import {
  WOODLAND_HOLLOW,
  WOODLAND_TRAIL_XZ,
  clearOfWoodlandHollow,
  clearOfWoodlandShelter,
} from './woodlandPlacement';

// Navigation and this permanent surface share one centerline. Short spans
// drape over the coarse landscape triangles without changing walkable nodes.
function WoodlandTrail() {
  const geometry = useMemo(() => {
    const samples: [number, number][] = [];
    for (let index = 1; index < WOODLAND_TRAIL_XZ.length; index++) {
      const [ax, az] = WOODLAND_TRAIL_XZ[index - 1];
      const [bx, bz] = WOODLAND_TRAIL_XZ[index];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.7));
      for (let step = index === 1 ? 0 : 1; step <= steps; step++) {
        const t = step / steps;
        samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
      }
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const middle = new THREE.Color('#b9b49a');
    const edge = new THREE.Color('#828c79');
    samples.forEach(([x, z], index) => {
      const [px, pz] = samples[Math.max(0, index - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const normalX = -(nz - pz) / length;
      const normalZ = (nx - px) / length;
      for (const side of [-1, 0, 1]) {
        const sx = x + normalX * side * 0.95;
        const sz = z + normalZ * side * 0.95;
        positions.push(sx, renderedTerrainHeight(sx, sz) + 0.08, sz);
        const color = side === 0 ? middle : edge;
        colors.push(color.r, color.g, color.b);
      }
      if (index) {
        const a = (index - 1) * 3;
        const b = index * 3;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
        indices.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      }
    });
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    ribbon.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    ribbon.setIndex(indices);
    ribbon.computeVertexNormals();
    return ribbon;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="woodland-hollow-trail" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function HollowClearing() {
  const geometry = useMemo(() => {
    const { x, z } = WOODLAND_HOLLOW;
    const positions = [x, renderedTerrainHeight(x, z) + 0.08, z];
    const colors: number[] = [];
    const center = new THREE.Color('#b5ad8f');
    const rim = new THREE.Color('#8c987d');
    colors.push(center.r, center.g, center.b);
    const indices: number[] = [];
    for (let index = 0; index <= 36; index++) {
      const angle = (index / 36) * Math.PI * 2;
      const radius = 3.65 + Math.sin(angle * 7) * 0.08;
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      positions.push(px, renderedTerrainHeight(px, pz) + 0.08, pz);
      colors.push(rim.r, rim.g, rim.b);
      if (index) indices.push(0, index, index + 1);
    }
    const clearing = new THREE.BufferGeometry();
    clearing.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    clearing.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    clearing.setIndex(indices);
    clearing.computeVertexNormals();
    return clearing;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="woodland-hollow-arrival" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function WoodlandGround() {
  return (
    <group name="woodland-hollow-permanent-ground">
      <WoodlandTrail />
      <HollowClearing />
    </group>
  );
}

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
  useEffect(() => {
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
