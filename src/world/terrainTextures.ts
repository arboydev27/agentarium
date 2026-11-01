import { use, useEffect, useMemo } from 'react';
import { useKTX2 } from '@react-three/drei';
import * as THREE from 'three';
import { useWorld } from '../state';
import {
  BAKED_LAYER,
  GROUND_LAYER_BASE,
  GROUND_SETS,
  groundTextureUrls,
  scannedGroundAvailable,
} from './groundSets';
import { BASIS_TRANSCODER_PATH } from './surfaceTextures';
import {
  bakeTerrainLayer,
  TERRAIN_LAYERS,
  type BakedLayer,
  type TerrainLayer,
} from './terrainBake';

export type TerrainMaps = Readonly<{
  color: THREE.Texture;
  normal: THREE.Texture;
  /** Roughness in the green channel; scanned sets carry ambient occlusion in red. */
  roughness: THREE.Texture;
  /** Tile size in world metres. */
  metres: number;
  normalScale: number;
  /** Multiplier on the colour's deviation from `base`; 1 for baked layers. */
  contrast: number;
  /** Ambient-occlusion strength taken from the roughness map's red channel; 0 for baked layers. */
  ao: number;
  /** Mean of that red channel, which the occlusion term is normalised by; 1 for baked layers. */
  aoMean: number;
  /** The layer's authored colour, linear: what every consumer treats as its mean. */
  base: THREE.Color;
  /** Mean colour of the colour map itself, linear: the scan's own, or the bake's, which is `base`. */
  mean: THREE.Color;
}>;
export type TerrainTextureSet = Readonly<Record<TerrainLayer, TerrainMaps>>;

const authoredBase = (layer: TerrainLayer) =>
  new THREE.Color().setRGB(...GROUND_LAYER_BASE[layer], THREE.SRGBColorSpace);

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

function bakedMaps(layer: TerrainLayer, baked: BakedLayer): TerrainMaps {
  return {
    color: toTexture(baked.color, baked.size, THREE.SRGBColorSpace),
    normal: toTexture(baked.normal, baked.size, THREE.NoColorSpace),
    roughness: toTexture(baked.roughness, baked.size, THREE.NoColorSpace),
    metres: BAKED_LAYER[layer].metres,
    normalScale: BAKED_LAYER[layer].normalScale,
    contrast: 1,
    ao: 0,
    aoMean: 1,
    base: authoredBase(layer),
    mean: authoredBase(layer),
  };
}

// The loader cache owns the compressed originals; each consumer owns its
// repeat and sampling settings on clones that share the GPU upload.
function scannedMaps(layer: TerrainLayer, sources: readonly THREE.Texture[]): TerrainMaps {
  const set = GROUND_SETS[layer]!;
  const [color, normal, roughness] = sources.map((source) => {
    const map = source.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    map.needsUpdate = true;
    return map;
  });
  return {
    color,
    normal,
    roughness,
    metres: set.metres,
    normalScale: set.normalScale,
    contrast: set.contrast,
    ao: set.ao,
    aoMean: set.aoMean,
    base: authoredBase(layer),
    mean: new THREE.Color().setRGB(...set.mean, THREE.SRGBColorSpace),
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

// One shared baked set per size for the whole session: the ground, worn paths,
// and rocks all sample the same layers, and the bake is deterministic.
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
        ).then((baked) => [layer, bakedMaps(layer, baked)] as const),
      ),
    ).then((entries) => Object.fromEntries(entries) as TerrainTextureSet);
    sets.set(size, pending);
  }
  return pending;
}

export function terrainTextureSize(quality: 'high' | 'low') {
  return quality === 'high' ? 512 : 256;
}

const NO_URLS: string[] = [];
/** The nine scanned maps in layer order, three per layer. */
export const GROUND_TEXTURE_URLS = TERRAIN_LAYERS.flatMap(groundTextureUrls);

/**
 * Suspends until the layer set for the current quality is ready: the scanned
 * KTX2 sets at high quality when every layer has one, otherwise the shared
 * bake, which keeps low quality free of texture downloads.
 */
export function useTerrainTextures(): TerrainTextureSet {
  const quality = useWorld((state) => state.quality);
  const scanned = quality === 'high' && scannedGroundAvailable();
  const compressed = useKTX2(scanned ? GROUND_TEXTURE_URLS : NO_URLS, BASIS_TRANSCODER_PATH);
  const baked = scanned ? null : use(loadTerrainTextures(terrainTextureSize(quality)));
  const set = useMemo<TerrainTextureSet>(
    () =>
      baked ??
      (Object.fromEntries(
        TERRAIN_LAYERS.map((layer, index) => [
          layer,
          scannedMaps(layer, compressed.slice(index * 3, index * 3 + 3)),
        ]),
      ) as TerrainTextureSet),
    [baked, compressed],
  );
  useEffect(() => {
    if (baked) return;
    return () => {
      for (const layer of TERRAIN_LAYERS) {
        set[layer].color.dispose();
        set[layer].normal.dispose();
        set[layer].roughness.dispose();
      }
    };
  }, [set, baked]);
  return set;
}
