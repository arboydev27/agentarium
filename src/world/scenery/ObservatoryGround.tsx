import { TerrainApron } from '../TerrainApron';
import { WorldSurfaceMaterial } from '../WorldSurfaceMaterial';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OBSERVATORY } from '../layout';
import { meadowTrailPoint, walkwayHeight } from '../terrain';
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
      <WorldSurfaceMaterial
        family="cast-foundation"
        vertexColors
        roughness={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ObservatoryPad() {
  return <TerrainApron x={OBSERVATORY.x} z={OBSERVATORY.z} radius={3.25} />;
}

export function ObservatoryGround() {
  return (
    <group name="cedar-observatory-walkable-ground">
      <ObservatoryPath />
      <ObservatoryPad />
    </group>
  );
}
