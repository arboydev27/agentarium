// Deterministic 2D gradient noise for terrain and surface authoring. Pure
// integer hashing keeps every sample identical across browsers, Node tests,
// and texture bakes; nothing here depends on the renderer or on Math.random.

const GRADIENTS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  return [Math.cos(angle), Math.sin(angle)] as const;
});

function hash(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Perlin-style gradient noise in [-1, 1]. `period` (in lattice cells) makes it tileable. */
export function gradientNoise(x: number, y: number, seed = 0, period = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const wrap = (v: number) => (period > 0 ? ((v % period) + period) % period : v);
  const g = (ix: number, iy: number) => GRADIENTS[hash(wrap(ix), wrap(iy), seed) & 15];
  const dot = (ix: number, iy: number, dx: number, dy: number) => {
    const [gx, gy] = g(ix, iy);
    return gx * dx + gy * dy;
  };
  const u = fade(fx);
  const v = fade(fy);
  const a = dot(x0, y0, fx, fy) + u * (dot(x0 + 1, y0, fx - 1, fy) - dot(x0, y0, fx, fy));
  const b =
    dot(x0, y0 + 1, fx, fy - 1) +
    u * (dot(x0 + 1, y0 + 1, fx - 1, fy - 1) - dot(x0, y0 + 1, fx, fy - 1));
  // Gradient noise peaks near ±0.7; rescale so octaves sum predictably.
  return (a + v * (b - a)) * 1.42;
}

export type FbmOptions = Readonly<{
  octaves?: number;
  lacunarity?: number;
  gain?: number;
  seed?: number;
  period?: number;
}>;

/** Fractal sum of gradient noise, normalized to roughly [-1, 1]. */
export function fbm(x: number, y: number, options: FbmOptions = {}) {
  const { octaves = 4, lacunarity = 2.02, gain = 0.5, seed = 0, period = 0 } = options;
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum +=
      gradientNoise(x * frequency, y * frequency, seed + octave * 31, period * frequency) *
      amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

/** Ridged multifractal in [0, 1]: sharp crests, soft valleys. */
export function ridged(x: number, y: number, options: FbmOptions = {}) {
  const { octaves = 4, lacunarity = 2.1, gain = 0.5, seed = 0, period = 0 } = options;
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    const n =
      1 -
      Math.abs(gradientNoise(x * frequency, y * frequency, seed + octave * 17, period * frequency));
    sum += n * n * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

/** Domain-warped fbm: the input is displaced by a second noise field first. */
export function warpedFbm(x: number, y: number, strength: number, options: FbmOptions = {}) {
  const seed = options.seed ?? 0;
  const wx = fbm(x + 5.2, y + 1.3, { ...options, octaves: 2, seed: seed + 101 });
  const wy = fbm(x + 1.7, y + 9.2, { ...options, octaves: 2, seed: seed + 211 });
  return fbm(x + wx * strength, y + wy * strength, options);
}

/** Worley (cellular) distances in a unit lattice: nearest and second-nearest feature points. */
export function cellular(x: number, y: number, seed = 0, period = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const wrap = (v: number) => (period > 0 ? ((v % period) + period) % period : v);
  let f1 = Infinity;
  let f2 = Infinity;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = x0 + i;
      const cy = y0 + j;
      const h = hash(wrap(cx), wrap(cy), seed);
      const px = cx + ((h & 0xffff) / 0xffff) * 0.9 + 0.05;
      const py = cy + (((h >>> 16) & 0xffff) / 0xffff) * 0.9 + 0.05;
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = h;
      } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, id };
}

/** Uniform [0, 1) from integer coordinates; stable scatter without Math.random. */
export function hashUnit(ix: number, iy: number, seed = 0) {
  return hash(ix, iy, seed) / 4294967296;
}
