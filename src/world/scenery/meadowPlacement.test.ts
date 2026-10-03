import { describe, expect, it } from 'vitest';
import { detailChunkAt } from '../chunks';
import { LOOKOUT, OBSERVATORY, ORCHARD } from '../layout';
import { meadowTrailPoint } from '../terrain';
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

  it('keeps the resident routes, landmarks, and grove floor free of generated props', () => {
    for (const [x, z] of [
      [0, 0],
      [LOOKOUT.x, LOOKOUT.z],
      [ORCHARD.x, ORCHARD.z],
      [OBSERVATORY.x, OBSERVATORY.z],
      [18.5, -44],
    ]) {
      expect(clearOfMeadowRoutes(x, z)).toBe(false);
    }
    for (let index = 0; index <= 34; index++) {
      const [x, , z] = meadowTrailPoint(index);
      expect(clearOfMeadowRoutes(x, z)).toBe(false);
    }
  });
});
