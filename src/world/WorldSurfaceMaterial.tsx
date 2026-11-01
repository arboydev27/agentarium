import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { applySurfaceDetails, surfaceFamilyDetails } from './surfaceShader';
import { useSurfaceTextures, type SurfaceFamily } from './surfaceTextures';

/** Physical-scale surface detail for authored meshes without useful UVs, including instances. */
export function WorldSurfaceMaterial({
  family = 'ironstone',
  color = '#ffffff',
  roughness = 1,
  metalness = 0,
  vertexColors = false,
  flatShading = false,
  side = THREE.FrontSide,
  metres = 2,
}: {
  family?: SurfaceFamily;
  color?: string;
  roughness?: number;
  metalness?: number;
  vertexColors?: boolean;
  flatShading?: boolean;
  side?: THREE.Side;
  metres?: number;
}) {
  const maps = useSurfaceTextures(family);
  const material = useMemo(() => {
    const result = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      vertexColors,
      flatShading,
      side,
    });
    applySurfaceDetails(result, maps, {
      metres: family === 'cast-foundation' ? 0.45 : metres,
      foundation: family === 'cast-foundation',
      ...surfaceFamilyDetails(family),
    });
    return result;
  }, [maps, color, roughness, metalness, vertexColors, flatShading, side, metres, family]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}
