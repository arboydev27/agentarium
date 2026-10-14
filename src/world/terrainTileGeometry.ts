import * as THREE from 'three';
import { LANDSCAPE_SEGMENTS, LANDSCAPE_SIZE, terrainHeight } from './terrain';
import { landscapeVertexColor } from './terrainPalette';

const TILE_SEGMENTS = 16;
const TILES_PER_SIDE = Math.ceil(LANDSCAPE_SEGMENTS / TILE_SEGMENTS);
const GRID_WIDTH = LANDSCAPE_SEGMENTS + 1;
const STEP = LANDSCAPE_SIZE / LANDSCAPE_SEGMENTS;
const HALF = LANDSCAPE_SIZE / 2;

export type TerrainTile = Readonly<{
  id: string;
  col: number;
  row: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  // Inclusive vertex indices in the authoritative global grid.
  startColumn: number;
  endColumn: number;
  startRow: number;
  endRow: number;
}>;

export const TERRAIN_TILES: readonly TerrainTile[] = Object.freeze(
  Array.from({ length: TILES_PER_SIDE ** 2 }, (_, index) => {
    const col = index % TILES_PER_SIDE;
    const row = Math.floor(index / TILES_PER_SIDE);
    const startColumn = col * TILE_SEGMENTS;
    const startRow = row * TILE_SEGMENTS;
    const endColumn = Math.min(startColumn + TILE_SEGMENTS, LANDSCAPE_SEGMENTS);
    const endRow = Math.min(startRow + TILE_SEGMENTS, LANDSCAPE_SEGMENTS);
    return Object.freeze({
      id: `terrain:${col}:${row}`,
      col,
      row,
      minX: Math.fround(startColumn * STEP - HALF),
      maxX: Math.fround(endColumn * STEP - HALF),
      minZ: Math.fround(startRow * STEP - HALF),
      maxZ: Math.fround(endRow * STEP - HALF),
      startColumn,
      endColumn,
      startRow,
      endRow,
    });
  }),
);

type Surface = { position: Float32Array; normal: Float32Array; color: Float32Array };
let surface: Surface | undefined;

function authoritativeSurface(): Surface {
  if (surface) return surface;
  // Preserve PlaneGeometry's Float32 coordinates and area-weighted normals.
  // Only CPU arrays are retained; no reference geometry is sent to the renderer.
  const reference = new THREE.PlaneGeometry(
    LANDSCAPE_SIZE,
    LANDSCAPE_SIZE,
    LANDSCAPE_SEGMENTS,
    LANDSCAPE_SEGMENTS,
  );
  reference.rotateX(-Math.PI / 2);
  const position = reference.getAttribute('position') as THREE.BufferAttribute;
  const color = new Float32Array(position.count * 3);
  const scratch = new THREE.Color();
  for (let vertex = 0; vertex < position.count; vertex++) {
    const x = position.getX(vertex);
    const z = position.getZ(vertex);
    const y = terrainHeight(x, z);
    position.setY(vertex, y);
    landscapeVertexColor(x, z, y, scratch);
    scratch.toArray(color, vertex * 3);
  }
  reference.computeVertexNormals();
  surface = {
    position: position.array as Float32Array,
    normal: reference.getAttribute('normal').array as Float32Array,
    color,
  };
  reference.dispose();
  return surface;
}

function globalVertex(column: number, row: number) {
  return row * GRID_WIDTH + column;
}

function geometryFromVertices(vertices: readonly number[], indices: readonly number[]) {
  const geometry = new THREE.BufferGeometry();
  const attributes = authoritativeSurface();
  for (const name of ['position', 'normal', 'color'] as const) {
    const values = new Float32Array(vertices.length * 3);
    vertices.forEach((vertex, local) => {
      values.set(attributes[name].subarray(vertex * 3, vertex * 3 + 3), local * 3);
    });
    geometry.setAttribute(name, new THREE.BufferAttribute(values, 3));
  }
  geometry.setIndex([...indices]);
  if (vertices.length) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  } else {
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  }
  return geometry;
}

// Each returned geometry owns its attributes and must be disposed by its caller.
export function buildFineTerrainTile(tile: TerrainTile): THREE.BufferGeometry {
  return mergeFineTerrainTiles([tile]);
}

function appendFineTile(tile: TerrainTile, vertices: number[], indices: number[]) {
  const width = tile.endColumn - tile.startColumn + 1;
  const height = tile.endRow - tile.startRow + 1;
  const offset = vertices.length;
  for (let row = tile.startRow; row <= tile.endRow; row++)
    for (let column = tile.startColumn; column <= tile.endColumn; column++)
      vertices.push(globalVertex(column, row));
  for (let row = 0; row < height - 1; row++) {
    for (let column = 0; column < width - 1; column++) {
      const a = offset + row * width + column;
      const b = a + width;
      const c = b + 1;
      const d = a + 1;
      // The same (00,01,10), (01,11,10) diagonal as PlaneGeometry.
      indices.push(a, b, d, b, c, d);
    }
  }
}

// Fine tiles can also share one draw; the returned buffers remain caller-owned.
export function mergeFineTerrainTiles(tiles: readonly TerrainTile[]): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const tile of tiles) appendFineTile(tile, vertices, indices);
  return geometryFromVertices(vertices, indices);
}

function coarseVertices(tile: TerrainTile) {
  const vertices: number[] = [];
  // Walk the entire fine boundary once, with upward-facing winding.
  for (let row = tile.startRow; row < tile.endRow; row++)
    vertices.push(globalVertex(tile.startColumn, row));
  for (let column = tile.startColumn; column < tile.endColumn; column++)
    vertices.push(globalVertex(column, tile.endRow));
  for (let row = tile.endRow; row > tile.startRow; row--)
    vertices.push(globalVertex(tile.endColumn, row));
  for (let column = tile.endColumn; column > tile.startColumn; column--)
    vertices.push(globalVertex(column, tile.startRow));
  vertices.push(
    globalVertex((tile.startColumn + tile.endColumn) / 2, (tile.startRow + tile.endRow) / 2),
  );
  return vertices;
}

export function buildCoarseTerrainTile(tile: TerrainTile): THREE.BufferGeometry {
  return mergeCoarseTerrainTiles([tile]);
}

// Merge the unselected tiles into one draw without allocating temporary geometries.
export function mergeCoarseTerrainTiles(tiles: readonly TerrainTile[]): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const tile of tiles) {
    const ring = coarseVertices(tile);
    const offset = vertices.length;
    const center = ring.length - 1;
    vertices.push(...ring);
    for (let edge = 0; edge < center; edge++)
      indices.push(offset + center, offset + edge, offset + ((edge + 1) % center));
  }
  return geometryFromVertices(vertices, indices);
}
