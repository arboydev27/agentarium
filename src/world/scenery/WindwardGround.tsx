import { WornGroundMaterial, withAcross } from '../WornGround';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { walkwayHeight } from '../terrain';
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
    const across: number[] = [];
    const indices: number[] = [];
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
        across.push(side);
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
    ribbon.setIndex(indices);
    ribbon.computeVertexNormals();
    return withAcross(ribbon, across);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="windward-branch-trail" geometry={geometry} receiveShadow>
      <WornGroundMaterial tone="walk" />
    </mesh>
  );
}

function ArrivalCircle() {
  const geometry = useMemo(() => {
    const { x, z } = WINDWARD_MILL;
    const positions = [x, walkwayHeight(x, z, 0.1), z];
    const across = [0];
    const indices: number[] = [];
    for (let index = 0; index <= 32; index++) {
      const angle = (index / 32) * Math.PI * 2;
      const px = x + Math.cos(angle) * 2.75;
      const pz = z + Math.sin(angle) * 2.75;
      positions.push(px, walkwayHeight(px, pz, 0.1), pz);
      across.push(1);
      if (index) indices.push(0, index, index + 1);
    }
    const pad = new THREE.BufferGeometry();
    pad.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pad.setIndex(indices);
    pad.computeVertexNormals();
    return withAcross(pad, across);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="windward-arrival-circle" geometry={geometry} receiveShadow>
      <WornGroundMaterial tone="pad" />
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
