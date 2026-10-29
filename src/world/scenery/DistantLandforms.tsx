import { WorldSurfaceMaterial } from '../WorldSurfaceMaterial';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { renderedTerrainHeight } from '../terrain';
import {
  DISTANT_LANDFORMS,
  LANDFORM_SKIRT_DROP,
  LANDFORM_SKIRT_RADIUS,
  landformRingPoint,
  type DistantLandform,
  type LandformBiome,
} from './distantLandformPlacement';

const baseColor: Record<LandformBiome, string> = {
  woodland: '#8b4b40',
  highland: '#995d4b',
  amber: '#b5754e',
  meadow: '#b36b4d',
};
const crestColor: Record<LandformBiome, string> = {
  woodland: '#bb795e',
  highland: '#ca9980',
  amber: '#e2ac78',
  meadow: '#d3956e',
};
const RINGS = [0.24, 0.48, 0.7, 0.88, LANDFORM_SKIRT_RADIUS] as const;

function addLandform(
  landform: DistantLandform,
  sides: number,
  positions: number[],
  colors: number[],
  indices: number[],
) {
  const start = positions.length / 3;
  const base = new THREE.Color(baseColor[landform.biome]);
  const crest = new THREE.Color(crestColor[landform.biome]);
  const color = new THREE.Color();
  const addVertex = (x: number, y: number, z: number, tint: number) => {
    positions.push(x, y, z);
    color.copy(base).lerp(crest, tint);
    colors.push(color.r, color.g, color.b);
  };
  addVertex(
    landform.x,
    renderedTerrainHeight(landform.x, landform.z) + landform.rise,
    landform.z,
    0.95,
  );
  RINGS.forEach((radius, ring) => {
    for (let section = 0; section < sides; section++) {
      const { x, z } = landformRingPoint(landform, radius, section, sides);
      const lift =
        ring === RINGS.length - 1
          ? -LANDFORM_SKIRT_DROP
          : landform.rise * Math.pow(1 - radius * radius, 2);
      addVertex(x, renderedTerrainHeight(x, z) + lift, z, (1 - radius) * 0.88);
      const next = (section + 1) % sides;
      if (ring === 0) indices.push(start, start + 1 + next, start + 1 + section);
      else {
        const previous = start + 1 + (ring - 1) * sides;
        const current = start + 1 + ring * sides;
        indices.push(previous + section, previous + next, current + section);
        indices.push(previous + next, current + next, current + section);
      }
    }
  });
}

// One terrain-following mesh draws all authored forms. Its center rises are
// authored, but every perimeter vertex samples the same rendered ground as
// resident paths; the skirt disappears below that ground.
export function DistantLandforms() {
  const quality = useWorld((state) => state.quality);
  const night = useWorld((state) => state.night);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (const landform of DISTANT_LANDFORMS)
      addLandform(landform, quality === 'high' ? 24 : 12, positions, colors, indices);
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    mesh.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    mesh.setIndex(indices);
    mesh.computeVertexNormals();
    mesh.computeBoundingSphere();
    return mesh;
  }, [quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="distant-rolling-landforms" geometry={geometry} receiveShadow>
      <WorldSurfaceMaterial
        family="ironstone"
        vertexColors
        color={night ? '#a4b7c2' : '#ffffff'}
        roughness={1}
        flatShading
      />
    </mesh>
  );
}
