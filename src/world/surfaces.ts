import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Small, deterministic original textures; no remote asset dependency.
export function useSurfaceTextures() {
  const textures = useMemo(() => {
    let seed = 17;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const make = (kind: 'wood' | 'plaster' | 'stone') => {
      const grain = kind === 'wood';
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = kind === 'stone' ? '#e8e7e1' : '#f4f1ea';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < (grain ? 160 : 2400); i++) {
        ctx.fillStyle = `rgba(80,65,45,${random() * (grain ? 0.09 : 0.06)})`;
        ctx.fillRect(
          random() * 128,
          random() * 128,
          grain ? 16 + random() * 96 : kind === 'stone' ? 2 : 1,
          kind === 'stone' ? 2 : 1,
        );
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(grain ? 3 : 4, 4);
      return texture;
    };
    return { wood: make('wood'), plaster: make('plaster'), stone: make('stone') };
  }, []);
  useEffect(
    () => () => Object.values(textures).forEach((texture) => texture.dispose()),
    [textures],
  );
  return textures;
}
