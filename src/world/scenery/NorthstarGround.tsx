import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { renderedTerrainHeight } from '../terrain';
import { NORTHSTAR_OUTPOST, NORTHSTAR_TRAIL_XZ } from './northstarPlacement';

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
