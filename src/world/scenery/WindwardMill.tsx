import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { Box, Cylinder, Sign } from '../primitives';
import { renderedTerrainHeight, walkwayHeight } from '../terrain';
import { WINDWARD_BRANCH_XZ, WINDWARD_MILL } from './windwardPlacement';

// The shared Dawnlight trail already reaches this fork. The new surface begins
// at its exact junction and remains mounted when the decorative mill is culled.
function WindwardTrail() {
  const geometry = useMemo(() => {
    const samples: [number, number][] = [];
    for (let index = 1; index < WINDWARD_BRANCH_XZ.length; index++) {
      const [ax, az] = WINDWARD_BRANCH_XZ[index - 1];
      const [bx, bz] = WINDWARD_BRANCH_XZ[index];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.7));
      for (let step = index === 1 ? 0 : 1; step <= steps; step++) {
        const t = step / steps;
        samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
      }
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const edge = new THREE.Color('#9f9a7d');
    const center = new THREE.Color('#d3c5a1');
    samples.forEach(([x, z], index) => {
      const [px, pz] = samples[Math.max(0, index - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const normalX = -(nz - pz) / length;
      const normalZ = (nx - px) / length;
      for (const side of [-1, 0, 1]) {
        const sx = x + normalX * side;
        const sz = z + normalZ * side;
        positions.push(sx, walkwayHeight(sx, sz, 0.08), sz);
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
    <mesh name="windward-branch-trail" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ArrivalCircle() {
  const geometry = useMemo(() => {
    const { x, z } = WINDWARD_MILL;
    const positions = [x, walkwayHeight(x, z, 0.1), z];
    const indices: number[] = [];
    for (let index = 0; index <= 32; index++) {
      const angle = (index / 32) * Math.PI * 2;
      const px = x + Math.cos(angle) * 2.75;
      const pz = z + Math.sin(angle) * 2.75;
      positions.push(px, walkwayHeight(px, pz, 0.1), pz);
      if (index) indices.push(0, index, index + 1);
    }
    const pad = new THREE.BufferGeometry();
    pad.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pad.setIndex(indices);
    pad.computeVertexNormals();
    return pad;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="windward-arrival-circle" geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#bcb59a" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function WindwardGround() {
  return (
    <group name="windward-permanent-ground">
      <WindwardTrail />
      <ArrivalCircle />
    </group>
  );
}

// The northwest-facing sails present their broad face to the authored camera while the
// resident arrives on the clear north side of the mill clearing.
const FACING = Math.atan2(-15, 20);

function Sails() {
  const reducedMotion = useWorld((state) => state.reducedMotion);
  const wheel = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!reducedMotion && wheel.current) wheel.current.rotation.z += Math.min(delta, 0.05) * 0.22;
  });
  return (
    <group name="windward-sail-wheel" position={[0, 6.15, 2.13]}>
      <Cylinder
        pos={[0, 0, -0.25]}
        r={0.13}
        h={0.8}
        color="#654f3a"
        rotation={[Math.PI / 2, 0, 0]}
      />
      <group ref={wheel} rotation={[0, 0, -Math.PI / 8]}>
        {[0, 1, 2, 3].map((index) => (
          <group key={index} rotation={[0, 0, (index * Math.PI) / 2]}>
            <Box pos={[0, 1.94, 0]} size={[0.15, 3.35, 0.16]} color="#624c39" radius={0} />
            <Box pos={[-0.55, 2.25, 0.04]} size={[0.95, 2.24, 0.09]} color="#e6d5ad" radius={0} />
            <Box pos={[-1.02, 2.25, 0.08]} size={[0.1, 2.35, 0.12]} color="#806345" radius={0} />
          </group>
        ))}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.39, 0.39, 0.2, 12]} />
          <meshStandardMaterial color="#8c6d47" roughness={0.72} />
        </mesh>
      </group>
    </group>
  );
}

function Tower() {
  const night = useWorld((state) => state.night);
  const { centerX, centerZ } = WINDWARD_MILL;
  const ground = renderedTerrainHeight(centerX, centerZ);
  return (
    <group
      name="windward-mill-tower"
      position={[centerX, ground, centerZ]}
      rotation={[0, FACING, 0]}
    >
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <cylinderGeometry args={[2.45, 2.7, 0.8, 12]} />
        <meshStandardMaterial color="#aa9c7c" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 2.98, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.73, 2.42, 5.8, 12]} />
        <meshStandardMaterial color="#ded4b9" roughness={0.92} flatShading />
      </mesh>
      <mesh position={[0, 5.9, 0]} castShadow>
        <cylinderGeometry args={[1.78, 1.78, 0.34, 12]} />
        <meshStandardMaterial color="#68705c" roughness={0.88} flatShading />
      </mesh>
      <mesh position={[0, 6.88, 0]} castShadow>
        <coneGeometry args={[2.18, 1.75, 12]} />
        <meshStandardMaterial color="#5c6d5a" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 7.83, 0]} castShadow>
        <sphereGeometry args={[0.17, 8, 6]} />
        <meshStandardMaterial color="#d9b47b" roughness={0.55} metalness={0.2} />
      </mesh>
      <Box pos={[0, 1.05, 2.38]} size={[1.23, 2.08, 0.2]} color="#6a5b47" radius={0} />
      <Box pos={[0, 2.12, 2.47]} size={[1.42, 0.12, 0.28]} color="#9d8061" radius={0} />
      <Box pos={[0, 4.3, 1.96]} size={[0.76, 0.82, 0.13]} color="#53685e" radius={0} />
      <mesh position={[0, 4.3, 2.05]}>
        <planeGeometry args={[0.55, 0.6]} />
        <meshStandardMaterial
          color="#e2c58f"
          emissive="#efbd77"
          emissiveIntensity={night ? 0.65 : 0.08}
          roughness={0.55}
        />
      </mesh>
      <Sails />
    </group>
  );
}

function Workyard() {
  const night = useWorld((state) => state.night);
  const quality = useWorld((state) => state.quality);
  const sacks: readonly [number, number, number][] = [
    [66.2, -24.3, 0],
    [67.4, -25.5, 0.4],
    [65.9, -26, -0.15],
  ];
  return (
    <group name="windward-workyard">
      <group position={[64.6, renderedTerrainHeight(64.6, -23.5), -23.5]}>
        <Box pos={[0, -0.15, 0]} size={[3.4, 0.9, 2.85]} color="#a99b7d" radius={0} />
        <Box pos={[0, 1.25, 0]} size={[3.1, 2.5, 2.55]} color="#826b4f" radius={0} />
        <mesh position={[0, 2.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[2.55, 1.4, 4]} />
          <meshStandardMaterial color="#61725e" roughness={0.92} flatShading />
        </mesh>
        <Box pos={[1.56, 1.03, 0.15]} size={[0.12, 1.65, 1.18]} color="#4e5949" radius={0} />
      </group>
      {sacks.slice(0, quality === 'high' ? 3 : 2).map(([x, z, angle], index) => (
        <group key={index} position={[x, renderedTerrainHeight(x, z), z]} rotation={[0, angle, 0]}>
          <Cylinder pos={[0, 0.48, 0]} r={0.44} top={0.34} h={0.95} color="#aa9166" />
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.32, 8, 6]} />
            <meshStandardMaterial color="#d8bf8c" roughness={1} />
          </mesh>
        </group>
      ))}
      <group position={[78.9, renderedTerrainHeight(78.9, -21.7), -21.7]}>
        <Cylinder pos={[0, 0.7, 0]} r={0.06} h={1.4} color="#5d6953" />
        <mesh position={[0, 1.46, 0]}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color="#f5dbad"
            emissive="#edb76e"
            emissiveIntensity={night ? 1.3 : 0.12}
            roughness={0.6}
          />
        </mesh>
      </group>
      <Sign
        text="WINDWARD MILL"
        pos={[80.6, renderedTerrainHeight(80.6, -15.7) + 1.25, -15.7]}
        size={[2.5, 0.47]}
        background="#445c52"
        color="#f5e9c9"
      />
    </group>
  );
}

function GrainPatches() {
  const quality = useWorld((state) => state.quality);
  const stalks = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const sites = useMemo(() => {
    const count = quality === 'high' ? 90 : 40;
    return Array.from({ length: count }, (_, index) => {
      const patch = index % 5;
      const cx = [79, 65, 80.5, 83, 85][patch];
      const cz = [-24, -29, -18.5, -20, -10.5][patch];
      const ring = Math.floor(index / 5);
      const angle = ring * 2.39996 + patch * 0.75;
      const radius = 0.2 + (ring % 6) * 0.2;
      return {
        x: cx + Math.cos(angle) * radius,
        z: cz + Math.sin(angle) * radius,
        h: 0.48 + (index % 5) * 0.08,
      };
    });
  }, [quality]);
  useEffect(() => {
    if (!stalks.current || !heads.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const shades = ['#b7ad70', '#d5ba75', '#acb078'].map((shade) => new THREE.Color(shade));
    sites.forEach(({ x, z, h }, index) => {
      const ground = renderedTerrainHeight(x, z);
      matrix.compose(position.set(x, ground + h * 0.5, z), rotation, scale.set(1, h, 1));
      stalks.current!.setMatrixAt(index, matrix);
      matrix.compose(
        position.set(x, ground + h + 0.13, z),
        rotation,
        scale.set(1, 0.8 + (index % 3) * 0.1, 1),
      );
      heads.current!.setMatrixAt(index, matrix);
      heads.current!.setColorAt(index, shades[index % shades.length]);
    });
    const instances = [stalks.current, heads.current];
    for (const mesh of instances) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return () => {
      instances.forEach((mesh) => mesh.dispose());
    };
  }, [sites]);
  return (
    <group key={quality} name="windward-grain-patches">
      <instancedMesh
        ref={stalks}
        args={[undefined, undefined, sites.length]}
        castShadow={quality === 'high'}
      >
        <cylinderGeometry args={[0.018, 0.035, 1, 4]} />
        <meshStandardMaterial color="#75875d" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={heads}
        args={[undefined, undefined, sites.length]}
        castShadow={quality === 'high'}
      >
        <coneGeometry args={[0.075, 0.29, 5]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

function DrapedBed({ x, z, radius }: { x: number; z: number; radius: number }) {
  const geometry = useMemo(() => {
    const positions = [x, walkwayHeight(x, z, 0.045), z];
    const indices: number[] = [];
    for (let index = 0; index <= 16; index++) {
      const angle = (index / 16) * Math.PI * 2;
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      positions.push(px, walkwayHeight(px, pz, 0.045), pz);
      if (index) indices.push(0, index, index + 1);
    }
    const bed = new THREE.BufferGeometry();
    bed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    bed.setIndex(indices);
    bed.computeVertexNormals();
    return bed;
  }, [x, z, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#877e62" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function PlazaDetails() {
  const benchX = 81.5;
  const benchZ = -7;
  const seatY =
    Math.max(
      renderedTerrainHeight(benchX - 0.9, benchZ),
      renderedTerrainHeight(benchX + 0.9, benchZ),
    ) + 0.78;
  return (
    <group name="windward-plaza-details">
      <DrapedBed x={83} z={-20} radius={1.5} />
      <DrapedBed x={85} z={-10.5} radius={1.5} />
      <Box pos={[benchX, seatY, benchZ]} size={[2.2, 0.15, 0.63]} color="#8b7154" radius={0} />
      <Box
        pos={[benchX, seatY + 0.38, benchZ - 0.28]}
        size={[2.2, 0.7, 0.14]}
        color="#8b7154"
        radius={0}
      />
      {[-0.85, 0.85].map((offset) => {
        const x = benchX + offset;
        const ground = renderedTerrainHeight(x, benchZ);
        return (
          <Box
            key={offset}
            pos={[x, (seatY + ground) / 2, benchZ]}
            size={[0.12, seatY - ground, 0.5]}
            color="#5f5f4c"
            radius={0}
          />
        );
      })}
    </group>
  );
}

export function WindwardMill() {
  return (
    <group name="windward-mill-district">
      <Tower />
      <Workyard />
      <GrainPatches />
      <PlazaDetails />
    </group>
  );
}
