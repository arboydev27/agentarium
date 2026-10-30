import { WorldSurfaceMaterial } from '../WorldSurfaceMaterial';
import { WornGroundMaterial, withAcross } from '../WornGround';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ORCHARD } from '../layout';
import { meadowTrailPoint, terrainHeight, walkwayHeight } from '../terrain';
import { Cylinder } from '../primitives';
import { ORCHARD_BRANCH } from './orchardPlacement';

function OrchardPath() {
  const geometry = useMemo(() => {
    const [startX, , startZ] = meadowTrailPoint(22);
    const controls: [number, number][] = [[startX, startZ], ...ORCHARD_BRANCH];
    const samples: [number, number][] = [];
    for (let segment = 1; segment < controls.length; segment++) {
      const [ax, az] = controls[segment - 1];
      const [bx, bz] = controls[segment];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.6);
      for (let step = segment === 1 ? 0 : 1; step <= steps; step++) {
        const t = step / steps;
        samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
      }
    }
    const positions: number[] = [];
    const across: number[] = [];
    const indices: number[] = [];
    samples.forEach(([x, z], i) => {
      const [px, pz] = samples[Math.max(0, i - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, i + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const normalX = -(nz - pz) / length;
      const normalZ = (nx - px) / length;
      const progress = i / (samples.length - 1);
      const lift = 0.09 + 0.03 * THREE.MathUtils.smoothstep(progress, 0.85, 1);
      for (const side of [-1, 0, 1]) {
        const edgeX = x + normalX * side * 1.05;
        const edgeZ = z + normalZ * side * 1.05;
        positions.push(edgeX, walkwayHeight(edgeX, edgeZ, lift), edgeZ);
        across.push(side);
      }
      if (i) {
        const a = (i - 1) * 3;
        indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
        indices.push(a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
      }
    });
    const path = new THREE.BufferGeometry();
    path.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    path.setIndex(indices);
    path.computeVertexNormals();
    return withAcross(path, across);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="orchard-branch-path" geometry={geometry} receiveShadow>
      <WornGroundMaterial tone="walk" />
    </mesh>
  );
}

function ArrivalCircle() {
  const ground = terrainHeight(ORCHARD.x, ORCHARD.z);
  return (
    <group name="orchard-arrival" position={[ORCHARD.x, ground, ORCHARD.z]}>
      <Cylinder pos={[0, 0.04, 0]} r={2.85} h={0.16} color="#c8b18b" />
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.45, 2.77, 28]} />
        <WorldSurfaceMaterial
          family="cast-foundation"
          color="#e0cd9d"
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function OrchardGround() {
  return (
    <group name="orchard-walkable-ground">
      <OrchardPath />
      <ArrivalCircle />
    </group>
  );
}
