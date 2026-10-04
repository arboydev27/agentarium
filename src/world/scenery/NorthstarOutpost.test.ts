import { describe, expect, it } from 'vitest';
import {
  NORTHSTAR_OUTPOST,
  NORTHSTAR_TOWER_XZ,
  clearOfNorthstarStructure,
  clearOfNorthstarTrail,
} from './northstarPlacement';
import { NORTHSTAR_BENCH_XZ } from './NorthstarOutpost';

describe('Northstar authored furniture clearance', () => {
  it('keeps the bench footprint outside the resident clearing and signal tower', () => {
    const [x, z] = NORTHSTAR_BENCH_XZ;
    expect(clearOfNorthstarTrail(x, z, 1.2)).toBe(true);
    expect(clearOfNorthstarStructure(x, z, 1.2)).toBe(true);
    expect(
      Math.hypot(
        NORTHSTAR_TOWER_XZ[0] - NORTHSTAR_OUTPOST.x,
        NORTHSTAR_TOWER_XZ[1] - NORTHSTAR_OUTPOST.z,
      ),
    ).toBeGreaterThan(NORTHSTAR_OUTPOST.clearingRadius + 2.4);
  });
});
