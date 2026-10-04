import { describe, expect, it } from 'vitest';
import { renderedTerrainHeight } from '../terrain';
import { NORTHSTAR_TRAIL_XZ } from './northstarPlacement';
import { ridgeHeight } from './FarRidge';

// Mirror the 34-by-2 indexed ridge strip's triangle interpolation, rather
// than checking only its analytic vertex function, to catch mesh intersections.
function ridgeMeshHeight(x: number, z: number) {
  const xIndex = Math.max(0, Math.min(33, Math.floor((x + 102) / 6)));
  const x0 = -102 + xIndex * 6;
  const tx = Math.max(0, Math.min(1, (x - x0) / 6));
  const z0 = z >= -95 ? -84 : -95;
  const z1 = z >= -95 ? -95 : -109;
  const tz = Math.max(0, Math.min(1, (z0 - z) / (z0 - z1)));
  const y00 = ridgeHeight(x0, z0);
  const y10 = ridgeHeight(x0 + 6, z0);
  const y01 = ridgeHeight(x0, z1);
  const y11 = ridgeHeight(x0 + 6, z1);
  return tx + tz <= 1
    ? y00 * (1 - tx - tz) + y10 * tx + y01 * tz
    : y10 * (1 - tz) + y11 * (tx + tz - 1) + y01 * (1 - tx);
}

describe('Northstar scenic ridge saddle', () => {
  it('keeps the rendered ridge strip below the connected route', () => {
    for (const [x, z] of NORTHSTAR_TRAIL_XZ) {
      if (z > -84 || z < -109) continue;
      expect(ridgeMeshHeight(x, z) - renderedTerrainHeight(x, z), `${x},${z}`).toBeLessThan(0.06);
    }
  });

  it('retains the highland shoulders away from the route', () => {
    expect(ridgeHeight(-80, -100) - renderedTerrainHeight(-80, -100)).toBeGreaterThan(6);
    expect(ridgeHeight(70, -100) - renderedTerrainHeight(70, -100)).toBeGreaterThan(5);
  });
});
