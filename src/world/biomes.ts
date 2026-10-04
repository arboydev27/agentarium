export type LandscapeBiome = 'meadow' | 'woodland' | 'highland' | 'amber';
export type BiomeInfluence = Readonly<{
  woodland: number;
  highland: number;
  amber: number;
}>;

export const BIOME_INFLUENCE_THRESHOLD = 0.55;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(start: number, end: number, value: number) {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

function ellipticalInfluence(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  core: number,
) {
  const distance = Math.hypot((x - centerX) / radiusX, (z - centerZ) / radiusZ);
  return 1 - smoothstep(core, 1.2, distance);
}

// Broad, authored terrain signals only. These weights do not move residents or
// change navigation, and contain no random sampling or renderer dependencies.
export function biomeInfluence(x: number, z: number): BiomeInfluence {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { woodland: 0, highland: 0, amber: 0 };
  return {
    woodland: ellipticalInfluence(x, z, -83, -20, 56, 72, 0.35),
    highland: smoothstep(58, 85, -z),
    amber: ellipticalInfluence(x, z, -104, 88, 70, 55, 0.3),
  };
}

export function landscapeBiomeAt(x: number, z: number): LandscapeBiome {
  const influence = biomeInfluence(x, z);
  const strongest = Math.max(influence.woodland, influence.highland, influence.amber);
  if (strongest < BIOME_INFLUENCE_THRESHOLD) return 'meadow';
  // Explicit tie order keeps boundaries stable when two broad signals meet.
  if (influence.highland === strongest) return 'highland';
  if (influence.amber === strongest) return 'amber';
  return 'woodland';
}
