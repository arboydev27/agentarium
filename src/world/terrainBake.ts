import { cellular, fbm, hashUnit } from './noise';

// Tileable ground layers baked from deterministic noise: no external texture
// licenses, no binary assets, and the same pixels in a worker, on the main
// thread, and in Node tests. Each bake returns RGBA bytes for a colour map,
// a tangent-space normal map, and a roughness map (in the green channel).

export type TerrainLayer = 'sand' | 'gravel' | 'basalt';
export const TERRAIN_LAYERS: readonly TerrainLayer[] = ['sand', 'gravel', 'basalt'];

export type BakedLayer = Readonly<{
  size: number;
  color: Uint8Array;
  normal: Uint8Array;
  roughness: Uint8Array;
}>;

type Sample = { height: number; r: number; g: number; b: number; roughness: number };

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// u, v in [0, 1). Every noise call wraps at an integer period so the tile repeats.
function sand(u: number, v: number): Sample {
  const grain = fbm(u * 96, v * 96, { octaves: 3, seed: 5, period: 96 });
  const drift = fbm(u * 6, v * 6, { octaves: 3, seed: 9, period: 6 });
  // Wind ripples: asymmetric crests (gentle windward, steep slip face).
  const phase = (u * 9 + v * 2 + fbm(u * 3, v * 3, { octaves: 2, seed: 13, period: 3 }) * 0.35) % 1;
  const t = ((phase % 1) + 1) % 1;
  const ripple = t < 0.68 ? t / 0.68 : (1 - t) / 0.32;
  const rippleSoft = ripple * ripple * (3 - 2 * ripple);
  const height = drift * 0.45 + rippleSoft * 0.28 + grain * 0.08;
  const light = 0.5 + rippleSoft * 0.28 + drift * 0.1 + grain * 0.12;
  return {
    height,
    r: mix(0.6, 0.86, light),
    g: mix(0.36, 0.58, light),
    b: mix(0.22, 0.4, light),
    roughness: 0.96 - grain * 0.04,
  };
}

function gravel(u: number, v: number): Sample {
  const grain = fbm(u * 80, v * 80, { octaves: 3, seed: 21, period: 80 });
  const base = fbm(u * 7, v * 7, { octaves: 3, seed: 23, period: 7 });
  const large = cellular(u * 11, v * 11, 29, 11);
  const small = cellular(u * 27, v * 27, 31, 27);
  const largeRadius = 0.22 + hashUnit(large.id, 1, 2) * 0.2;
  const smallRadius = 0.16 + hashUnit(small.id, 2, 3) * 0.12;
  const largeDome = Math.sqrt(Math.max(0, 1 - (large.f1 / largeRadius) ** 2));
  const smallDome = Math.sqrt(Math.max(0, 1 - (small.f1 / smallRadius) ** 2));
  const pebble = Math.max(largeDome * 0.9, smallDome * 0.55);
  const height = base * 0.3 + pebble + grain * 0.1;
  const pebbleTint = largeDome > smallDome ? hashUnit(large.id, 5, 7) : hashUnit(small.id, 6, 8);
  const dust = 0.5 + base * 0.2 + grain * 0.15;
  const r = pebble > 0.05 ? mix(0.5, 0.78, pebbleTint) : mix(0.56, 0.72, dust);
  const g = pebble > 0.05 ? mix(0.3, 0.52, pebbleTint) : mix(0.33, 0.45, dust);
  const b = pebble > 0.05 ? mix(0.24, 0.4, pebbleTint) : mix(0.22, 0.31, dust);
  const shade = 1 - pebble * 0.15;
  return {
    height,
    r: r * shade,
    g: g * shade,
    b: b * shade,
    roughness: pebble > 0.05 ? 0.78 + pebbleTint * 0.1 : 0.95,
  };
}

function basalt(u: number, v: number): Sample {
  const cells = cellular(u * 5, v * 5, 41, 5);
  const fine = cellular(u * 19, v * 19, 43, 19);
  const bumps = fbm(u * 9, v * 9, { octaves: 4, seed: 47, period: 9 });
  const grain = fbm(u * 70, v * 70, { octaves: 2, seed: 53, period: 70 });
  const crack = smoothstep(0.0, 0.09, cells.f2 - cells.f1);
  const fineCrack = smoothstep(0.0, 0.05, fine.f2 - fine.f1);
  const blockTint = hashUnit(cells.id, 3, 4);
  const vesicle = 1 - smoothstep(0.08, 0.16, fine.f1);
  const height =
    crack * (0.55 + blockTint * 0.3) +
    fineCrack * 0.12 +
    bumps * 0.35 -
    vesicle * 0.25 +
    grain * 0.06;
  const light =
    0.42 + blockTint * 0.2 + bumps * 0.12 + grain * 0.08 - (1 - crack) * 0.3 - vesicle * 0.2;
  return {
    height,
    r: mix(0.26, 0.5, clamp01(light)),
    g: mix(0.16, 0.32, clamp01(light)),
    b: mix(0.13, 0.26, clamp01(light)),
    roughness: 0.74 + (1 - crack) * 0.18 + vesicle * 0.08,
  };
}

const LAYERS: Record<TerrainLayer, { sample: (u: number, v: number) => Sample; bump: number }> = {
  sand: { sample: sand, bump: 1.6 },
  gravel: { sample: gravel, bump: 5 },
  basalt: { sample: basalt, bump: 6 },
};

/** Bakes one tileable layer at `size` × `size` texels. Pure and deterministic. */
export function bakeTerrainLayer(layer: TerrainLayer, size: number): BakedLayer {
  const { sample, bump } = LAYERS[layer];
  const count = size * size;
  const heights = new Float32Array(count);
  const color = new Uint8Array(count * 4);
  const normal = new Uint8Array(count * 4);
  const roughness = new Uint8Array(count * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const s = sample(x / size, y / size);
      heights[i] = s.height;
      color[i * 4] = clamp01(s.r) * 255;
      color[i * 4 + 1] = clamp01(s.g) * 255;
      color[i * 4 + 2] = clamp01(s.b) * 255;
      color[i * 4 + 3] = 255;
      const rough = clamp01(s.roughness) * 255;
      roughness[i * 4] = rough;
      roughness[i * 4 + 1] = rough;
      roughness[i * 4 + 2] = rough;
      roughness[i * 4 + 3] = 255;
    }
  }
  // Tangent-space normals from wrapped central differences; +Y follows +v.
  const strength = (bump * size) / 512;
  for (let y = 0; y < size; y++) {
    const up = ((y + 1) % size) * size;
    const down = ((y - 1 + size) % size) * size;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx = heights[y * size + ((x + 1) % size)] - heights[y * size + ((x - 1 + size) % size)];
      const dy = heights[up + x] - heights[down + x];
      let nx = -dx * strength * 0.5;
      let ny = -dy * strength * 0.5;
      const length = Math.hypot(nx, ny, 1);
      nx /= length;
      ny /= length;
      normal[i * 4] = (nx * 0.5 + 0.5) * 255;
      normal[i * 4 + 1] = (ny * 0.5 + 0.5) * 255;
      normal[i * 4 + 2] = (1 / length) * 0.5 * 255 + 127.5;
      normal[i * 4 + 3] = 255;
    }
  }
  return { size, color, normal, roughness };
}
