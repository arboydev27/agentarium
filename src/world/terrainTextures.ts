import { use } from 'react';
import * as THREE from 'three';
import { useWorld } from '../state';
import {
  bakeTerrainLayer,
  TERRAIN_LAYERS,
  type BakedLayer,
  type TerrainLayer,
} from './terrainBake';

export type TerrainMaps = Readonly<{
  color: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
}>;
export type TerrainTextureSet = Readonly<Record<TerrainLayer, TerrainMaps>>;

function toTexture(data: Uint8Array, size: number, colorSpace: THREE.ColorSpace) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = colorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function toMaps(baked: BakedLayer): TerrainMaps {
  return {
    color: toTexture(baked.color, baked.size, THREE.SRGBColorSpace),
    normal: toTexture(baked.normal, baked.size, THREE.NoColorSpace),
    roughness: toTexture(baked.roughness, baked.size, THREE.NoColorSpace),
  };
}

function bakeInWorker(layer: TerrainLayer, size: number) {
  return new Promise<BakedLayer>((resolve, reject) => {
    const worker = new Worker(new URL('./terrainBake.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<BakedLayer & { layer: TerrainLayer }>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(event.error ?? new Error('terrain bake failed'));
    };
    worker.postMessage({ layer, size });
  });
}

// One shared set per size for the whole session: the ground, worn paths, and
// rocks all sample the same layers, and the bake is deterministic.
const sets = new Map<number, Promise<TerrainTextureSet>>();

export function loadTerrainTextures(size: number): Promise<TerrainTextureSet> {
  let pending = sets.get(size);
  if (!pending) {
    const canUseWorker = typeof Worker !== 'undefined';
    pending = Promise.all(
      TERRAIN_LAYERS.map((layer) =>
        (canUseWorker
          ? bakeInWorker(layer, size).catch(() => bakeTerrainLayer(layer, size))
          : Promise.resolve(bakeTerrainLayer(layer, size))
        ).then((baked) => [layer, toMaps(baked)] as const),
      ),
    ).then((entries) => Object.fromEntries(entries) as TerrainTextureSet);
    sets.set(size, pending);
  }
  return pending;
}

export function terrainTextureSize(quality: 'high' | 'low') {
  return quality === 'high' ? 512 : 256;
}

/** Suspends until the shared layer set for the current quality is baked. */
export function useTerrainTextures(): TerrainTextureSet {
  const quality = useWorld((state) => state.quality);
  return use(loadTerrainTextures(terrainTextureSize(quality)));
}
