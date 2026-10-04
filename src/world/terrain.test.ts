import { describe, expect, it } from 'vitest';
import {
  LANDSCAPE_SEGMENTS,
  LANDSCAPE_SIZE,
  renderedTerrainHeight,
  terrainHeight,
} from './terrain';

describe('expanded finite landscape', () => {
  it('keeps the rendered grid near its prior vertex spacing', () => {
    expect(LANDSCAPE_SIZE).toBe(1200);
    expect(LANDSCAPE_SEGMENTS).toBe(254);
    expect(LANDSCAPE_SIZE / LANDSCAPE_SEGMENTS).toBeGreaterThan(4.68);
    expect(LANDSCAPE_SIZE / LANDSCAPE_SEGMENTS).toBeLessThan(4.75);
  });

  it('samples the actual mesh height at the expanded world boundary', () => {
    const half = LANDSCAPE_SIZE / 2;
    for (const [x, z] of [
      [-half, -half],
      [-half, 0],
      [0, half],
      [half, half],
    ])
      expect(renderedTerrainHeight(x, z)).toBeCloseTo(terrainHeight(x, z));
    expect(renderedTerrainHeight(half + 1, half + 1)).toBeCloseTo(
      renderedTerrainHeight(half, half),
    );
  });
});
