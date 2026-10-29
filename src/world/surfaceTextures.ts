import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useWorld } from '../state';

export type SurfaceFamily =
  'ceramic-paint' | 'dusty-alloy' | 'cast-foundation' | 'ironstone' | 'regolith';

// The loader cache owns originals; each consumer owns repeat/sampling settings.
export function useSurfaceTextures(family: SurfaceFamily) {
  const quality = useWorld((state) => state.quality);
  const originals = useTexture([
    `/textures/habitat/${family}-color.png`,
    `/textures/habitat/${family}-normal.png`,
    `/textures/habitat/${family}-roughness.png`,
  ]);
  const maps = useMemo(
    () =>
      originals.map((source, i) => {
        const map = source.clone();
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        map.anisotropy = quality === 'high' ? 8 : 2;
        map.needsUpdate = true;
        return map;
      }),
    [originals, quality],
  );
  useEffect(() => () => maps.forEach((map) => map.dispose()), [maps]);
  return maps;
}
