import { useEffect, useMemo } from 'react';
import { useKTX2 } from '@react-three/drei';
import * as THREE from 'three';
import { useWorld } from '../state';

export type SurfaceFamily =
  'ceramic-paint' | 'dusty-alloy' | 'cast-foundation' | 'ironstone' | 'regolith';

/** Self-hosted Basis transcoder, copied from three's examples into public/basis. */
export const BASIS_TRANSCODER_PATH = '/basis/';

/** The three GPU-compressed KTX2 maps of a surface family: colour, normal, roughness. */
export function surfaceTextureUrls(family: SurfaceFamily) {
  return [
    `/textures/habitat/${family}-color.ktx2`,
    `/textures/habitat/${family}-normal.ktx2`,
    `/textures/habitat/${family}-roughness.ktx2`,
  ];
}

// The loader cache owns originals; each consumer owns repeat/sampling settings.
// Colour space comes from the KTX2 file (sRGB colour, linear normal and roughness).
export function useSurfaceTextures(family: SurfaceFamily) {
  const quality = useWorld((state) => state.quality);
  const originals = useKTX2(surfaceTextureUrls(family), BASIS_TRANSCODER_PATH);
  const maps = useMemo(
    () =>
      originals.map((source) => {
        const map = source.clone();
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = quality === 'high' ? 8 : 2;
        map.needsUpdate = true;
        return map;
      }),
    [originals, quality],
  );
  useEffect(() => () => maps.forEach((map) => map.dispose()), [maps]);
  return maps;
}
