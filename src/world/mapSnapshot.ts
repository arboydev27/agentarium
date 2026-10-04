import { CAMERA_PAN_BOUNDS } from './cameraPan';
import { LOOKOUT, OBSERVATORY, ORCHARD, type WorldView } from './layout';
import { SOUTHWIND_SHORE } from './scenery/southwindTrailPlacement';
import { TRAIL_TURNOUTS, turnoutPoint } from './scenery/turnoutPlacement';

export type MapPoint = { x: number; z: number };
export type MapResident = MapPoint & { id: string; name: string; seat: number };
export type MapSnapshot = { camera: MapPoint | null; residents: MapResident[] };
export type ResidentPosition = { point: MapPoint & { y: number }; seat: number };
export type SeatedResident = { id: string; name: string; seat: number };
export type MapResidentGroup = { key: string; point: MapPoint; residents: MapResident[] };
export type MapLandmark = {
  id: string;
  label: string;
  shortLabel: string;
  point: MapPoint;
  view?: WorldView;
};

// These named pins use world coordinates, unlike the decorative contour art.
// Trail rests have no camera preset, so their pins scout their exact destination.
export const MAP_LANDMARKS: readonly MapLandmark[] = [
  {
    id: 'lookout',
    label: 'Lookout',
    shortLabel: 'L',
    point: { x: LOOKOUT.x, z: LOOKOUT.z },
    view: 'lookout',
  },
  {
    id: 'orchard',
    label: 'Orchard Commons',
    shortLabel: 'O',
    point: { x: ORCHARD.x, z: ORCHARD.z },
    view: 'orchard',
  },
  {
    id: 'observatory',
    label: 'Cedar Observatory',
    shortLabel: 'C',
    point: { x: OBSERVATORY.x, z: OBSERVATORY.z },
    view: 'observatory',
  },
  {
    id: 'mere',
    label: 'Southwind Mere shore',
    shortLabel: 'M',
    point: { x: SOUTHWIND_SHORE.x, z: SOUTHWIND_SHORE.z },
    view: 'mere',
  },
  ...TRAIL_TURNOUTS.map((turnout) => {
    const [x, , z] = turnoutPoint(turnout.trailIndex, turnout.side, 4.8);
    return {
      id: turnout.id,
      label: turnout.label,
      shortLabel: turnout.side < 0 ? 'W' : 'E',
      point: { x, z },
    };
  }),
];

const EMPTY_SNAPSHOT: MapSnapshot = { camera: null, residents: [] };
const listeners = new Set<() => void>();
let snapshot = EMPTY_SNAPSHOT;
let active = false;

// The map covers the same finite x/z area as camera panning. North is -z,
// so minZ is the top edge and maxZ the bottom edge; x increases to the right.
// Percentages make this transform independent of the map's rendered size.
export function worldToMap(point: MapPoint) {
  const { minX, maxX, minZ, maxZ } = CAMERA_PAN_BOUNDS;
  return {
    left: Math.max(0, Math.min(100, ((point.x - minX) / (maxX - minX)) * 100)),
    top: Math.max(0, Math.min(100, ((point.z - minZ) / (maxZ - minZ)) * 100)),
  };
}

export function mapToWorld(point: { left: number; top: number }): MapPoint {
  const { minX, maxX, minZ, maxZ } = CAMERA_PAN_BOUNDS;
  const left = Math.max(0, Math.min(100, point.left)) / 100;
  const top = Math.max(0, Math.min(100, point.top)) / 100;
  return { x: minX + left * (maxX - minX), z: minZ + top * (maxZ - minZ) };
}

export function visibleMapResidents(
  agents: readonly SeatedResident[],
  positions: ReadonlyMap<string, ResidentPosition>,
): MapResident[] {
  const occupied = new Set<number>();
  const result: MapResident[] = [];
  for (const agent of agents) {
    if (agent.seat < 0 || agent.seat >= 8 || occupied.has(agent.seat)) continue;
    const position = positions.get(agent.id);
    // A departing rig can linger during its exit animation. Its former seat
    // must not produce a marker after the assignment has changed.
    if (!position || position.seat !== agent.seat) continue;
    occupied.add(agent.seat);
    result.push({
      id: agent.id,
      name: agent.name,
      seat: agent.seat,
      x: position.point.x,
      z: position.point.z,
    });
    if (result.length === 8) break;
  }
  return result;
}

export function groupNearbyMapResidents(residents: readonly MapResident[]): MapResidentGroup[] {
  const groups: MapResident[][] = [];
  const near = (left: MapResident, right: MapResident) => {
    const a = worldToMap(left);
    const b = worldToMap(right);
    return Math.abs(a.left - b.left) < 9 && Math.abs(a.top - b.top) < 14;
  };
  for (const resident of residents) {
    const connected = groups.filter((group) => group.some((member) => near(member, resident)));
    if (connected.length === 0) {
      groups.push([resident]);
      continue;
    }
    const first = connected[0];
    first.push(resident);
    for (const other of connected.slice(1)) {
      first.push(...other);
      groups.splice(groups.indexOf(other), 1);
    }
  }
  return groups.map((group) => ({
    key: String(Math.min(...group.map((member) => member.seat))),
    point: {
      x: group.reduce((sum, member) => sum + member.x, 0) / group.length,
      z: group.reduce((sum, member) => sum + member.z, 0) / group.length,
    },
    residents: group.sort((a, b) => a.seat - b.seat),
  }));
}

export function mapIsActive() {
  return active;
}

export function activateMap(activeNow: boolean) {
  active = activeNow;
  if (activeNow) publishMapSnapshot(EMPTY_SNAPSHOT);
}

export function subscribeMapSnapshot(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMapSnapshot() {
  return snapshot;
}

export function publishMapSnapshot(next: MapSnapshot) {
  const unchanged =
    snapshot.camera?.x === next.camera?.x &&
    snapshot.camera?.z === next.camera?.z &&
    snapshot.residents.length === next.residents.length &&
    snapshot.residents.every((resident, index) => {
      const other = next.residents[index];
      return (
        resident.id === other.id &&
        resident.name === other.name &&
        resident.seat === other.seat &&
        resident.x === other.x &&
        resident.z === other.z
      );
    });
  if (unchanged) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}
