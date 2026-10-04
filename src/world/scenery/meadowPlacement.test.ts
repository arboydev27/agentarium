import { describe, expect, it } from 'vitest';
import { detailChunkAt } from '../chunks';
import { LOOKOUT, OBSERVATORY, ORCHARD } from '../layout';
import { meadowTrailPoint } from '../terrain';
import { WINDWARD_MILL, WINDWARD_BRANCH_XZ } from './windwardPlacement';
import { AMBER_BLUFF } from './amberPlacement';
import { WOODLAND_HOLLOW, WOODLAND_TRAIL_XZ, WOODLAND_SHELTER_XZ } from './woodlandPlacement';
import { NORTHSTAR_OUTPOST, NORTHSTAR_TOWER_XZ, NORTHSTAR_TRAIL_XZ } from './northstarPlacement';
import { buildMeadowPieces, clearOfMeadowRoutes, meadowChunkHasDetail } from './meadowPlacement';

describe('spatial meadow placement', () => {
  it('generates repeatable detail throughout the reachable landscape and nowhere beyond it', () => {
    const chunks = [detailChunkAt(-80, 65)!, detailChunkAt(80, 65)!, detailChunkAt(70, -70)!];
    for (const chunk of chunks) {
      expect(meadowChunkHasDetail(chunk)).toBe(true);
      const first = buildMeadowPieces(chunk, 'high');
      expect(first).toEqual(buildMeadowPieces(chunk, 'high'));
      expect(first.patches.length).toBeGreaterThan(0);
      for (const piece of [...first.patches, ...first.rocks]) {
        expect(detailChunkAt(piece.x, piece.z)?.id).toBe(chunk.id);
        expect(clearOfMeadowRoutes(piece.x, piece.z, piece.size * 0.6)).toBe(true);
      }
      const low = buildMeadowPieces(chunk, 'low');
      expect(low.patches).toEqual(first.patches.slice(0, low.patches.length));
      expect(low.flowers).toHaveLength(0);
    }
    const far = detailChunkAt(270, 270)!;
    expect(meadowChunkHasDetail(far)).toBe(false);
    expect(buildMeadowPieces(far, 'high')).toEqual({ patches: [], flowers: [], rocks: [] });
  });

  it('changes groundcover character without changing deterministic quality prefixes', () => {
    const meadow = buildMeadowPieces(detailChunkAt(85, 60)!, 'high');
    const woodland = buildMeadowPieces(detailChunkAt(-83, -20)!, 'high');
    const highland = buildMeadowPieces(detailChunkAt(-120, -120)!, 'high');
    const amber = buildMeadowPieces(detailChunkAt(-104, 88)!, 'high');
    expect(woodland.patches.length).toBeGreaterThan(meadow.patches.length);
    expect(highland.patches.length).toBeLessThan(meadow.patches.length);
    expect(highland.rocks.length).toBeGreaterThan(meadow.rocks.length);
    expect(highland.flowers).toHaveLength(0);
    expect(amber.flowers.length).toBeGreaterThan(meadow.flowers.length);
    for (const [x, z] of [
      [-83, -20],
      [-120, -120],
      [-104, 88],
    ] as const) {
      const chunk = detailChunkAt(x, z)!;
      const high = buildMeadowPieces(chunk, 'high');
      const low = buildMeadowPieces(chunk, 'low');
      expect(low.patches).toEqual(high.patches.slice(0, low.patches.length));
      expect(high.patches.length).toBeLessThanOrEqual(64);
      expect(high.rocks.length).toBeLessThanOrEqual(20);
    }
  });

  it('keeps the resident routes, landmarks, and grove floor free of generated props', () => {
    for (const [x, z] of [
      [0, 0],
      [LOOKOUT.x, LOOKOUT.z],
      [ORCHARD.x, ORCHARD.z],
      [OBSERVATORY.x, OBSERVATORY.z],
      [18.5, -44],
      [-20, -79],
      [WINDWARD_MILL.centerX, WINDWARD_MILL.centerZ],
      ...WINDWARD_BRANCH_XZ,
      [AMBER_BLUFF.x, AMBER_BLUFF.z],
      [WOODLAND_HOLLOW.x, WOODLAND_HOLLOW.z],
      WOODLAND_SHELTER_XZ,
      ...WOODLAND_TRAIL_XZ,
      [NORTHSTAR_OUTPOST.x, NORTHSTAR_OUTPOST.z],
      NORTHSTAR_TOWER_XZ,
      ...NORTHSTAR_TRAIL_XZ,
    ]) {
      expect(clearOfMeadowRoutes(x, z)).toBe(false);
    }
    for (let index = 0; index <= 34; index++) {
      const [x, , z] = meadowTrailPoint(index);
      expect(clearOfMeadowRoutes(x, z)).toBe(false);
    }
  });
});
