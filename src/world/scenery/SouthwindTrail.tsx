import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { walkwayHeight } from '../terrain';
import { SOUTHWIND_TRAIL_XZ } from './southwindTrailPlacement';

// The same authored centerline drives navigation and this visible walking surface.
// Short subsegments keep the ribbon above the coarse Landscape triangles.
function trailSamples() {
  const samples: [number, number][] = [];
  for (let index = 1; index < SOUTHWIND_TRAIL_XZ.length; index++) {
    const [ax, az] = SOUTHWIND_TRAIL_XZ[index - 1];
    const [bx, bz] = SOUTHWIND_TRAIL_XZ[index];
    const subdivisions = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.65));
    for (let step = index === 1 ? 0 : 1; step <= subdivisions; step++) {
      const t = step / subdivisions;
      samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
    }
  }
  return samples;
}

export function SouthwindTrail() {
  const geometry = useMemo(() => {
    const samples = trailSamples();
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const edge = new THREE.Color('#b9ad88');
    const worn = new THREE.Color('#d0c29b');
    for (let index = 0; index < samples.length; index++) {
      const [x, z] = samples[index];
      const [px, pz] = samples[Math.max(0, index - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const sidewaysX = -(nz - pz) / length;
      const sidewaysZ = (nx - px) / length;
      for (const [offset, color] of [
        [-0.9, edge],
        [0, worn],
        [0.9, edge],
      ] as const) {
        const sx = x + sidewaysX * offset;
        const sz = z + sidewaysZ * offset;
        positions.push(sx, walkwayHeight(sx, sz, 0.08), sz);
        colors.push(color.r, color.g, color.b);
      }
      if (index > 0) {
        const a = (index - 1) * 3;
        const b = index * 3;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
        indices.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      }
    }
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    ribbon.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    ribbon.setIndex(indices);
    ribbon.computeVertexNormals();
    return ribbon;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="southwind-walking-trail" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}
