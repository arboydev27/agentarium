import { describe, expect, it } from 'vitest';
import { LANDSCAPE_SIZE } from './terrain';
import { TERRAIN_TILES, type TerrainTile } from './terrainTileGeometry';
import {
  selectTerrainTiles,
  TERRAIN_TILE_SELECTION_POLICY,
  type TerrainSelectionAnchor,
} from './terrainTileSelection';

const ids = (tiles: readonly TerrainTile[]) => tiles.map((tile) => tile.id);
const center = (tile: TerrainTile) => ({
  x: (tile.minX + tile.maxX) / 2,
  z: (tile.minZ + tile.maxZ) / 2,
});
const tileDistance = (tile: TerrainTile, point: TerrainSelectionAnchor) =>
  Math.hypot(
    Math.max(tile.minX - point.x, 0, point.x - tile.maxX),
    Math.max(tile.minZ - point.z, 0, point.z - tile.maxZ),
  );
const assertPartition = (fine: readonly TerrainTile[], requiredCount = 0) => {
  const fineIds = new Set(ids(fine));
  const coarse = TERRAIN_TILES.filter((tile) => !fineIds.has(tile.id));
  const coverIds = [...ids(fine), ...ids(coarse)];
  expect(fine.length).toBe(fineIds.size);
  expect(coverIds.length).toBe(TERRAIN_TILES.length);
  expect(new Set(coverIds)).toEqual(new Set(ids(TERRAIN_TILES)));
  expect(fine.length).toBeLessThanOrEqual(
    Math.max(TERRAIN_TILE_SELECTION_POLICY.maxFineTiles, requiredCount),
  );
};

describe('camera-aware fine terrain selection', () => {
  it('uses tile bounds and distinct entry/exit radii to prevent boundary churn', () => {
    const tile = TERRAIN_TILES.find((candidate) => candidate.col === 7 && candidate.row === 7)!;
    const z = center(tile).z;
    for (const [anchor, entry, exit] of [
      ['focus', 90, 115],
      ['camera', 165, 185],
      ['prefetch', 90, 115],
    ] as const) {
      const entered = selectTerrainTiles({ [anchor]: { x: tile.maxX + entry - 1, z } });
      expect(ids(entered)).toContain(tile.id);
      const outsideEntry = { [anchor]: { x: tile.maxX + entry + 1, z } };
      expect(ids(selectTerrainTiles(outsideEntry))).not.toContain(tile.id);
      expect(ids(selectTerrainTiles(outsideEntry, ids(entered)))).toContain(tile.id);
      expect(
        ids(selectTerrainTiles({ [anchor]: { x: tile.maxX + exit + 1, z } }, ids(entered))),
      ).not.toContain(tile.id);
    }
  });

  it('keeps near detail and complete coarse/fine coverage while traversing the world', () => {
    let previous: string[] = [];
    const half = LANDSCAPE_SIZE / 2;
    for (let x = -half; x <= half; x += 12) {
      const focus = { x, z: Math.sin(x / 100) * 180 };
      const camera = { x: x + 35, z: focus.z + 20 };
      const fine = selectTerrainTiles({ focus, camera }, previous);
      assertPartition(fine);
      for (const tile of TERRAIN_TILES)
        if (tileDistance(tile, focus) < 45 || tileDistance(tile, camera) < 35)
          expect(ids(fine)).toContain(tile.id);
      previous = ids(fine);
    }
    expect(previous.some((id) => id.startsWith('terrain:0:'))).toBe(false);
  });

  it('replaces obsolete detail after a large camera jump without retaining remote tiles', () => {
    const start = center(TERRAIN_TILES[17]);
    const destination = center(TERRAIN_TILES[TERRAIN_TILES.length - 18]);
    const initial = selectTerrainTiles({ camera: start });
    const jumped = selectTerrainTiles({ camera: destination }, ids(initial));
    expect(ids(jumped)).toEqual(ids(selectTerrainTiles({ camera: destination })));
    expect(ids(jumped).some((id) => ids(initial).includes(id))).toBe(false);
    expect(jumped.some((tile) => tileDistance(tile, destination) === 0)).toBe(true);
    assertPartition(jumped);
  });

  it('prefetches a distant preset within the shared cap and promotes it on arrival', () => {
    const focus = center(TERRAIN_TILES[34]);
    const camera = center(TERRAIN_TILES[119]);
    const prefetch = center(TERRAIN_TILES[221]);
    const initial = selectTerrainTiles({ focus, camera });
    const prepared = selectTerrainTiles({ focus, camera, prefetch }, ids(initial));
    expect(prepared.length).toBeGreaterThan(initial.length);
    for (const point of [focus, camera, prefetch])
      expect(prepared.some((tile) => tileDistance(tile, point) === 0)).toBe(true);
    const arrived = selectTerrainTiles({ focus, camera: prefetch }, ids(prepared));
    for (const tile of prepared)
      if (tileDistance(tile, prefetch) === 0) expect(ids(arrived)).toContain(tile.id);
    assertPartition(prepared);
    assertPartition(arrived);
  });

  it('ignores invalid anchors and unknown previous IDs', () => {
    const camera = { x: 0, z: 0 };
    const clean = selectTerrainTiles({ camera });
    expect(
      ids(
        selectTerrainTiles({ focus: { x: NaN, z: 0 }, camera, prefetch: { x: 0, z: Infinity } }, [
          'unknown',
          'unknown',
        ]),
      ),
    ).toEqual(ids(clean));
    const empty = selectTerrainTiles(
      { focus: null, camera: { x: Infinity, z: 0 }, prefetch: { x: 0, z: NaN } },
      ids(clean),
    );
    expect(empty).toEqual([]);
    assertPartition(empty);
    expect(selectTerrainTiles({ camera: { x: 1e20, z: -1e20 } })).toEqual([]);
  });

  it('is deterministic, immutable and returns canonical tiles in row-major order', () => {
    const anchors = Object.freeze({
      focus: Object.freeze({ x: -190, z: -140 }),
      camera: Object.freeze({ x: 160, z: 60 }),
      prefetch: Object.freeze({ x: 410, z: 360 }),
    });
    const previous = Object.freeze(ids(selectTerrainTiles(anchors)));
    const fine = selectTerrainTiles(anchors, previous);
    expect(ids(fine)).toEqual(ids(selectTerrainTiles(anchors, [...previous].reverse())));
    expect(ids(fine)).toEqual(ids(selectTerrainTiles(anchors, [...previous, ...previous])));
    expect(fine).toEqual(TERRAIN_TILES.filter((tile) => ids(fine).includes(tile.id)));
    expect(fine.every((tile) => TERRAIN_TILES.includes(tile))).toBe(true);
    assertPartition(fine);
  });

  it('keeps every fog-visible camera tile fine during travel and remote prefetch', () => {
    let previous: string[] = ids(TERRAIN_TILES);
    for (let x = -LANDSCAPE_SIZE / 2; x <= LANDSCAPE_SIZE / 2; x += 17) {
      const camera = { x, z: Math.sin(x / 100) * 350 };
      const fine = selectTerrainTiles(
        { focus: { x: -380, z: -300 }, camera, prefetch: { x: 450, z: 380 } },
        previous,
      );
      for (const tile of TERRAIN_TILES)
        if (tileDistance(tile, camera) <= TERRAIN_TILE_SELECTION_POLICY.cameraEntryRadius)
          expect(ids(fine)).toContain(tile.id);
      assertPartition(fine);
      previous = ids(fine);
    }
  });

  it('gives explicit visible tiles priority over optional camera and prefetch detail', () => {
    const visibleIds = ids(TERRAIN_TILES.slice(0, 60));
    const fine = selectTerrainTiles({
      visibleIds: [...visibleIds, 'unknown', visibleIds[0]],
      camera: { x: 430, z: 430 },
      prefetch: { x: -430, z: 430 },
    });
    expect(fine).toHaveLength(TERRAIN_TILE_SELECTION_POLICY.maxFineTiles);
    for (const id of visibleIds) expect(ids(fine)).toContain(id);
    assertPartition(fine);
  });

  it('preserves all required visibility beyond the cap with deterministic finite overflow', () => {
    const visible = TERRAIN_TILES.filter((_, index) => index % 3 === 0);
    const visibleIds = ids(visible);
    const anchors = { visibleIds, camera: { x: 0, z: 0 }, prefetch: { x: 450, z: 450 } };
    const fine = selectTerrainTiles(anchors, ids(TERRAIN_TILES));
    expect(fine).toEqual(visible);
    expect(selectTerrainTiles({ visibleIds: [...visibleIds].reverse() })).toEqual(visible);
    expect(
      selectTerrainTiles({ visibleIds: [...visibleIds, ...visibleIds, 'unknown'], focus: null }),
    ).toEqual(visible);
    expect(selectTerrainTiles({ visibleIds: ['unknown'], camera: { x: NaN, z: 0 } })).toEqual([]);
    const all = selectTerrainTiles({ visibleIds: ids(TERRAIN_TILES) });
    expect(all).toEqual(TERRAIN_TILES);
    assertPartition(fine, visibleIds.length);
    assertPartition(all, TERRAIN_TILES.length);
  });

  it('bounds an oversized prior working set and preserves it across tiny movements', () => {
    const anchors = {
      focus: { x: -447, z: -447 },
      camera: { x: -145, z: -145 },
      prefetch: { x: 459, z: -145 },
    };
    const capped = selectTerrainTiles(anchors, ids(TERRAIN_TILES));
    expect(capped).toHaveLength(TERRAIN_TILE_SELECTION_POLICY.maxFineTiles);
    const moved = selectTerrainTiles(
      { ...anchors, camera: { x: anchors.camera.x + 0.001, z: anchors.camera.z } },
      ids(capped),
    );
    expect(ids(moved)).toEqual(ids(capped));
    assertPartition(moved);
  });
});
