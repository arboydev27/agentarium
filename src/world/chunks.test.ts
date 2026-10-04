import { describe, expect, it } from 'vitest';
import {
  DETAIL_CHUNK_LIMIT,
  DETAIL_CHUNK_SIZE,
  DETAIL_WORLD_SIZE,
  detailChunkAt,
  selectDetailChunks,
} from './chunks';
import { LANDSCAPE_SIZE } from './terrain';

describe('finite detail chunks', () => {
  it('maps world edges to deterministic 60-unit IDs and rejects points outside the world', () => {
    expect(DETAIL_CHUNK_SIZE).toBe(60);
    expect(DETAIL_WORLD_SIZE).toBe(LANDSCAPE_SIZE);
    expect(DETAIL_WORLD_SIZE / DETAIL_CHUNK_SIZE).toBe(17);
    expect(detailChunkAt(-510, -510)).toMatchObject({
      id: 'detail-chunk:0:0',
      centerX: -480,
      centerZ: -480,
    });
    expect(detailChunkAt(0, 0)).toMatchObject({ id: 'detail-chunk:8:8' });
    expect(detailChunkAt(510, 510)).toMatchObject({
      id: 'detail-chunk:16:16',
      centerX: 480,
      centerZ: 480,
    });
    for (const [x, z] of [
      [-510.001, 0],
      [510.001, 0],
      [0, -510.001],
      [0, 510.001],
      [NaN, 0],
      [Infinity, 0],
    ])
      expect(detailChunkAt(x, z)).toBeNull();
  });

  it('selects by camera focus, camera position, and resident anchors without leaving bounds', () => {
    const outside = { x: 1000, z: 1000 };
    expect(selectDetailChunks({ focus: outside, camera: outside })).toEqual([]);
    const focus = selectDetailChunks({ focus: { x: 0, z: 0 }, camera: outside });
    const camera = selectDetailChunks({ focus: outside, camera: { x: 180, z: 180 } });
    const resident = selectDetailChunks({
      focus: outside,
      camera: outside,
      residents: [{ x: -200, z: -200 }],
    });
    expect(focus.map((chunk) => chunk.id)).toContain('detail-chunk:8:8');
    expect(camera.map((chunk) => chunk.id)).toContain('detail-chunk:11:11');
    expect(resident.map((chunk) => chunk.id)).toContain('detail-chunk:5:5');
    for (const chunk of [...focus, ...camera, ...resident]) {
      expect(chunk.col).toBeGreaterThanOrEqual(0);
      expect(chunk.col).toBeLessThan(17);
      expect(chunk.row).toBeGreaterThanOrEqual(0);
      expect(chunk.row).toBeLessThan(17);
    }
  });

  it('retains a selected chunk through the exit radius and drops it afterward', () => {
    const camera = { x: -510, z: -510 },
      edge = detailChunkAt(90, 30)!;
    expect(
      selectDetailChunks({ focus: { x: -5, z: 30 }, camera }).map((chunk) => chunk.id),
    ).not.toContain(edge.id);
    expect(
      selectDetailChunks({ focus: { x: -5, z: 30 }, camera }, new Set([edge.id])).map(
        (chunk) => chunk.id,
      ),
    ).toContain(edge.id);
    expect(
      selectDetailChunks({ focus: { x: -26, z: 30 }, camera }, new Set([edge.id])).map(
        (chunk) => chunk.id,
      ),
    ).not.toContain(edge.id);
  });

  it('keeps a previous chunk at a saturated cap until its exit threshold is crossed', () => {
    const focus = { x: 0, z: 0 },
      camera = { x: 210, z: 210 },
      edge = detailChunkAt(280, 280)!;
    const withoutPrevious = selectDetailChunks({ focus, camera });
    expect(withoutPrevious).toHaveLength(DETAIL_CHUNK_LIMIT);
    expect(withoutPrevious.map((chunk) => chunk.id)).not.toContain(edge.id);
    const withPrevious = selectDetailChunks({ focus, camera }, new Set([edge.id]));
    expect(withPrevious).toHaveLength(DETAIL_CHUNK_LIMIT);
    expect(withPrevious.map((chunk) => chunk.id)).toContain(edge.id);
    expect(
      selectDetailChunks({ focus, camera: { x: 210.1, z: 210.1 } }, new Set([edge.id])).map(
        (chunk) => chunk.id,
      ),
    ).toContain(edge.id);
    expect(
      selectDetailChunks({ focus, camera: { x: 199, z: 199 } }, new Set([edge.id])).map(
        (chunk) => chunk.id,
      ),
    ).not.toContain(edge.id);
  });

  it('remains bounded and stable across remounts and resident iteration order', () => {
    const residents = [
      { x: -230, z: -230 },
      { x: 230, z: -230 },
      { x: -230, z: 230 },
      { x: 230, z: 230 },
    ];
    const anchors = { focus: { x: 0, z: 0 }, camera: { x: 240, z: 240 }, residents };
    const first = selectDetailChunks(anchors);
    const remounted = selectDetailChunks({ ...anchors, residents: [...residents].reverse() });
    expect(first.length).toBeLessThanOrEqual(DETAIL_CHUNK_LIMIT);
    expect(new Set(first.map((chunk) => chunk.id)).size).toBe(first.length);
    expect(remounted.map((chunk) => chunk.id)).toEqual(first.map((chunk) => chunk.id));
    expect(
      selectDetailChunks(anchors, new Set(first.map((chunk) => chunk.id))).length,
    ).toBeLessThanOrEqual(DETAIL_CHUNK_LIMIT);
  });
});
