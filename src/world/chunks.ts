// Selection for optional scenery only. Agents, routes, and task state live elsewhere.
export const DETAIL_WORLD_SIZE = 600;
export const DETAIL_CHUNK_SIZE = 60;
export const DETAIL_CHUNK_LIMIT = 24;

const HALF_WORLD = DETAIL_WORLD_SIZE / 2;
const CELLS_PER_SIDE = DETAIL_WORLD_SIZE / DETAIL_CHUNK_SIZE;

export type DetailPoint = Readonly<{ x: number; z: number }>;
export type DetailChunk = Readonly<{
  id: string;
  col: number;
  row: number;
  centerX: number;
  centerZ: number;
}>;
export type DetailChunkAnchors = Readonly<{
  focus: DetailPoint;
  camera: DetailPoint;
  residents?: readonly DetailPoint[];
}>;

const CHUNKS: readonly DetailChunk[] = Array.from({ length: CELLS_PER_SIDE ** 2 }, (_, index) => {
  const col = index % CELLS_PER_SIDE;
  const row = Math.floor(index / CELLS_PER_SIDE);
  return Object.freeze({
    id: `detail-chunk:${col}:${row}`,
    col,
    row,
    centerX: -HALF_WORLD + (col + 0.5) * DETAIL_CHUNK_SIZE,
    centerZ: -HALF_WORLD + (row + 0.5) * DETAIL_CHUNK_SIZE,
  });
});

export function detailChunkAt(x: number, z: number): DetailChunk | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (x < -HALF_WORLD || x > HALF_WORLD || z < -HALF_WORLD || z > HALF_WORLD) return null;
  const col = Math.min(CELLS_PER_SIDE - 1, Math.floor((x + HALF_WORLD) / DETAIL_CHUNK_SIZE));
  const row = Math.min(CELLS_PER_SIDE - 1, Math.floor((z + HALF_WORLD) / DETAIL_CHUNK_SIZE));
  return CHUNKS[row * CELLS_PER_SIDE + col];
}

function distanceToChunk(point: DetailPoint, chunk: DetailChunk) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return Infinity;
  const dx = Math.max(0, Math.abs(point.x - chunk.centerX) - DETAIL_CHUNK_SIZE / 2);
  const dz = Math.max(0, Math.abs(point.z - chunk.centerZ) - DETAIL_CHUNK_SIZE / 2);
  return Math.hypot(dx, dz);
}

// Exit radii exceed enter radii, so cells do not flicker at a threshold.
const RADII = {
  focus: { enter: 90, exit: 115 },
  camera: { enter: 75, exit: 100 },
  resident: { enter: 55, exit: 80 },
} as const;

export function selectDetailChunks(
  anchors: DetailChunkAnchors,
  previousIds: ReadonlySet<string> = new Set(),
): DetailChunk[] {
  const residents = anchors.residents ?? [];
  const candidates: {
    chunk: DetailChunk;
    priority: number;
    distance: number;
    previous: boolean;
  }[] = [];
  for (const chunk of CHUNKS) {
    const previous = previousIds.has(chunk.id);
    const focusDistance = distanceToChunk(anchors.focus, chunk);
    const cameraDistance = distanceToChunk(anchors.camera, chunk);
    const residentDistance = residents.reduce(
      (nearest, resident) => Math.min(nearest, distanceToChunk(resident, chunk)),
      Infinity,
    );
    const focusRadius = previous ? RADII.focus.exit : RADII.focus.enter;
    const cameraRadius = previous ? RADII.camera.exit : RADII.camera.enter;
    const residentRadius = previous ? RADII.resident.exit : RADII.resident.enter;
    if (focusDistance <= focusRadius)
      candidates.push({ chunk, priority: 0, distance: focusDistance, previous });
    else if (cameraDistance <= cameraRadius)
      candidates.push({ chunk, priority: 1, distance: cameraDistance, previous });
    else if (residentDistance <= residentRadius)
      candidates.push({ chunk, priority: 2, distance: residentDistance, previous });
  }
  candidates.sort(
    (a, b) =>
      a.priority - b.priority ||
      Number(b.previous) - Number(a.previous) ||
      a.distance - b.distance ||
      a.chunk.row - b.chunk.row ||
      a.chunk.col - b.chunk.col,
  );
  return candidates.slice(0, DETAIL_CHUNK_LIMIT).map(({ chunk }) => chunk);
}
