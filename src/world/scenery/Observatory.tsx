import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { OBSERVATORY } from '../layout';
import { meadowTrailPoint, terrainHeight, walkwayHeight } from '../terrain';
import { Box, Cylinder, Sign } from '../primitives';
import { OBSERVATORY_BRANCH } from './observatoryPlacement';

function ObservatoryPath() {
  const geometry = useMemo(() => {
    const [startX, , startZ] = meadowTrailPoint(16);
    const controls: readonly [number, number][] = [[startX, startZ], ...OBSERVATORY_BRANCH];
    const samples: [number, number][] = [];
    for (let segment = 1; segment < controls.length; segment++) {
      const [ax, az] = controls[segment - 1];
      const [bx, bz] = controls[segment];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.4);
      for (let step = segment === 1 ? 0 : 1; step <= steps; step++) {
        const t = step / steps;
        samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
      }
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const center = new THREE.Color('#d7ccb0');
    const edge = new THREE.Color('#9c9c83');
    samples.forEach(([x, z], index) => {
      const [px, pz] = samples[Math.max(0, index - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const normalX = -(nz - pz) / length;
      const normalZ = (nx - px) / length;
      const lift = 0.055 + (index / (samples.length - 1)) * 0.04;
      for (const side of [-1, 0, 1]) {
        const edgeX = x + normalX * side * 1.08;
        const edgeZ = z + normalZ * side * 1.08;
        positions.push(edgeX, walkwayHeight(edgeX, edgeZ, lift), edgeZ);
        const shade = side === 0 ? center : edge;
        colors.push(shade.r, shade.g, shade.b);
      }
      if (index) {
        const a = (index - 1) * 3;
        indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
        indices.push(a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
      }
    });
    const path = new THREE.BufferGeometry();
    path.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    path.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    path.setIndex(indices);
    path.computeVertexNormals();
    return path;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="cedar-observatory-path" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

const CEDAR_SITES: [number, number, number][] = [
  [-40, -56, 1.1],
  [-36, -61, 1.35],
  [-26, -60, 1.2],
  [-21, -57, 1.05],
  [-41, -49, 0.9],
  [-23, -44, 0.95],
];

function CedarFringe() {
  const quality = useWorld((state) => state.quality);
  const sites = useMemo(() => CEDAR_SITES.slice(0, quality === 'high' ? 6 : 4), [quality]);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const boughs = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!trunks.current || !boughs.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const foliage = ['#4b6d5c', '#587861', '#66826a'].map((value) => new THREE.Color(value));
    sites.forEach(([x, z, size], index) => {
      const y = terrainHeight(x, z);
      matrix.compose(position.set(x, y + 1.75 * size, z), rotation, scale.set(size, size, size));
      trunks.current!.setMatrixAt(index, matrix);
      for (let tier = 0; tier < 2; tier++) {
        matrix.compose(
          position.set(x, y + (2.35 + tier * 1.25) * size, z),
          rotation,
          scale.set(
            (1.55 - tier * 0.3) * size,
            (2.2 - tier * 0.2) * size,
            (1.55 - tier * 0.3) * size,
          ),
        );
        boughs.current!.setMatrixAt(index * 2 + tier, matrix);
        boughs.current!.setColorAt(index * 2 + tier, foliage[(index + tier) % foliage.length]);
      }
    });
    for (const mesh of [trunks.current, boughs.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [sites]);
  return (
    <group name="cedar-observatory-fringe">
      <instancedMesh ref={trunks} args={[undefined, undefined, sites.length]} castShadow>
        <cylinderGeometry args={[0.11, 0.23, 3.5, 6]} />
        <meshStandardMaterial color="#635541" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={boughs} args={[undefined, undefined, sites.length * 2]} castShadow>
        <coneGeometry args={[1, 2, 7]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

function BrassTelescope() {
  const night = useWorld((state) => state.night);
  return (
    <group name="cedar-telescope" position={[-1.25, 0, -1.55]}>
      <Cylinder pos={[0, 0.3, 0]} r={0.52} top={0.38} h={0.58} color="#6d7770" />
      <Cylinder pos={[0, 0.93, 0]} r={0.12} h={0.83} color="#8d6c4f" />
      <mesh position={[0, 1.38, 0]} castShadow>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color="#cfa875" metalness={0.32} roughness={0.48} />
      </mesh>
      <mesh position={[0.2, 2.2, 0]} rotation={[0.12, 0, -0.58]} castShadow>
        <cylinderGeometry args={[0.37, 0.3, 2.45, 12]} />
        <meshStandardMaterial color="#b8895b" metalness={0.42} roughness={0.46} />
      </mesh>
      <mesh position={[0.89, 3.2, -0.15]} rotation={[0.12, 0, -0.58]} castShadow>
        <cylinderGeometry args={[0.43, 0.43, 0.17, 12]} />
        <meshStandardMaterial color="#ebc989" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0.94, 3.27, -0.16]} rotation={[0.12, 0, -0.58]}>
        <circleGeometry args={[0.33, 16]} />
        <meshStandardMaterial
          color="#729ba0"
          emissive="#75aaa9"
          emissiveIntensity={night ? 0.65 : 0.17}
          metalness={0.25}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Box pos={[-0.67, 0.87, 0.04]} size={[0.7, 0.16, 0.38]} color="#8b765d" radius={0} />
    </group>
  );
}

function ObservatoryTerrace() {
  const ground = terrainHeight(OBSERVATORY.x, OBSERVATORY.z);
  const night = useWorld((state) => state.night);
  const quality = useWorld((state) => state.quality);
  const lanterns: [number, number][] = [
    [-2.55, 1.4],
    [2.55, 1.4],
    [-2.35, -1.75],
    [2.35, -1.75],
  ];
  return (
    <group name="cedar-observatory-arrival" position={[OBSERVATORY.x, ground, OBSERVATORY.z]}>
      <Cylinder pos={[0, 0.025, 0]} r={3.25} h={0.16} color="#aeb3a1" />
      <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[2.85, 3.16, 32]} />
        <meshStandardMaterial color="#ddd7bd" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <group position={[-1.25, 0, -1.55]}>
        <mesh position={[0, 1.75, 0]} castShadow>
          <torusGeometry args={[2.05, 0.1, 6, 28, Math.PI]} />
          <meshStandardMaterial color="#667b72" metalness={0.18} roughness={0.7} />
        </mesh>
        <Cylinder pos={[-2.05, 0.88, 0]} r={0.11} h={1.75} color="#647b71" />
        <Cylinder pos={[2.05, 0.88, 0]} r={0.11} h={1.75} color="#647b71" />
      </group>
      <BrassTelescope />
      <Sign
        text="CEDAR OBSERVATORY"
        pos={[0, 1.1, -3.0]}
        size={[2.85, 0.49]}
        color="#f2e8c8"
        background="#355b51"
      />
      {lanterns.slice(0, quality === 'high' ? 4 : 2).map(([x, z], index) => (
        <group key={index} position={[x, 0, z]}>
          <Cylinder pos={[0, 0.64, 0]} r={0.07} h={1.28} color="#4c665a" />
          <mesh position={[0, 1.29, 0]}>
            <octahedronGeometry args={[0.19, 0]} />
            <meshStandardMaterial
              color="#f4dda2"
              emissive="#e7b86e"
              emissiveIntensity={night ? 1.5 : 0.12}
              roughness={0.55}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function CedarObservatory() {
  return (
    <group name="cedar-observatory">
      <ObservatoryPath />
      <ObservatoryTerrace />
      <CedarFringe />
    </group>
  );
}
