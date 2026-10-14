import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  LANDSCAPE_SEGMENTS,
  LANDSCAPE_SIZE,
  renderedTerrainHeight,
  terrainHeight,
} from './terrain';
import { landscapeVertexColor } from './terrainPalette';
import {
  buildCoarseTerrainTile,
  buildFineTerrainTile,
  mergeCoarseTerrainTiles,
  mergeFineTerrainTiles,
  TERRAIN_TILES,
  type TerrainTile,
} from './terrainTileGeometry';

function referenceSurface() {
  const geometry = new THREE.PlaneGeometry(
    LANDSCAPE_SIZE,
    LANDSCAPE_SIZE,
    LANDSCAPE_SEGMENTS,
    LANDSCAPE_SEGMENTS,
  );
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const scratch = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = terrainHeight(x, z);
    position.setY(i, y);
    landscapeVertexColor(x, z, y, scratch).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function vertexKey(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) {
  return `${position.getX(i)}:${position.getZ(i)}`;
}

function boundary(geometry: THREE.BufferGeometry, tile: TerrainTile) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const color = geometry.getAttribute('color');
  const result = new Map<string, number[]>();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    if (x === tile.minX || x === tile.maxX || z === tile.minZ || z === tile.maxZ)
      result.set(vertexKey(position, i), [
        x,
        position.getY(i),
        z,
        normal.getX(i),
        normal.getY(i),
        normal.getZ(i),
        color.getX(i),
        color.getY(i),
        color.getZ(i),
      ]);
  }
  return result;
}

describe('terrain tile geometry', () => {
  it('partitions every authoritative grid cell once with stable bounds and ids', () => {
    expect(TERRAIN_TILES).toHaveLength(256);
    const coverage = new Uint8Array(LANDSCAPE_SEGMENTS ** 2);
    for (const tile of TERRAIN_TILES) {
      expect(tile.id).toBe(`terrain:${tile.col}:${tile.row}`);
      expect(tile.startColumn).toBe(tile.col * 16);
      expect(tile.startRow).toBe(tile.row * 16);
      expect(tile.endColumn - tile.startColumn).toBe(tile.col === 15 ? 14 : 16);
      expect(tile.endRow - tile.startRow).toBe(tile.row === 15 ? 14 : 16);
      for (let row = tile.startRow; row < tile.endRow; row++)
        for (let col = tile.startColumn; col < tile.endColumn; col++)
          coverage[row * LANDSCAPE_SEGMENTS + col]++;
    }
    expect(coverage.every((count) => count === 1)).toBe(true);
    expect(TERRAIN_TILES[0].minX).toBe(-600);
    expect(TERRAIN_TILES[0].minZ).toBe(-600);
    expect(TERRAIN_TILES.at(-1)?.maxX).toBe(600);
    expect(TERRAIN_TILES.at(-1)?.maxZ).toBe(600);
  });

  it('exactly preserves all legacy fine vertices, colors, normals and triangle indices', () => {
    const reference = referenceSurface();
    let triangles = 0;
    try {
      for (const tile of TERRAIN_TILES) {
        const fine = buildFineTerrainTile(tile);
        try {
          const width = tile.endColumn - tile.startColumn + 1;
          const height = tile.endRow - tile.startRow + 1;
          const global = Array.from(
            { length: width * height },
            (_, local) =>
              (tile.startRow + Math.floor(local / width)) * (LANDSCAPE_SEGMENTS + 1) +
              tile.startColumn +
              (local % width),
          );
          for (const name of ['position', 'normal', 'color']) {
            const actual = fine.getAttribute(name);
            const expected = reference.getAttribute(name);
            const equal = global.every(
              (vertex, local) =>
                actual.getX(local) === expected.getX(vertex) &&
                actual.getY(local) === expected.getY(vertex) &&
                actual.getZ(local) === expected.getZ(vertex),
            );
            expect(equal, `${tile.id} ${name}`).toBe(true);
          }
          const actual = Array.from(fine.getIndex()!.array, (local) => global[local]);
          const expected: number[] = [];
          for (let row = tile.startRow; row < tile.endRow; row++)
            for (let col = tile.startColumn; col < tile.endColumn; col++) {
              const offset = (row * LANDSCAPE_SEGMENTS + col) * 6;
              for (let index = 0; index < 6; index++)
                expected.push(reference.getIndex()!.getX(offset + index));
            }
          expect(actual).toEqual(expected);
          expect(fine.boundingBox!.min.x).toBe(tile.minX);
          expect(fine.boundingBox!.max.x).toBe(tile.maxX);
          expect(fine.boundingBox!.min.z).toBe(tile.minZ);
          expect(fine.boundingBox!.max.z).toBe(tile.maxZ);
          triangles += actual.length / 3;
        } finally {
          fine.dispose();
        }
      }
      expect(triangles).toBe(LANDSCAPE_SEGMENTS ** 2 * 2);
    } finally {
      reference.dispose();
    }
  });

  it('keeps fine triangle heights on the authoritative rendered surface', () => {
    for (const [column, row] of [
      [127, 127],
      [126, 123],
      [80, 40],
      [253, 253],
    ]) {
      const tile = TERRAIN_TILES[Math.floor(row / 16) * 16 + Math.floor(column / 16)];
      const fine = buildFineTerrainTile(tile);
      try {
        const width = tile.endColumn - tile.startColumn + 1;
        const cell = ((row - tile.startRow) * (width - 1) + column - tile.startColumn) * 6;
        for (const offset of [0, 3]) {
          const point = new THREE.Vector3();
          for (let vertex = 0; vertex < 3; vertex++)
            point.add(
              new THREE.Vector3().fromBufferAttribute(
                fine.getAttribute('position'),
                fine.getIndex()!.getX(cell + offset + vertex),
              ),
            );
          point.divideScalar(3);
          // The height API evaluates doubles; the renderer stores Float32 vertices.
          expect(point.y).toBeCloseTo(renderedTerrainHeight(point.x, point.z), 4);
        }
      } finally {
        fine.dispose();
      }
    }
  });

  it('preserves the full fine boundary while reducing every coarse tile interior', () => {
    for (const tile of TERRAIN_TILES) {
      const fine = buildFineTerrainTile(tile);
      const coarse = buildCoarseTerrainTile(tile);
      try {
        const perimeter = 2 * (tile.endColumn - tile.startColumn + tile.endRow - tile.startRow);
        expect(boundary(coarse, tile)).toEqual(boundary(fine, tile));
        expect(coarse.getAttribute('position').count).toBe(perimeter + 1);
        expect(coarse.getIndex()!.count).toBe(perimeter * 3);
        expect(coarse.getIndex()!.count).toBeLessThan(fine.getIndex()!.count / 6);
        expect(coarse.boundingBox!.min.x).toBe(tile.minX);
        expect(coarse.boundingBox!.max.x).toBe(tile.maxX);
        expect(coarse.boundingBox!.min.z).toBe(tile.minZ);
        expect(coarse.boundingBox!.max.z).toBe(tile.maxZ);
        const positions = coarse.getAttribute('position');
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const c = new THREE.Vector3();
        let area = 0;
        for (let i = 0; i < coarse.getIndex()!.count; i += 3) {
          a.fromBufferAttribute(positions, coarse.getIndex()!.getX(i));
          b.fromBufferAttribute(positions, coarse.getIndex()!.getX(i + 1));
          c.fromBufferAttribute(positions, coarse.getIndex()!.getX(i + 2));
          const upwardArea = b.sub(a).cross(c.sub(a)).y / 2;
          expect(upwardArea).toBeGreaterThan(0);
          area += upwardArea;
        }
        expect(area).toBeCloseTo((tile.maxX - tile.minX) * (tile.maxZ - tile.minZ), 6);
        expect(Number.isFinite(coarse.boundingSphere!.radius)).toBe(true);
      } finally {
        fine.dispose();
        coarse.dispose();
      }
    }
  });

  it('matches all adjacent coarse and fine seams including shortened outer tiles', () => {
    for (const tile of TERRAIN_TILES) {
      const coarse = buildCoarseTerrainTile(tile);
      try {
        const own = boundary(coarse, tile);
        for (const neighborIndex of [
          tile.col < 15 ? tile.row * 16 + tile.col + 1 : -1,
          tile.row < 15 ? (tile.row + 1) * 16 + tile.col : -1,
        ]) {
          if (neighborIndex < 0) continue;
          const neighbor = TERRAIN_TILES[neighborIndex];
          for (const build of [buildFineTerrainTile, buildCoarseTerrainTile]) {
            const adjacent = build(neighbor);
            try {
              const shared = [...boundary(adjacent, neighbor)].filter(([key]) => own.has(key));
              expect(shared).toHaveLength(
                neighbor.col > tile.col
                  ? tile.endRow - tile.startRow + 1
                  : tile.endColumn - tile.startColumn + 1,
              );
              for (const [key, vertex] of shared) expect(vertex).toEqual(own.get(key));
            } finally {
              adjacent.dispose();
            }
          }
        }
      } finally {
        coarse.dispose();
      }
    }
  });

  it('merges fine tiles into one draw with exact attributes and offset indices', () => {
    // All tiles exercise the Uint32 index path as well as the shortened edges.
    const merged = mergeFineTerrainTiles(TERRAIN_TILES);
    try {
      let offset = 0;
      let indexOffset = 0;
      const index = merged.getIndex()!;
      for (const tile of TERRAIN_TILES) {
        const fine = buildFineTerrainTile(tile);
        try {
          for (const name of ['position', 'normal', 'color']) {
            const actual = merged.getAttribute(name);
            const expected = fine.getAttribute(name);
            expect(
              Array.from(expected.array).every(
                (value, i) => value === actual.array[offset * 3 + i],
              ),
              `${tile.id} ${name}`,
            ).toBe(true);
          }
          expect(
            Array.from(fine.getIndex()!.array).every(
              (value, i) => value + offset === index.getX(indexOffset + i),
            ),
            tile.id,
          ).toBe(true);
          offset += fine.getAttribute('position').count;
          indexOffset += fine.getIndex()!.count;
        } finally {
          fine.dispose();
        }
      }
      expect(merged.getAttribute('position').count).toBe(offset);
      expect(index.count).toBe(LANDSCAPE_SEGMENTS ** 2 * 6);
      expect(index.array).toBeInstanceOf(Uint32Array);
      expect(merged.groups).toHaveLength(0);
      expect(merged.boundingBox!.min.x).toBe(-600);
      expect(merged.boundingBox!.max.x).toBe(600);
    } finally {
      merged.dispose();
    }
    const empty = mergeFineTerrainTiles([]);
    expect(empty.getAttribute('position').count).toBe(0);
    expect(empty.getIndex()!.count).toBe(0);
    expect(empty.boundingSphere!.radius).toBe(0);
    empty.dispose();
  });

  it('merges only requested coarse tiles into one bounded caller-owned geometry', () => {
    const tiles = TERRAIN_TILES.filter((tile) => tile.col > 2 || tile.row > 2);
    const merged = mergeCoarseTerrainTiles(tiles);
    try {
      const expectedIndices: number[] = [];
      let offset = 0;
      for (const tile of tiles) {
        const coarse = buildCoarseTerrainTile(tile);
        try {
          for (const name of ['position', 'normal', 'color']) {
            const actual = Array.from(merged.getAttribute(name).array).slice(
              offset * 3,
              (offset + coarse.getAttribute(name).count) * 3,
            );
            expect(actual).toEqual(Array.from(coarse.getAttribute(name).array));
          }
          expectedIndices.push(...Array.from(coarse.getIndex()!.array, (index) => index + offset));
          offset += coarse.getAttribute('position').count;
        } finally {
          coarse.dispose();
        }
      }
      expect(merged.getAttribute('position').count).toBe(offset);
      expect(Array.from(merged.getIndex()!.array)).toEqual(expectedIndices);
      expect(merged.groups).toHaveLength(0);
      expect(merged.boundingBox!.min.x).toBe(-600);
      expect(merged.boundingBox!.max.x).toBe(600);
      expect(merged.getIndex()!.count / 3).toBeLessThan(LANDSCAPE_SEGMENTS ** 2 * 2 * 0.13);
    } finally {
      merged.dispose();
    }
    const empty = mergeCoarseTerrainTiles([]);
    expect(empty.getAttribute('position').count).toBe(0);
    expect(empty.getIndex()!.count).toBe(0);
    expect(empty.boundingSphere!.radius).toBe(0);
    empty.dispose();
  });
});
