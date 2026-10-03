import { routeForSeat, routeLengths, type Point } from './motion';
import { LOOKOUT, OBSERVATORY, ORCHARD } from './layout';
import { meadowTrailPoint, terrainHeight, walkwayHeight } from './terrain';
import { TRAIL_TURNOUTS, turnoutPoint } from './scenery/turnoutPlacement';

export type Destination = {
  id: string;
  label: string;
  node: string;
  facing: number;
  seated?: boolean;
  clip: 'Rest' | 'BenchRest' | 'CafeBreak' | 'GardenLook';
};
export const DESTINATIONS: Destination[] = [
  { id: 'coffee', label: 'café counter', node: 'coffee', facing: -Math.PI / 2, clip: 'CafeBreak' },
  { id: 'window', label: 'café window', node: 'window', facing: Math.PI, clip: 'GardenLook' },
  {
    id: 'garden-west',
    label: 'garden terrace',
    node: 'garden-west',
    facing: 0.4,
    clip: 'GardenLook',
  },
  { id: 'garden-east', label: 'garden terrace', node: 'garden-east', facing: -0.4, clip: 'Rest' },
  {
    id: 'bench',
    label: 'courtyard bench',
    node: 'bench',
    facing: Math.PI / 2,
    seated: true,
    clip: 'BenchRest',
  },
  { id: 'basin', label: 'courtyard basin', node: 'basin', facing: Math.PI / 2, clip: 'GardenLook' },
  { id: 'studio-break', label: 'studio terrace', node: 'studio-break', facing: 0, clip: 'Rest' },
  // Profile seven starts with this landmark, making the new district visible in the demo.
  {
    id: 'meadow:lookout',
    label: 'meadow lookout',
    node: 'meadow:lookout',
    facing: 0.7,
    clip: 'GardenLook',
  },
  { id: 'promenade', label: 'tree-lined path', node: 'promenade', facing: 0, clip: 'GardenLook' },
  {
    id: 'orchard:commons',
    label: 'orchard commons',
    node: 'orchard:commons',
    facing: 0.7,
    clip: 'GardenLook',
  },
  {
    id: 'observatory:cedar',
    label: 'cedar observatory',
    node: 'observatory:cedar',
    facing: -0.7,
    clip: 'GardenLook',
  },
  ...TRAIL_TURNOUTS.map<Destination>((turnout) => ({
    id: turnout.id,
    label: turnout.label,
    node: turnout.id,
    facing: (turnout.side * Math.PI) / 2,
    clip: turnout.side < 0 ? 'GardenLook' : 'Rest',
  })),
];
// Authored walkable lanes, including elevation changes at stairs and floor edges.
// Destinations are terminal branches so resting residents never occupy through routes.
export const NODES: Record<string, Point> = {
  west: [-6.8, 0.46, 0.85],
  center: [0.1, 0.46, 0.85],
  east: [6.8, 0.46, 0.85],
  'cafe-step': [-6.8, 0.55, 0.65],
  'cafe-door': [-6.8, 0.68, 0.25],
  'cafe-aisle': [-6.8, 0.68, -5.35],
  'coffee-approach': [-9.9, 0.68, -5.35],
  coffee: [-9.9, 0.68, -6.15],
  'window-approach': [-2.4, 0.68, -5.35],
  window: [-2.4, 0.68, -5.5],
  'studio-step0': [6.8, 0.46, 0],
  'studio-step1': [6.8, 0.605, -0.35],
  'studio-step2': [6.8, 0.785, -0.71],
  'studio-step3': [6.8, 0.965, -1.07],
  'studio-door': [6.8, 1.1, -1.45],
  'studio-aisle': [6.8, 1.1, -6.8],
  'studio-break-approach': [3, 1.1, -1.45],
  'studio-break': [3, 1.1, -2.2],
  'garden-door': [6.8, 0.55, 1.2],
  'garden-aisle': [6.8, 0.55, 2.4],
  'garden-front': [6.8, 0.55, 6.9],
  'garden-west': [4, 0.55, 7.5],
  'garden-east': [8.5, 0.55, 7.5],
  'court-door': [-6.8, 0.49, 2.2],
  'court-aisle': [-6.2, 0.49, 3.15],
  'bench-approach': [-9.4, 0.49, 3.4],
  bench: [-10.33, 0.49, 3.4],
  'court-front': [-6.2, 0.49, 7.7],
  basin: [-3.7, 0.49, 7.7],
  promenade: [0.1, 0.46, 8],
  'meadow:branch-1': [8, walkwayHeight(8, -38.25, 0.09), -38.25],
  'meadow:branch-2': [10.5, walkwayHeight(10.5, -38.1, 0.09), -38.1],
  'meadow:lookout': [LOOKOUT.x, terrainHeight(LOOKOUT.x, LOOKOUT.z) + 0.1, LOOKOUT.z],
  'orchard:commons': [ORCHARD.x, terrainHeight(ORCHARD.x, ORCHARD.z) + 0.12, ORCHARD.z],
  'observatory:cedar': [
    OBSERVATORY.x,
    terrainHeight(OBSERVATORY.x, OBSERVATORY.z) + 0.12,
    OBSERVATORY.z,
  ],
};
for (let index = 0; index <= 22; index++) {
  const [x, y, z] = meadowTrailPoint(index);
  // A little clearance keeps the straight movement chords above uneven ground.
  NODES[`meadow:trail-${index}`] = [x, y + 0.025, z];
}
for (const turnout of TRAIL_TURNOUTS) {
  NODES[`${turnout.id}:approach`] = [...turnoutPoint(turnout.trailIndex, turnout.side, 2.5)];
  NODES[turnout.id] = [...turnoutPoint(turnout.trailIndex, turnout.side, 4.8)];
}
const orchardOrigin = meadowTrailPoint(22);
const orchardBranch: [number, number][] = [
  [(orchardOrigin[0] + 10) / 2, (orchardOrigin[2] - 64) / 2],
  [10, -64],
  [15, -65.25],
  [20, -66.5],
  [24.5, -67.5],
  [29, -68.5],
  [32.5, -69.25],
];
for (let index = 0; index < orchardBranch.length; index++) {
  const [x, z] = orchardBranch[index];
  NODES[`orchard:branch-${index + 1}`] = [x, walkwayHeight(x, z, 0.105), z];
}
const observatoryBranch: [number, number][] = [
  [0, -47.8],
  [-4, -47.8],
  [-8, -48.4],
  [-12, -49],
  [-16, -49.5],
  [-20, -50],
  [-23.5, -50],
  [-27, -50],
];
for (let index = 0; index < observatoryBranch.length; index++) {
  const [x, z] = observatoryBranch[index];
  NODES[`observatory:branch-${index + 1}`] = [x, walkwayHeight(x, z, 0.105), z];
}
const chains = [
  ['west', 'center', 'east'],
  ['west', 'cafe-step', 'cafe-door', 'cafe-aisle'],
  ['cafe-aisle', 'coffee-approach', 'coffee'],
  ['cafe-aisle', 'window-approach', 'window'],
  [
    'east',
    'studio-step0',
    'studio-step1',
    'studio-step2',
    'studio-step3',
    'studio-door',
    'studio-aisle',
  ],
  ['studio-door', 'studio-break-approach', 'studio-break'],
  ['east', 'garden-door', 'garden-aisle', 'garden-front'],
  ['garden-front', 'garden-west'],
  ['garden-front', 'garden-east'],
  ['west', 'court-door', 'court-aisle', 'court-front', 'basin'],
  ['court-aisle', 'bench-approach', 'bench'],
  ['center', 'promenade'],
  ['center', ...Array.from({ length: 23 }, (_, index) => `meadow:trail-${index}`)],
  ['meadow:trail-12', 'meadow:branch-1', 'meadow:branch-2', 'meadow:lookout'],
  [
    'meadow:trail-22',
    ...orchardBranch.map((_, index) => `orchard:branch-${index + 1}`),
    'orchard:commons',
  ],
  [
    'meadow:trail-16',
    ...observatoryBranch.map((_, index) => `observatory:branch-${index + 1}`),
    'observatory:cedar',
  ],
];
for (const turnout of TRAIL_TURNOUTS)
  chains.push([`meadow:trail-${turnout.trailIndex}`, `${turnout.id}:approach`, turnout.id]);
for (let seat = 0; seat < 8; seat++) {
  const p = routeForSeat(seat)[1];
  NODES[`home-${seat}`] = p;
  const laneZ = seat < 2 ? -5.35 : seat < 4 ? 2.4 : seat < 6 ? -6.8 : 3.15;
  NODES[`join-${seat}`] = [p[0], p[1], laneZ];
  const hub =
    seat < 2 ? 'cafe-aisle' : seat < 4 ? 'garden-aisle' : seat < 6 ? 'studio-aisle' : 'court-aisle';
  chains.push([`home-${seat}`, `join-${seat}`, hub]);
}
export const EDGES = chains.flatMap((chain) =>
  chain.slice(1).map((id, i) => [chain[i], id] as const),
);
export function planRoute(start: string, end: string) {
  if (!NODES[start] || !NODES[end]) throw new Error('Unknown navigation node');
  const distances = new Map([[start, 0]]),
    previous = new Map<string, string>();
  const pending = new Set(Object.keys(NODES));
  while (pending.size) {
    const current = [...pending].reduce((a, b) =>
      (distances.get(a) ?? Infinity) < (distances.get(b) ?? Infinity) ? a : b,
    );
    if (!Number.isFinite(distances.get(current))) break;
    pending.delete(current);
    if (current === end) break;
    for (const edge of EDGES) {
      const next = edge[0] === current ? edge[1] : edge[1] === current ? edge[0] : null;
      if (!next || !pending.has(next)) continue;
      const cost =
        distances.get(current)! + Math.hypot(...NODES[next].map((v, i) => v - NODES[current][i]));
      if (cost < (distances.get(next) ?? Infinity)) {
        distances.set(next, cost);
        previous.set(next, current);
      }
    }
  }
  if (!distances.has(end)) throw new Error('Unreachable navigation destination');
  const ids = [end];
  while (ids[0] !== start) ids.unshift(previous.get(ids[0])!);
  const points = ids.map((id) => NODES[id]);
  return { ids, points, lengths: routeLengths(points) };
}

function edgeKey(a: string, b: string) {
  return `edge:${[a, b].sort().join('\0')}`;
}
type Resource = { start: number; end: number; from?: Point; to?: Point };
function pointDistanceToSegment(point: Point, from: Point, to: Point) {
  const dx = to[0] - from[0],
    dz = to[2] - from[2],
    lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared
    ? Math.max(
        0,
        Math.min(1, ((point[0] - from[0]) * dx + (point[2] - from[2]) * dz) / lengthSquared),
      )
    : 0;
  return Math.hypot(point[0] - from[0] - t * dx, point[2] - from[2] - t * dz);
}
function lanesConflict(a: Resource, b: Resource) {
  if (!a.from || !b.from) return false;
  const aTo = a.to ?? a.from,
    bTo = b.to ?? b.from;
  const boundsApart =
    Math.max(a.from[0], aTo[0]) + 0.7 < Math.min(b.from[0], bTo[0]) ||
    Math.max(b.from[0], bTo[0]) + 0.7 < Math.min(a.from[0], aTo[0]) ||
    Math.max(a.from[2], aTo[2]) + 0.7 < Math.min(b.from[2], bTo[2]) ||
    Math.max(b.from[2], bTo[2]) + 0.7 < Math.min(a.from[2], aTo[2]);
  if (boundsApart) return false;
  const cross = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[0] - p[0]);
  const ac = cross(a.from, aTo, b.from),
    ad = cross(a.from, aTo, bTo),
    ca = cross(b.from, bTo, a.from),
    cb = cross(b.from, bTo, aTo);
  if (ac * ad < 0 && ca * cb < 0) return true;
  return (
    Math.min(
      pointDistanceToSegment(a.from, b.from, bTo),
      pointDistanceToSegment(aTo, b.from, bTo),
      pointDistanceToSegment(b.from, a.from, aTo),
      pointDistanceToSegment(bTo, a.from, aTo),
    ) < 0.7
  );
}
function routeResources(ids: string[]) {
  const lengths = ids.every((id) => NODES[id])
    ? routeLengths(ids.map((id) => NODES[id]))
    : ids.map((_, i) => i);
  const resources = new Map<string, Resource>();
  const include = (key: string, resource: Resource) => {
    const previous = resources.get(key);
    resources.set(
      key,
      previous
        ? {
            ...resource,
            start: Math.min(previous.start, resource.start),
            end: Math.max(previous.end, resource.end),
          }
        : resource,
    );
  };
  for (let i = 0; i < ids.length; i++) {
    include(`node:${ids[i]}`, { start: lengths[i], end: lengths[i], from: NODES[ids[i]] });
    if (i === 0) continue;
    const start = lengths[i - 1],
      end = lengths[i];
    include(edgeKey(ids[i - 1], ids[i]), {
      start,
      end,
      from: NODES[ids[i - 1]],
      to: NODES[ids[i]],
    });
  }
  return resources;
}
function resourcesConflict(wanted: Map<string, Resource>, held: Map<string, Resource>) {
  for (const [key, resource] of wanted) {
    if (held.has(key)) return true;
    for (const [otherKey, other] of held)
      if (otherKey !== key && lanesConflict(resource, other)) return true;
  }
  return false;
}

// Reserve the route ahead atomically, then release cleared nodes and edges behind the traveler.
// This admits intersecting trips once their shared corridor is safely behind one
// resident, without allowing opposing travelers to meet inside a narrow lane.
export class NavigationTraffic {
  private corridors = new Map<string, Map<string, Resource>>();
  private destinations = new Map<string, string>();
  private returning = new Map<string, Map<string, Resource>>();
  private readonly clearance = 0.95;
  reserveDestination(owner: string, destination: string) {
    const held = this.destinations.get(destination);
    if (held && held !== owner) return false;
    this.destinations.set(destination, owner);
    return true;
  }
  acquire(owner: string, ids: string[], priority = false) {
    const wanted = routeResources(ids);
    if (priority) this.returning.set(owner, wanted);
    if (!priority)
      for (const [other, waiting] of this.returning) {
        if (owner !== other && resourcesConflict(wanted, waiting)) return false;
      }
    for (const [other, held] of this.corridors) {
      if (owner !== other && resourcesConflict(wanted, held)) return false;
    }
    this.returning.delete(owner);
    this.corridors.set(owner, wanted);
    return true;
  }
  releasePassed(owner: string, distance: number, returning = false) {
    const held = this.corridors.get(owner);
    if (!held) return;
    for (const [resource, { start, end }] of held) {
      const behind = returning
        ? start > distance + this.clearance
        : end < distance - this.clearance;
      if (behind) held.delete(resource);
    }
    if (held.size === 0) this.corridors.delete(owner);
  }
  releaseCorridor(owner: string) {
    this.corridors.delete(owner);
  }
  release(owner: string) {
    this.releaseCorridor(owner);
    this.returning.delete(owner);
    for (const [destination, held] of this.destinations)
      if (held === owner) this.destinations.delete(destination);
  }
}
