import type { FringePlacements, FringeRock, FringeTree } from './outerLandscapePlacement';

export const OUTER_GROUP_SIZE = 50;
export const OUTER_GROUP_LIMIT = 6;

export type OuterPoint = Readonly<{ x: number; z: number }>;
export type OuterGroup = FringePlacements &
  Readonly<{
    id: string;
    col: number;
    row: number;
    centerX: number;
    centerZ: number;
  }>;
export type OuterCatalog = Readonly<{
  coarse: FringePlacements;
  groups: readonly OuterGroup[];
}>;
export type OuterAnchors = Readonly<{ focus: OuterPoint; camera: OuterPoint }>;

type MutableCell = {
  col: number;
  row: number;
  trees: FringeTree[];
  rocks: FringeRock[];
};

const cellIndex = (coordinate: number) => Math.floor(coordinate / OUTER_GROUP_SIZE);
const cellId = (col: number, row: number) => `outer-fringe:${col}:${row}`;
const byPosition = (a: OuterPoint, b: OuterPoint) => a.x - b.x || a.z - b.z;

// Coarse silhouettes stay mounted everywhere. Detail partitions use stable
// world cells so camera travel never changes the placement of a tree or stone.
export function partitionOuterLandscape(placements: FringePlacements): OuterCatalog {
  const cells = new Map<string, MutableCell>();
  const cellFor = (point: OuterPoint) => {
    const col = cellIndex(point.x);
    const row = cellIndex(point.z);
    const id = cellId(col, row);
    let cell = cells.get(id);
    if (!cell) {
      cell = { col, row, trees: [], rocks: [] };
      cells.set(id, cell);
    }
    return cell;
  };
  placements.trees.forEach((tree) => cellFor(tree).trees.push(tree));
  placements.rocks.forEach((rock) => cellFor(rock).rocks.push(rock));
  const coarseTrees: FringeTree[] = [];
  const coarseRocks: FringeRock[] = [];
  const groups: OuterGroup[] = [];
  for (const cell of [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col)) {
    const detailTrees: FringeTree[] = [];
    const detailRocks: FringeRock[] = [];
    cell.trees.sort(byPosition).forEach((tree, index) => {
      (index % 3 === 0 ? coarseTrees : detailTrees).push(tree);
    });
    cell.rocks.sort(byPosition).forEach((rock, index) => {
      (index % 2 === 0 ? coarseRocks : detailRocks).push(rock);
    });
    if (detailTrees.length || detailRocks.length)
      groups.push({
        id: cellId(cell.col, cell.row),
        col: cell.col,
        row: cell.row,
        centerX: (cell.col + 0.5) * OUTER_GROUP_SIZE,
        centerZ: (cell.row + 0.5) * OUTER_GROUP_SIZE,
        trees: detailTrees,
        rocks: detailRocks,
      });
  }
  return { coarse: { trees: coarseTrees, rocks: coarseRocks }, groups };
}

function distanceToGroup(point: OuterPoint, group: OuterGroup) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return Infinity;
  const dx = Math.max(0, Math.abs(point.x - group.centerX) - OUTER_GROUP_SIZE / 2);
  const dz = Math.max(0, Math.abs(point.z - group.centerZ) - OUTER_GROUP_SIZE / 2);
  return Math.hypot(dx, dz);
}

const RADII = {
  focus: { enter: 70, exit: 95 },
  camera: { enter: 55, exit: 80 },
} as const;

export function selectOuterGroups(
  groups: readonly OuterGroup[],
  anchors: OuterAnchors,
  previousIds: ReadonlySet<string> = new Set(),
): OuterGroup[] {
  const candidates: {
    group: OuterGroup;
    priority: number;
    distance: number;
    previous: boolean;
  }[] = [];
  for (const group of groups) {
    const previous = previousIds.has(group.id);
    const focusDistance = distanceToGroup(anchors.focus, group);
    const cameraDistance = distanceToGroup(anchors.camera, group);
    if (focusDistance <= (previous ? RADII.focus.exit : RADII.focus.enter))
      candidates.push({ group, priority: 0, distance: focusDistance, previous });
    else if (cameraDistance <= (previous ? RADII.camera.exit : RADII.camera.enter))
      candidates.push({ group, priority: 1, distance: cameraDistance, previous });
  }
  candidates.sort(
    (a, b) =>
      a.priority - b.priority ||
      Number(b.previous) - Number(a.previous) ||
      a.distance - b.distance ||
      a.group.row - b.group.row ||
      a.group.col - b.group.col,
  );
  return candidates.slice(0, OUTER_GROUP_LIMIT).map(({ group }) => group);
}
