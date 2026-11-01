import { TERRAIN_LAYERS, type TerrainLayer } from './terrainBake';

// Where the ground's three splat layers come from. Low quality bakes them from
// noise at start-up (terrainBake.ts), so it needs no download. High quality
// loads scanned CC0 sets as KTX2 once GROUND_SETS names one for every layer.
// A scan is read as variation around its own mean colour and re-based onto the
// baked layer's mean, so the Mars palette holds and the scan contributes grain,
// pebbles and cracks rather than its own hue. This file is pure data.

export type GroundSet = Readonly<{
  /** Asset id at the source; also its directory under assets/textures/ground. */
  id: string;
  name: string;
  /** Asset page, for the licence record. */
  page: string;
  authors: string;
  licence: 'CC0 1.0';
  /** Physical size of one tile in metres (the scan's own, unless tuned). */
  metres: number;
  /** Mean sRGB colour (0..1) of the colour map, from scripts/texture-mean.py. */
  mean: readonly [number, number, number];
  /** Multiplier on the colour's deviation from its mean; 1 keeps the scan's own contrast. */
  contrast: number;
  /** Tangent-space normal strength. */
  normalScale: number;
  /** How much of the scan's ambient occlusion darkens the albedo (0..1). */
  ao: number;
  /** Mean of the ARM map's red channel (0..1), from scripts/texture-mean.py; the occlusion term is normalised by it so the palette holds. */
  aoMean: number;
}>;

/** Mean sRGB colour of each baked layer; scanned layers are re-based onto these. */
export const GROUND_LAYER_BASE: Record<TerrainLayer, readonly [number, number, number]> = {
  sand: [0.764, 0.499, 0.333],
  gravel: [0.612, 0.379, 0.273],
  basalt: [0.371, 0.233, 0.189],
};

/** Tile size in metres and normal strength of the baked layers. */
export const BAKED_LAYER: Record<TerrainLayer, { metres: number; normalScale: number }> = {
  sand: { metres: 2.3, normalScale: 0.7 },
  gravel: { metres: 3.1, normalScale: 1.0 },
  basalt: { metres: 4.6, normalScale: 1.25 },
};

/** Repeat of the close-range detail normal: the sand normal again, within ten metres. */
export const GROUND_DETAIL_METRES = 0.42;

/**
 * Scanned set per layer: what scripts/ground-textures.sh fetches and encodes.
 * Drop a layer's entry and the ground falls back to the bake at every quality.
 * Means are from scripts/texture-mean.py. Tile sizes run a quarter over the
 * scans' own and contrast above 1 because the colony is seen from twenty to
 * sixty metres, where a scan's true pebble scale averages out.
 */
export const GROUND_SETS: Partial<Record<TerrainLayer, GroundSet>> = {
  sand: {
    id: 'sandy_gravel_02',
    name: 'Sandy Gravel 02',
    page: 'https://polyhaven.com/a/sandy_gravel_02',
    authors: 'Dario Barresi',
    licence: 'CC0 1.0',
    metres: 3.2,
    mean: [0.602, 0.451, 0.321],
    contrast: 1.5,
    normalScale: 1.1,
    ao: 0.8,
    aoMean: 0.843,
  },
  gravel: {
    id: 'red_laterite_soil_stones',
    name: 'Red Laterite Soil Stones',
    page: 'https://polyhaven.com/a/red_laterite_soil_stones',
    authors: 'Amal Kumar',
    licence: 'CC0 1.0',
    metres: 2.6,
    mean: [0.396, 0.244, 0.182],
    contrast: 1.5,
    normalScale: 1.4,
    ao: 1,
    aoMean: 0.626,
  },
  basalt: {
    id: 'rock_boulder_dry',
    name: 'Rock Boulder Dry',
    page: 'https://polyhaven.com/a/rock_boulder_dry',
    authors: 'Dimitrios Savva (photography), Rico Cilliers (processing)',
    licence: 'CC0 1.0',
    metres: 2.2,
    mean: [0.658, 0.609, 0.55],
    contrast: 1.3,
    normalScale: 1.3,
    ao: 0.8,
    aoMean: 0.929,
  },
};

export const GROUND_TEXTURE_DIR = '/textures/ground';
/** Colour (sRGB), normal (linear) and ARM (ambient occlusion, roughness, metalness; linear). */
export const GROUND_MAP_SUFFIXES = ['color', 'normal', 'arm'] as const;

export function groundTextureUrls(layer: TerrainLayer) {
  return GROUND_MAP_SUFFIXES.map((suffix) => `${GROUND_TEXTURE_DIR}/${layer}-${suffix}.ktx2`);
}

/** True when every layer has a scanned set, so high quality loads KTX2 instead of baking. */
export function scannedGroundAvailable(): boolean {
  return TERRAIN_LAYERS.every((layer) => GROUND_SETS[layer] !== undefined);
}

/** Bytes of KTX2 the browser may download for every surface and ground map together. */
export const TEXTURE_PAYLOAD_CEILING = 8 * 1024 * 1024;
