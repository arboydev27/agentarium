import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { renderedTerrainHeight } from './terrain';
import { WorldSurfaceMaterial } from './WorldSurfaceMaterial';

export function TerrainApron({ x, z, radius }: { x: number; z: number; radius: number }) {
  const geometry = useMemo(() => {
    const points: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    const middle = new THREE.Color('#c1b29a'),
      dust = new THREE.Color('#b18b6e');
    const rings = 8,
      segments = 64;
    for (let ring = 0; ring <= rings; ring++)
      for (let segment = 0; segment <= segments; segment++) {
        const angle = (segment / segments) * Math.PI * 2,
          r = (radius * ring) / rings;
        const px = x + Math.cos(angle) * r,
          pz = z + Math.sin(angle) * r;
        points.push(px, renderedTerrainHeight(px, pz) + 0.105, pz);
        const color = middle.clone().lerp(dust, Math.pow(ring / rings, 12) * 0.65);
        colors.push(color.r, color.g, color.b);
        if (ring && segment) {
          const a = (ring - 1) * (segments + 1) + segment - 1,
            b = ring * (segments + 1) + segment - 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    for (let i = 0; i < segments; i++) {
      const a = rings * (segments + 1) + i,
        b = a + 1,
        base = points.length / 3;
      points.push(
        points[a * 3],
        points[a * 3 + 1] - 0.25,
        points[a * 3 + 2],
        points[b * 3],
        points[b * 3 + 1] - 0.25,
        points[b * 3 + 2],
      );
      colors.push(dust.r, dust.g, dust.b, dust.r, dust.g, dust.b);
      indices.push(a, base, b, b, base, base + 1);
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, [x, z, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <WorldSurfaceMaterial family="cast-foundation" vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}
