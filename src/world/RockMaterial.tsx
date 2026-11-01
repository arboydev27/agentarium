import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { applySurfaceDetails, surfaceGain } from './surfaceShader';
import { useTerrainTextures } from './terrainTextures';

// Rocks share the terrain's basalt layer (baked or scanned) through the
// triplanar detail path, so boulders and the slopes they sit on read as the same
// stone. The map is read around its own mean; the gain stays the authored layer's.
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
    applySurfaceDetails(result, [basalt.color, basalt.normal, basalt.roughness], {
      metres,
      base: basalt.mean,
      gain: surfaceGain(basalt.base),
      normalScale: 1,
      contrast: 0.7,
    });
    return result;
  }, [basalt, color, metres]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}
