import type { DetailChunk } from '../chunks';
import { CAMERA_PAN_BOUNDS } from '../cameraPan';
import { LOOKOUT } from '../layout';
import { meadowTrailPoint, renderedTerrainHeight } from '../terrain';
import { clearOfObservatory } from './observatoryPlacement';
import { clearOfOrchard } from './orchardPlacement';

export type MeadowPiece = { x: number; y: number; z: number; size: number; shade: number };
export type MeadowPieces = {
  patches: MeadowPiece[];
  flowers: MeadowPiece[];
  rocks: MeadowPiece[];
};

const TRAIL = Array.from({ length: 35 }, (_, index) => {
  const [x, , z] = meadowTrailPoint(index);
  return [x, z] as const;
});
const OAK = { x: 18.5, z: -44 } as const;

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length)) : 0;
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

export function clearOfMeadowRoutes(x: number, z: number, radius = 0) {
  if (Math.abs(x) < 18 + radius && Math.abs(z) < 15 + radius) return false;
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < LOOKOUT.focusRadius + 1.6 + radius) return false;
  if (Math.hypot(x - OAK.x, z - OAK.z) < 3.5 + radius) return false;
  if (!clearOfOrchard(x, z, radius) || !clearOfObservatory(x, z, radius)) return false;
  if (z < -83 && Math.abs(x) < 107) return false;
  for (let index = 1; index < TRAIL.length; index++) {
    if (distanceToSegment(x, z, ...TRAIL[index - 1], ...TRAIL[index]) < 3 + radius) return false;
  }
  return true;
}

// Only cells near the reachable camera area need decorative placement. The
// continuous ground, authored routes, and landmarks are owned elsewhere.
export function meadowChunkHasDetail(chunk: DetailChunk) {
  const { minX, maxX, minZ, maxZ } = CAMERA_PAN_BOUNDS;
  return (
    chunk.centerX >= minX - 70 &&
    chunk.centerX <= maxX + 70 &&
    chunk.centerZ >= minZ - 55 &&
    chunk.centerZ <= maxZ + 70
  );
}

export function buildMeadowPieces(chunk: DetailChunk, quality: 'high' | 'low'): MeadowPieces {
  const pieces: MeadowPieces = { patches: [], flowers: [], rocks: [] };
  if (!meadowChunkHasDetail(chunk)) return pieces;
  const nearTrail = Math.abs(chunk.centerX) < 75 && chunk.centerZ > -105 && chunk.centerZ < 45;
  const patchCount = quality === 'high' ? (nearTrail ? 54 : 32) : nearTrail ? 23 : 14;
  const rockCount = quality === 'high' ? (nearTrail ? 12 : 8) : nearTrail ? 6 : 4;
  const seed = Math.imul(chunk.col + 1, 73856093) ^ Math.imul(chunk.row + 1, 19349663);
  const patchRandom = random(seed ^ 0x65776f64);
  const rockRandom = random(seed ^ 0x726f636b);
  const minX = chunk.centerX - 30;
  const minZ = chunk.centerZ - 30;
  for (let index = 0; index < patchCount; index++) {
    const x = minX + 3 + patchRandom() * 54;
    const z = minZ + 3 + patchRandom() * 54;
    const size = 0.52 + patchRandom() * 0.7;
    const shade = Math.floor(patchRandom() * 4);
    if (!clearOfMeadowRoutes(x, z, size * 0.6)) continue;
    const piece = { x, y: renderedTerrainHeight(x, z), z, size, shade };
    pieces.patches.push(piece);
    if (quality === 'high' && index % 4 === 0) pieces.flowers.push(piece);
  }
  for (let index = 0; index < rockCount; index++) {
    const x = minX + 3 + rockRandom() * 54;
    const z = minZ + 3 + rockRandom() * 54;
    const size = 0.27 + rockRandom() * 0.32;
    const shade = Math.floor(rockRandom() * 3);
    if (!clearOfMeadowRoutes(x, z, size)) continue;
    pieces.rocks.push({ x, y: renderedTerrainHeight(x, z), z, size, shade });
  }
  return pieces;
}
