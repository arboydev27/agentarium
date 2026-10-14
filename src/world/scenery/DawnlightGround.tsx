import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { walkwayHeight } from '../terrain';
import { DAWNLIGHT_GLASSHOUSE, EAST_TRAIL_XZ } from './dawnlightPlacement';
import { HEADING, HALF_WIDTH, HALF_LENGTH, localToWorld } from './dawnlightStructure';

function EastTrail() {
  const geometry = useMemo(() => {
    const samples: [number, number][] = [];
    for (let index = 1; index < EAST_TRAIL_XZ.length; index++) {
      const [ax, az] = EAST_TRAIL_XZ[index - 1];
      const [bx, bz] = EAST_TRAIL_XZ[index];
      const sections = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.7));
      for (let step = index === 1 ? 0 : 1; step <= sections; step++) {
        const t = step / sections;
        samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
      }
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const edge = new THREE.Color('#a89c77');
    const middle = new THREE.Color('#d3c7a2');
    samples.forEach(([x, z], index) => {
      const [px, pz] = samples[Math.max(0, index - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const normalX = -(nz - pz) / length;
      const normalZ = (nx - px) / length;
      for (const [side, color] of [
        [-1, edge],
        [0, middle],
        [1, edge],
      ] as const) {
        const sx = x + normalX * side;
        const sz = z + normalZ * side;
        positions.push(sx, walkwayHeight(sx, sz, 0.08), sz);
        colors.push(color.r, color.g, color.b);
      }
      if (index > 0) {
        const a = (index - 1) * 3;
        const b = index * 3;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
        indices.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
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
    <mesh name="dawnlight-east-trail" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Forecourt() {
  const geometry = useMemo(() => {
    const { x: centerX, z: centerZ } = DAWNLIGHT_GLASSHOUSE;
    const positions = [centerX, walkwayHeight(centerX, centerZ, 0.09), centerZ];
    const indices: number[] = [];
    const segments = 32;
    for (let index = 0; index <= segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const radius = 3.25 + 0.08 * Math.sin(angle * 6);
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      positions.push(x, walkwayHeight(x, z, 0.09), z);
      if (index > 0) indices.push(0, index, index + 1);
    }
    const pad = new THREE.BufferGeometry();
    pad.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pad.setIndex(indices);
    pad.computeVertexNormals();
    return pad;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="dawnlight-arrival-forecourt" geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#c6b995" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ConservatoryFloor() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const columns = 12;
    const rows = 10;
    for (let row = 0; row <= rows; row++) {
      const localZ = -HALF_LENGTH + (row / rows) * HALF_LENGTH * 2;
      for (let column = 0; column <= columns; column++) {
        const localX = -HALF_WIDTH + (column / columns) * HALF_WIDTH * 2;
        const [x, z] = localToWorld(localX, localZ);
        positions.push(localX, walkwayHeight(x, z, 0.045), localZ);
        if (row && column) {
          const a = (row - 1) * (columns + 1) + column - 1;
          const b = a + columns + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    const floor = new THREE.BufferGeometry();
    floor.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    floor.setIndex(indices);
    floor.computeVertexNormals();
    return floor;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="dawnlight-conservatory-floor" geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#c8c2a2" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DawnlightGround() {
  return (
    <group name="dawnlight-walkable-ground">
      <EastTrail />
      <Forecourt />
      <group
        name="dawnlight-conservatory-floor-ground"
        position={[DAWNLIGHT_GLASSHOUSE.centerX, 0, DAWNLIGHT_GLASSHOUSE.centerZ]}
        rotation={[0, HEADING, 0]}
      >
        <ConservatoryFloor />
      </group>
    </group>
  );
}
