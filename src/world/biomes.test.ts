import { describe, expect, it } from 'vitest';
import { BIOME_INFLUENCE_THRESHOLD, biomeInfluence, landscapeBiomeAt } from './biomes';

describe('landscape biomes', () => {
  it('identifies authored anchors while preserving the home district and existing destinations', () => {
    expect(BIOME_INFLUENCE_THRESHOLD).toBe(0.55);
    expect(landscapeBiomeAt(-80, -20)).toBe('woodland');
    expect(landscapeBiomeAt(0, -90)).toBe('highland');
    expect(landscapeBiomeAt(110, -90)).toBe('highland');
    expect(landscapeBiomeAt(-104, 88)).toBe('amber');
    for (const x of [-25, -12, 0, 12, 25])
      for (const z of [-25, -12, 0, 12, 25]) {
        expect(landscapeBiomeAt(x, z), `home district ${x},${z}`).toBe('meadow');
        expect(Math.max(...Object.values(biomeInfluence(x, z)))).toBeLessThan(0.25);
      }
    for (const [x, z] of [
      [13.5, -38], // Meadow Lookout
      [36, -70], // Orchard Commons
      [-30, -50], // Cedar Observatory
      [-42, 43], // Southwind shore
      [48, 31], // Dawnlight Glasshouse
      [76, -12], // Windward Mill
    ])
      expect(landscapeBiomeAt(x, z), `authored destination ${x},${z}`).toBe('meadow');
  });

  it('returns finite bounded weights and changes continuously across nearby samples', () => {
    for (let x = -170; x <= 120; x += 10)
      for (let z = -130; z <= 140; z += 10) {
        const current = biomeInfluence(x, z);
        const near = biomeInfluence(x + 0.001, z - 0.001);
        for (const key of ['woodland', 'highland', 'amber'] as const) {
          expect(Number.isFinite(current[key])).toBe(true);
          expect(current[key]).toBeGreaterThanOrEqual(0);
          expect(current[key]).toBeLessThanOrEqual(1);
          expect(Math.abs(current[key] - near[key]), `${key} near ${x},${z}`).toBeLessThan(0.002);
        }
        expect(biomeInfluence(x, z)).toEqual(current);
      }
  });

  it('treats nonfinite coordinates as unclassified meadow', () => {
    for (const [x, z] of [
      [NaN, 0],
      [Infinity, 88],
      [-104, -Infinity],
    ]) {
      expect(biomeInfluence(x, z)).toEqual({ woodland: 0, highland: 0, amber: 0 });
      expect(landscapeBiomeAt(x, z)).toBe('meadow');
    }
  });
});
