import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { renderedTerrainHeight } from '../terrain';
import { WOODLAND_HOLLOW, WOODLAND_TRAIL_XZ } from './woodlandPlacement';

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
