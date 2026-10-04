import { describe, expect, it } from 'vitest';
import { buildOuterLandscape } from './outerLandscapePlacement';
import {
  OUTER_GROUP_LIMIT,
  OUTER_GROUP_SIZE,
  partitionOuterLandscape,
  selectOuterGroups,
  type OuterGroup,
} from './outerLandscapeGroups';

const high = buildOuterLandscape('high');
const catalog = partitionOuterLandscape(high);
const farAway = { x: 1000, z: 1000 };
const positionKey = (piece: { x: number; z: number }) =>
  `${piece.x.toFixed(5)}:${piece.z.toFixed(5)}`;

function fixture(id: string, centerX = 25, centerZ = 25): OuterGroup {
  return { id, col: 0, row: 0, centerX, centerZ, trees: [], rocks: [] };
}

describe('outer landscape spatial groups', () => {
  it('partitions deterministic placements exactly once and keeps a coarse silhouette in every occupied cell', () => {
    expect(OUTER_GROUP_SIZE).toBe(50);
    expect(partitionOuterLandscape(buildOuterLandscape('high'))).toEqual(catalog);
    const allTrees = [...catalog.coarse.trees, ...catalog.groups.flatMap((group) => group.trees)];
    const allRocks = [...catalog.coarse.rocks, ...catalog.groups.flatMap((group) => group.rocks)];
    expect(allTrees.map(positionKey).sort()).toEqual(high.trees.map(positionKey).sort());
    expect(allRocks.map(positionKey).sort()).toEqual(high.rocks.map(positionKey).sort());
    expect(new Set(allTrees.map(positionKey)).size).toBe(allTrees.length);
    expect(new Set(allRocks.map(positionKey)).size).toBe(allRocks.length);
    expect(catalog.coarse.trees.length).toBeGreaterThan(35);
    expect(catalog.coarse.trees.length).toBeLessThan(high.trees.length);
    const sourceCells = new Set(
      [...high.trees, ...high.rocks].map(
        ({ x, z }) => `${Math.floor(x / OUTER_GROUP_SIZE)}:${Math.floor(z / OUTER_GROUP_SIZE)}`,
      ),
    );
    const coarseCells = new Set(
      [...catalog.coarse.trees, ...catalog.coarse.rocks].map(
        ({ x, z }) => `${Math.floor(x / OUTER_GROUP_SIZE)}:${Math.floor(z / OUTER_GROUP_SIZE)}`,
      ),
    );
    expect(coarseCells).toEqual(sourceCells);
    for (const group of catalog.groups) {
      expect(group.id).toBe(`outer-fringe:${group.col}:${group.row}`);
      for (const piece of [...group.trees, ...group.rocks]) {
        expect(Math.floor(piece.x / OUTER_GROUP_SIZE)).toBe(group.col);
        expect(Math.floor(piece.z / OUTER_GROUP_SIZE)).toBe(group.row);
      }
    }
  });

  it('retains coarse cover after detail groups unmount and remounts the same nearby selection', () => {
    const anchors = { focus: { x: -130, z: -32 }, camera: farAway };
    const first = selectOuterGroups(catalog.groups, anchors);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(OUTER_GROUP_LIMIT);
    expect(selectOuterGroups(catalog.groups, anchors).map((group) => group.id)).toEqual(
      first.map((group) => group.id),
    );
    expect(selectOuterGroups(catalog.groups, { focus: farAway, camera: farAway })).toEqual([]);
    expect(catalog.coarse.trees.length).toBeGreaterThan(0);
    const low = partitionOuterLandscape(buildOuterLandscape('low'));
    expect(low.coarse.trees.length).toBeGreaterThan(0);
    expect(selectOuterGroups(low.groups, anchors).length).toBeLessThanOrEqual(OUTER_GROUP_LIMIT);
  });

  it('uses separate enter and exit radii without boundary flicker', () => {
    const group = fixture('edge');
    const atEntry = selectOuterGroups([group], {
      focus: { x: -70, z: 25 },
      camera: farAway,
    });
    expect(atEntry.map((item) => item.id)).toEqual(['edge']);
    const beyondEntry = { focus: { x: -80, z: 25 }, camera: farAway };
    expect(selectOuterGroups([group], beyondEntry)).toEqual([]);
    expect(selectOuterGroups([group], beyondEntry, new Set(['edge']))).toEqual([group]);
    expect(
      selectOuterGroups([group], { focus: { x: -96, z: 25 }, camera: farAway }, new Set(['edge'])),
    ).toEqual([]);
  });

  it('bounds mounted detail layers and gives a qualifying previous group stable priority', () => {
    const groups = Array.from({ length: 18 }, (_, index) => fixture(`g${index}`));
    const anchors = { focus: { x: 25, z: 25 }, camera: farAway };
    const first = selectOuterGroups(groups, anchors);
    expect(first).toHaveLength(OUTER_GROUP_LIMIT);
    expect(first.map((group) => group.id)).toEqual(
      groups.slice(0, OUTER_GROUP_LIMIT).map((g) => g.id),
    );
    const retained = selectOuterGroups(groups, anchors, new Set(['g17']));
    expect(retained).toHaveLength(OUTER_GROUP_LIMIT);
    expect(retained[0].id).toBe('g17');
    expect(selectOuterGroups(groups, { focus: farAway, camera: farAway })).toEqual([]);
  });
});
