import { describe, expect, it } from 'vitest';
import { bakeTerrainLayer, TERRAIN_LAYERS } from './terrainBake';
import { createRockVariants } from './rocks';
import { cellular, fbm, gradientNoise } from './noise';

describe('deterministic noise', () => {
  it('stays bounded, repeats exactly, and tiles at its period', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 4000; i++) {
      const value = gradientNoise(i * 0.137, i * 0.071, 3);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    expect(min).toBeGreaterThan(-1.05);
    expect(max).toBeLessThan(1.05);
    expect(max - min).toBeGreaterThan(1);
    expect(fbm(12.3, -4.5, { seed: 9 })).toBe(fbm(12.3, -4.5, { seed: 9 }));
    expect(fbm(12.3, -4.5, { seed: 9 })).not.toBe(fbm(12.3, -4.5, { seed: 10 }));
    for (const [x, y] of [
      [0.37, 2.1],
      [5.9, 1.25],
    ]) {
      expect(gradientNoise(x, y, 1, 8)).toBeCloseTo(gradientNoise(x + 8, y - 16, 1, 8), 10);
      expect(cellular(x, y, 2, 8).f1).toBeCloseTo(cellular(x + 8, y + 8, 2, 8).f1, 10);
    }
  });
});

describe('baked ground layers', () => {
  it('produces warm, non-blank, seamlessly wrapping maps for every layer', () => {
    for (const layer of TERRAIN_LAYERS) {
      const size = 64;
      const baked = bakeTerrainLayer(layer, size);
      expect(baked.size).toBe(size);
      expect(baked.color).toHaveLength(size * size * 4);
      let sum = 0;
      let minLuma = 255;
      let maxLuma = 0;
      for (let i = 0; i < size * size; i++) {
        const r = baked.color[i * 4];
        const g = baked.color[i * 4 + 1];
        const b = baked.color[i * 4 + 2];
        expect(r, `${layer} red dominates`).toBeGreaterThanOrEqual(g);
        expect(g, `${layer} green over blue`).toBeGreaterThanOrEqual(b);
        expect(baked.color[i * 4 + 3]).toBe(255);
        const luma = 0.3 * r + 0.59 * g + 0.11 * b;
        sum += luma;
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
      }
      const mean = sum / (size * size);
      expect(mean, `${layer} mean`).toBeGreaterThan(25);
      expect(mean, `${layer} mean`).toBeLessThan(190);
      expect(maxLuma - minLuma, `${layer} contrast`).toBeGreaterThan(20);
      // Wrapped neighbours across the tile edge differ no more than interior neighbours.
      const step = (a: number, b: number) =>
        Math.abs(baked.color[a * 4] - baked.color[b * 4]) +
        Math.abs(baked.normal[a * 4] - baked.normal[b * 4]);
      let edge = 0;
      let interior = 0;
      for (let k = 0; k < size; k++) {
        edge += step(k * size, k * size + size - 1) + step(k, (size - 1) * size + k);
        interior += step(k * size + 20, k * size + 21) + step(20 * size + k, 21 * size + k);
      }
      expect(edge, `${layer} seam`).toBeLessThan(interior * 1.6 + size);
      let normalSum = 0;
      for (let i = 0; i < size * size; i++) normalSum += baked.normal[i * 4 + 2];
      expect(normalSum / (size * size), `${layer} normals face up`).toBeGreaterThan(180);
    }
  });
});

describe('procedural rocks', () => {
  it('builds distinct, grounded variants', () => {
    const variants = createRockVariants(1);
    expect(variants).toHaveLength(4);
    const signatures = variants.map((geometry) => {
      const position = geometry.getAttribute('position');
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < position.count; i++) {
        minY = Math.min(minY, position.getY(i));
        maxY = Math.max(maxY, position.getY(i));
      }
      expect(minY).toBeGreaterThan(-0.6);
      expect(minY).toBeLessThan(-0.2);
      expect(maxY).toBeGreaterThan(0.45);
      expect(geometry.boundingSphere!.radius).toBeLessThan(2);
      return position.getX(5).toFixed(4);
    });
    expect(new Set(signatures).size).toBe(4);
    variants.forEach((geometry) => geometry.dispose());
  });
});
