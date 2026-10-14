import { TERRAIN_TILES, type TerrainTile } from './terrainTileGeometry';

export interface TerrainSelectionAnchor {
  readonly x: number;
  readonly z: number;
}

export interface TerrainSelectionAnchors {
  /** Tiles intersecting the camera frustum; mandatory even beyond the usual cap. */
  readonly visibleIds?: readonly string[];
  readonly focus?: TerrainSelectionAnchor | null;
  readonly camera?: TerrainSelectionAnchor | null;
  /** A camera preset destination or a short lookahead point during travel. */
  readonly prefetch?: TerrainSelectionAnchor | null;
}

export const TERRAIN_TILE_SELECTION_POLICY = Object.freeze({
  maxFineTiles: 64,
  focusEntryRadius: 90,
  focusExitRadius: 115,
  cameraEntryRadius: 165,
  cameraExitRadius: 185,
});

interface AnchorRange {
  point: TerrainSelectionAnchor;
  entryRadius: number;
  exitRadius: number;
  camera: boolean;
}

function validAnchor(
  point: TerrainSelectionAnchor | null | undefined,
): point is TerrainSelectionAnchor {
  return point != null && Number.isFinite(point.x) && Number.isFinite(point.z);
}

function distanceToTile(tile: TerrainTile, point: TerrainSelectionAnchor) {
  const dx = Math.max(tile.minX - point.x, 0, point.x - tile.maxX);
  const dz = Math.max(tile.minZ - point.z, 0, point.z - tile.maxZ);
  return Math.hypot(dx, dz);
}

/**
 * Select only the fine terrain cover. The renderer must cover every other tile
 * with coarse terrain, excluding these IDs from that cover in the same update.
 *
 * Explicit visible IDs are mandatory and may exceed the usual working-set cap.
 * Camera entry tiles follow, covering fog-visible ground before any prefetch detail. Focus/prefetch containing tiles follow, then their entry
 * tiles, then previously mounted tiles within an exit radius. When the combined
 * working set exceeds the cap, normalized distance shares the remaining space;
 * a small incumbent preference avoids swaps for tiny camera movements. A
 * prefetch point participates in the same bounded set as focus and camera.
 * Returned tiles always follow TERRAIN_TILES order, independent of prior order.
 */
export function selectTerrainTiles(
  anchors: TerrainSelectionAnchors,
  previousFineIds: readonly string[] = [],
): TerrainTile[] {
  const policy = TERRAIN_TILE_SELECTION_POLICY;
  const ranges: AnchorRange[] = [];
  if (validAnchor(anchors.focus))
    ranges.push({
      point: anchors.focus,
      entryRadius: policy.focusEntryRadius,
      exitRadius: policy.focusExitRadius,
      camera: false,
    });
  if (validAnchor(anchors.camera))
    ranges.push({
      point: anchors.camera,
      entryRadius: policy.cameraEntryRadius,
      exitRadius: policy.cameraExitRadius,
      camera: true,
    });
  if (validAnchor(anchors.prefetch))
    ranges.push({
      point: anchors.prefetch,
      entryRadius: policy.focusEntryRadius,
      exitRadius: policy.focusExitRadius,
      camera: false,
    });
  const visible = new Set(anchors.visibleIds);
  if (ranges.length === 0 && visible.size === 0) return [];

  const previous = new Set(previousFineIds);
  const candidates: { tile: TerrainTile; index: number; tier: number; score: number }[] = [];
  let visibleCount = 0;
  for (const [index, tile] of TERRAIN_TILES.entries()) {
    if (visible.has(tile.id)) {
      candidates.push({ tile, index, tier: -1, score: 0 });
      visibleCount++;
      continue;
    }
    const incumbent = previous.has(tile.id);
    let tier = Infinity;
    let score = Infinity;
    for (const { point, entryRadius, exitRadius, camera } of ranges) {
      const distance = distanceToTile(tile, point);
      const anchorTier = distance <= entryRadius ? (camera ? 0 : distance === 0 ? 1 : 2) : 3;
      if (anchorTier === 3 && (!incumbent || distance > exitRadius)) continue;
      const anchorScore = distance / entryRadius;
      if (anchorTier < tier) {
        tier = anchorTier;
        score = anchorScore;
      } else if (anchorTier === tier) {
        score = Math.min(score, anchorScore);
      }
    }
    if (Number.isFinite(tier))
      candidates.push({ tile, index, tier, score: score * (incumbent ? 0.9 : 1) });
  }

  candidates.sort((a, b) => a.tier - b.tier || a.score - b.score || a.index - b.index);
  return candidates
    .slice(0, Math.max(policy.maxFineTiles, visibleCount))
    .sort((a, b) => a.index - b.index)
    .map(({ tile }) => tile);
}
