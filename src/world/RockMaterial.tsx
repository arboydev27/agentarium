import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { applySurfaceDetails } from './WorldSurfaceMaterial';
import { useTerrainTextures } from './terrainTextures';

// Rocks share the terrain's baked basalt layer through the triplanar detail
// path, so boulders and the slopes they sit on read as the same stone.
export function RockMaterial({
  color = '#ffffff',
  metres = 1.3,
}: {
  color?: string;
  metres?: number;
}) {
  const { basalt } = useTerrainTextures();
  const material = useMemo(() => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    applySurfaceDetails(result, [basalt.color, basalt.normal, basalt.roughness], metres);
    return result;
  }, [basalt, color, metres]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}
