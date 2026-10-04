import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { Box, Cylinder, Sign } from '../primitives';
import { renderedTerrainHeight } from '../terrain';
import {
  NORTHSTAR_OUTPOST,
  NORTHSTAR_TOWER_XZ,
  NORTHSTAR_TRAIL_XZ,
  clearOfNorthstarStructure,
  clearOfNorthstarTrail,
} from './northstarPlacement';

// This surface and the destination pad remain mounted while the authored
// signal station can be culled by the scenic-region selector.
function NorthstarTrail() {
  const geometry = useMemo(() => {
    const samples: [number, number][] = [];
    for (let index = 1; index < NORTHSTAR_TRAIL_XZ.length; index++) {
      const [ax, az] = NORTHSTAR_TRAIL_XZ[index - 1];
      const [bx, bz] = NORTHSTAR_TRAIL_XZ[index];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.7));
      for (let step = index === 1 ? 0 : 1; step <= steps; step++) {
        const t = step / steps;
        samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
      }
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const center = new THREE.Color('#c4c4af');
    const edge = new THREE.Color('#87938c');
    samples.forEach(([x, z], index) => {
      const [px, pz] = samples[Math.max(0, index - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const normalX = -(nz - pz) / length;
      const normalZ = (nx - px) / length;
      for (const side of [-1, 0, 1]) {
        const sx = x + normalX * side * 0.92;
        const sz = z + normalZ * side * 0.92;
        positions.push(sx, renderedTerrainHeight(sx, sz) + 0.08, sz);
        const color = side === 0 ? center : edge;
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
    <mesh name="northstar-highland-trail" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function OutpostArrival() {
  const geometry = useMemo(() => {
    const { x, z } = NORTHSTAR_OUTPOST;
    const positions = [x, renderedTerrainHeight(x, z) + 0.08, z];
    const colors: number[] = [];
    const center = new THREE.Color('#c3c5b2');
    const rim = new THREE.Color('#909b96');
    colors.push(center.r, center.g, center.b);
    const indices: number[] = [];
    for (let index = 0; index <= 36; index++) {
      const angle = (index / 36) * Math.PI * 2;
      const radius = 3.8 + Math.sin(angle * 6) * 0.08;
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      positions.push(px, renderedTerrainHeight(px, pz) + 0.08, pz);
      colors.push(rim.r, rim.g, rim.b);
      if (index) indices.push(0, index, index + 1);
    }
    const pad = new THREE.BufferGeometry();
    pad.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pad.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    pad.setIndex(indices);
    pad.computeVertexNormals();
    return pad;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="northstar-arrival-pad" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function NorthstarGround() {
  return (
    <group name="northstar-permanent-ground">
      <NorthstarTrail />
      <OutpostArrival />
    </group>
  );
}

const FACING = Math.atan2(-18, -12);

function SignalTower() {
  const quality = useWorld((state) => state.quality);
  const night = useWorld((state) => state.night);
  const [x, z] = NORTHSTAR_TOWER_XZ;
  const ground = renderedTerrainHeight(x, z);
  return (
    <group name="northstar-signal-tower" position={[x, ground, z]} rotation={[0, FACING, 0]}>
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <cylinderGeometry args={[2.55, 2.8, 1.1, 8]} />
        <meshStandardMaterial color="#9da7a0" roughness={1} flatShading />
      </mesh>
      {[-1.55, 1.55].flatMap((px) =>
        [-1.55, 1.55].map((pz) => (
          <Box
            key={`${px}:${pz}`}
            pos={[px, 2.6, pz]}
            size={[0.19, 5.0, 0.19]}
            color="#565d59"
            radius={0}
          />
        )),
      )}
      <Box pos={[0, 5.08, 0]} size={[3.7, 0.28, 3.7]} color="#68756f" radius={0} />
      <Box pos={[0, 3.08, -1.58]} size={[3.45, 0.13, 0.13]} color="#789085" radius={0} />
      <Box pos={[0, 3.08, 1.58]} size={[3.45, 0.13, 0.13]} color="#789085" radius={0} />
      <Box pos={[-1.58, 3.08, 0]} size={[0.13, 0.13, 3.45]} color="#789085" radius={0} />
      <Box pos={[1.58, 3.08, 0]} size={[0.13, 0.13, 3.45]} color="#789085" radius={0} />
      <mesh position={[0, 6.88, 0]} castShadow>
        <coneGeometry args={[2.45, 1.8, 8]} />
        <meshStandardMaterial color="#495e60" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 5.94, 0]}>
        <octahedronGeometry args={[0.68, 0]} />
        <meshStandardMaterial
          color="#f0dba5"
          emissive="#e9ba73"
          emissiveIntensity={night ? 1.5 : 0.22}
          roughness={0.48}
        />
      </mesh>
      <Cylinder pos={[0, 7.92, 0]} r={0.06} h={0.52} color="#72786e" />
      <Box pos={[0, 8.2, 0]} size={[1.3, 0.12, 0.12]} color="#d1b98e" radius={0} />
      <Box pos={[0, 8.2, 0]} size={[0.12, 0.12, 1.3]} color="#d1b98e" radius={0} />
      <Sign
        text="NORTHSTAR"
        pos={[0, 4.55, 1.92]}
        size={[2.25, 0.46]}
        color="#f2e9d4"
        background="#455a5c"
      />
      <Box pos={[0, 5.72, 2.02]} size={[0.12, 0.12, 0.5]} color="#59635d" radius={0} />
      <mesh position={[0, 5.58, 2.28]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color="#ffe0a9"
          emissive="#f1b872"
          emissiveIntensity={night ? 1.7 : 0.2}
          roughness={0.5}
        />
      </mesh>
      {quality === 'high' && (
        <group name="northstar-platform-detail">
          <Box pos={[-1.55, 5.61, 0]} size={[0.13, 0.83, 3.4]} color="#80938b" radius={0} />
          <Box pos={[1.55, 5.61, 0]} size={[0.13, 0.83, 3.4]} color="#80938b" radius={0} />
        </group>
      )}
    </group>
  );
}

export const NORTHSTAR_BENCH_XZ = [51.2, -110.5] as const;

function OutpostFurniture() {
  const quality = useWorld((state) => state.quality);
  const night = useWorld((state) => state.night);
  const [seatX, seatZ] = NORTHSTAR_BENCH_XZ;
  const seatY =
    Math.max(renderedTerrainHeight(seatX - 1, seatZ), renderedTerrainHeight(seatX + 1, seatZ)) +
    0.66;
  return (
    <group name="northstar-outpost-furniture">
      <Box pos={[seatX, seatY, seatZ]} size={[2.25, 0.16, 0.63]} color="#907d67" radius={0} />
      <Box
        pos={[seatX, seatY + 0.37, seatZ - 0.28]}
        size={[2.25, 0.7, 0.13]}
        color="#907d67"
        radius={0}
      />
      {[-0.9, 0.9].map((offset) => {
        const ground = renderedTerrainHeight(seatX + offset, seatZ);
        return (
          <Box
            key={offset}
            pos={[seatX + offset, (seatY + ground) / 2, seatZ]}
            size={[0.13, seatY - ground, 0.53]}
            color="#575e58"
            radius={0}
          />
        );
      })}
      {quality === 'high' && (
        <group position={[53.2, renderedTerrainHeight(53.2, -122.4), -122.4]}>
          <Cylinder pos={[0, 0.62, 0]} r={0.07} h={1.22} color="#677a72" />
          <mesh position={[0, 1.27, 0]}>
            <octahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial
              color="#f3d6a4"
              emissive="#e8b876"
              emissiveIntensity={night ? 1.1 : 0.1}
              roughness={0.6}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

const HIGHLAND_TREES: readonly [number, number, number][] = [
  [30, -121, 3.4],
  [27, -114, 3.1],
  [56, -127, 3.7],
  [58, -108, 2.8],
  [21, -109, 3.4],
  [45, -132, 3.2],
];

function HighlandFringe() {
  const quality = useWorld((state) => state.quality);
  const pines = useMemo(
    () =>
      HIGHLAND_TREES.slice(0, quality === 'high' ? 6 : 3).filter(
        ([x, z]) => clearOfNorthstarTrail(x, z, 1.1) && clearOfNorthstarStructure(x, z, 1.1),
      ),
    [quality],
  );
  const rocks = useMemo(() => {
    const count = quality === 'high' ? 22 : 10;
    return Array.from({ length: count }, (_, index) => {
      const angle = index * 2.399963 + 0.4;
      const radius = 7.3 + (index % 6) * 0.85;
      return {
        x: NORTHSTAR_OUTPOST.x + Math.cos(angle) * radius,
        z: NORTHSTAR_OUTPOST.z + Math.sin(angle) * radius,
        size: 0.42 + (index % 5) * 0.13,
      };
    }).filter(
      ({ x, z, size }) =>
        clearOfNorthstarTrail(x, z, size + 0.6) && clearOfNorthstarStructure(x, z, size + 0.6),
    );
  }, [quality]);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const scree = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const shades = ['#879794', '#a9b2aa', '#7c908c'].map((value) => new THREE.Color(value));
    pines.forEach(([x, z, height], index) => {
      const root = renderedTerrainHeight(x, z);
      matrix.compose(
        position.set(x, root + height * 0.32, z),
        rotation,
        scale.set(1, height * 0.64, 1),
      );
      trunks.current!.setMatrixAt(index, matrix);
      matrix.compose(
        position.set(x, root + height * 0.77, z),
        rotation,
        scale.set(height * 0.31, height * 0.55, height * 0.31),
      );
      crowns.current!.setMatrixAt(index, matrix);
      crowns.current!.setColorAt(index, shades[index % shades.length]);
    });
    rocks.forEach(({ x, z, size }, index) => {
      matrix.compose(
        position.set(x, renderedTerrainHeight(x, z) + size * 0.24, z),
        rotation,
        scale.set(size, size * 0.55, size * 0.9),
      );
      scree.current!.setMatrixAt(index, matrix);
      scree.current!.setColorAt(index, shades[(index + 1) % shades.length]);
    });
    const owned = [trunks.current, crowns.current, scree.current].filter(
      (mesh): mesh is THREE.InstancedMesh => Boolean(mesh),
    );
    for (const mesh of owned) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return () => {
      owned.forEach((mesh) => mesh.dispose());
    };
  }, [pines, rocks]);
  return (
    <group key={quality} name="northstar-highland-fringe">
      <instancedMesh
        ref={trunks}
        args={[undefined, undefined, pines.length]}
        castShadow={quality === 'high'}
      >
        <cylinderGeometry args={[0.07, 0.16, 1, 5]} />
        <meshStandardMaterial color="#59645f" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={crowns}
        args={[undefined, undefined, pines.length]}
        castShadow={quality === 'high'}
      >
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={scree} args={[undefined, undefined, rocks.length]} receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

export function NorthstarOutpost() {
  return (
    <group name="northstar-outpost-destination">
      <SignalTower />
      <OutpostFurniture />
      <HighlandFringe />
    </group>
  );
}
