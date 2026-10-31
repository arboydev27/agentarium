import {
  CAMERA_VIEWS,
  LOOKOUT,
  OBSERVATORY,
  ORCHARD,
  ZONES,
  type WorldView,
  type ZoneName,
} from './layout';
import { ROOF_DISH, ROOF_THICKNESS, roofTop, WALL_HEIGHT } from './habitat/habitatLayout';
import type { ResidentPosition } from './mapSnapshot';
import type { Point } from './motion';
import { DESTINATIONS, NODES } from './navigation';
import { AMBER_BLUFF } from './scenery/amberPlacement';
import { BIOLAB_HABITATS, DAWNLIGHT_GLASSHOUSE } from './scenery/dawnlightPlacement';
import { SOUTHWIND_MERE } from './scenery/merePlacement';
import { NORTHSTAR_OUTPOST, NORTHSTAR_TOWER_XZ } from './scenery/northstarPlacement';
import { REFERENCE_HABITAT } from './scenery/referenceHabitatPlacement';
import { SOUTHWIND_SHORE } from './scenery/southwindTrailPlacement';
import { WINDWARD_MILL } from './scenery/windwardPlacement';
import { WOODLAND_HOLLOW, WOODLAND_SHELTER_XZ } from './scenery/woodlandPlacement';
import { terrainHeight } from './terrain';

// Places you can click. Every proxy is derived from the layout and placement
// constants the scenery itself uses, so there is no second set of coordinates
// to drift. The proxies live on a layer the camera never renders; only the
// raycaster sees them, and residents stay the only selectable actors.

/** Object layer for the pick proxies: tested by the raycaster, excluded from every camera. */
export const PLACE_LAYER = 1;

export type PlaceKind = 'module' | 'landmark' | 'machine' | 'scenic';
export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  module: 'Habitat module',
  landmark: 'Landmark',
  machine: 'Machine',
  scenic: 'Scenic formation',
};

export type PlaceShape =
  | {
      kind: 'box';
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
      /** Bottom of the proxy volume. */
      y: number;
      height: number;
    }
  | { kind: 'disc'; x: number; z: number; radius: number; y: number; height: number };

type PlaceSpec = {
  id: string;
  name: string;
  kind: PlaceKind;
  /** Camera preset that frames the place; machines borrow their parent's. */
  view?: WorldView;
  /** The enclosing place, for machines that stand inside a landmark or module. */
  parent?: string;
  role: string;
  does: string;
  shapes: readonly PlaceShape[];
  /** Ground point the camera travels to when the place has no preset. */
  focus: { x: number; z: number };
  /** Height of the hover tag above the focus point's ground. */
  tagHeight: number;
  seats?: readonly number[];
};

export type Place = PlaceSpec & {
  seats: readonly number[];
  /** Footprint in square metres; the smallest hit wins a click. */
  area: number;
  /** Rest-spot labels of the authored destinations inside the place. */
  spots: readonly string[];
  destinations: readonly string[];
  /** World anchor of the hover tag. */
  anchor: Point;
};

export function shapeContains(shape: PlaceShape, x: number, z: number) {
  return shape.kind === 'box'
    ? x >= shape.minX && x <= shape.maxX && z >= shape.minZ && z <= shape.maxZ
    : Math.hypot(x - shape.x, z - shape.z) <= shape.radius;
}
export function placeContains(place: Pick<Place, 'shapes'>, x: number, z: number) {
  return place.shapes.some((shape) => shapeContains(shape, x, z));
}
function shapeArea(shape: PlaceShape) {
  return shape.kind === 'box'
    ? (shape.maxX - shape.minX) * (shape.maxZ - shape.minZ)
    : Math.PI * shape.radius * shape.radius;
}

function moduleShape(zone: ZoneName): PlaceShape {
  const {
    center: [cx, y, cz],
    size: [w, d],
  } = ZONES[zone];
  return {
    kind: 'box',
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minZ: cz - d / 2,
    maxZ: cz + d / 2,
    y: y - 0.6,
    height: WALL_HEIGHT + ROOF_THICKNESS + 1.2,
  };
}
/** A cylinder on the terrain, reaching `below` metres under and `above` metres over the ground. */
function disc(x: number, z: number, radius: number, below = 4, above = 10): PlaceShape {
  const ground = terrainHeight(x, z);
  return { kind: 'disc', x, z, radius, y: ground - below, height: below + above };
}
function module(zone: ZoneName, name: string, role: string, does: string): PlaceSpec {
  const [cx, , cz] = ZONES[zone].center;
  return {
    id: zone,
    name,
    kind: 'module',
    view: zone,
    role,
    does,
    shapes: [moduleShape(zone)],
    focus: { x: cx, z: cz },
    tagHeight: 0,
    seats: ZONES[zone].seats,
  };
}

const SPECS: readonly PlaceSpec[] = [
  module(
    'café',
    'Habitat Commons',
    'The colony’s shared module: galley, lockers and two workstations under one roof.',
    'Residents work at the two desks, take breaks at the service station and look out from the viewport on the north wall.',
  ),
  module(
    'garden',
    'Resource Lab',
    'Planters, processing tanks and the open sampling terrace outside the south door.',
    'Residents work at the two desks, scan samples and rest on the terrace.',
  ),
  module(
    'studio',
    'Research Array',
    'The raised research deck: server racks, the sample cabinet and two desks.',
    'Residents work at the two desks and take breaks on the research terrace by the airlock.',
  ),
  module(
    'courtyard',
    'Comms Court',
    'Signal console, a rest bench and the communications dish on the roof.',
    'Residents work at the two desks, sit at the rest station and check the signal console.',
  ),
  {
    id: 'lookout',
    name: 'Survey Lookout',
    kind: 'landmark',
    view: 'lookout',
    role: 'A sensor clearing on the northern trail: survey console, two masts and the lattice relay.',
    does: 'Residents walk up the trail to survey the sky from the console.',
    shapes: [disc(LOOKOUT.x, LOOKOUT.z, LOOKOUT.focusRadius)],
    focus: { x: LOOKOUT.x, z: LOOKOUT.z },
    tagHeight: 4,
  },
  {
    id: 'orchard',
    name: 'Expedition Base',
    kind: 'landmark',
    view: 'orchard',
    role: 'The reference habitat on its raft, solar racks and a sensor mast at the end of the northern trail.',
    does: 'Residents visit the base to take in the view across the plains.',
    shapes: [
      disc(ORCHARD.x, ORCHARD.z, ORCHARD.focusRadius),
      disc(REFERENCE_HABITAT.x, REFERENCE_HABITAT.z, 8),
    ],
    focus: { x: REFERENCE_HABITAT.x, z: REFERENCE_HABITAT.z },
    tagHeight: 5,
  },
  {
    id: 'northstar',
    name: 'Northstar Spaceport',
    kind: 'landmark',
    view: 'northstar',
    role: 'Launchpad with beacons, gantry and the survey rocket, a control cabin, the fuel farm and a patrolling rover.',
    does: 'Residents survey the sky from the pad. The flight cycle and the rover are decorative and report nothing about any agent.',
    shapes: [
      disc(NORTHSTAR_OUTPOST.centerX, NORTHSTAR_OUTPOST.centerZ, NORTHSTAR_OUTPOST.focusRadius),
      disc(NORTHSTAR_TOWER_XZ[0], NORTHSTAR_TOWER_XZ[1], 12, 4, 16),
    ],
    focus: { x: NORTHSTAR_TOWER_XZ[0], z: NORTHSTAR_TOWER_XZ[1] },
    tagHeight: 6,
  },
  {
    id: 'observatory',
    name: 'Deep Sky Array',
    kind: 'landmark',
    view: 'observatory',
    role: 'A telescope terrace with a sensor-mast fringe on the western meadow.',
    does: 'Residents survey the sky from the terrace.',
    shapes: [disc(OBSERVATORY.x, OBSERVATORY.z, OBSERVATORY.focusRadius)],
    focus: { x: OBSERVATORY.x, z: OBSERVATORY.z },
    tagHeight: 4,
  },
  {
    id: 'hollow',
    name: 'Basalt Field Station',
    kind: 'landmark',
    view: 'hollow',
    role: 'An outpost habitat, solar rack and mast at the end of the woodland spur.',
    does: 'Residents walk the long western spur to take in the view from the station.',
    shapes: [
      disc(WOODLAND_HOLLOW.x, WOODLAND_HOLLOW.z, WOODLAND_HOLLOW.focusRadius),
      disc(WOODLAND_SHELTER_XZ[0], WOODLAND_SHELTER_XZ[1], 6),
    ],
    focus: { x: WOODLAND_SHELTER_XZ[0], z: WOODLAND_SHELTER_XZ[1] },
    tagHeight: 4.5,
  },
  {
    id: 'mere',
    name: 'Southwind Crater',
    kind: 'landmark',
    view: 'mere',
    role: 'A dry mineral basin south-west of the colony, with a sampling station on its rim.',
    does: 'Residents scan samples at the crater rim.',
    shapes: [
      disc(SOUTHWIND_SHORE.x, SOUTHWIND_SHORE.z, SOUTHWIND_SHORE.focusRadius),
      disc(SOUTHWIND_MERE.x, SOUTHWIND_MERE.z, SOUTHWIND_MERE.waterRadius + 2, 6, 6),
    ],
    focus: { x: SOUTHWIND_SHORE.x, z: SOUTHWIND_SHORE.z },
    tagHeight: 3,
  },
  {
    id: 'dawnlight',
    name: 'Dawnlight Biolab',
    kind: 'landmark',
    view: 'dawnlight',
    role: 'Two outpost habitats, the biolab and the culture vault, north of the eastern trail.',
    does: 'Residents scan samples at the biolab.',
    shapes: [
      disc(
        DAWNLIGHT_GLASSHOUSE.centerX,
        DAWNLIGHT_GLASSHOUSE.centerZ,
        DAWNLIGHT_GLASSHOUSE.focusRadius,
      ),
      ...BIOLAB_HABITATS.map((habitat) => disc(habitat.x, habitat.z, 5)),
    ],
    focus: { x: BIOLAB_HABITATS[0].x, z: BIOLAB_HABITATS[0].z },
    tagHeight: 4.5,
  },
  {
    id: 'windward',
    name: 'Helios Power Field',
    kind: 'landmark',
    view: 'windward',
    role: 'A habitat beside six solar racks, the tallest mast in the colony and a rover that inspects the field.',
    does: 'Residents walk the north-eastern branch to take in the view from the field. The rover’s inspection loop is decorative.',
    shapes: [
      disc(WINDWARD_MILL.centerX, WINDWARD_MILL.centerZ, WINDWARD_MILL.focusRadius),
      {
        kind: 'box',
        minX: WINDWARD_MILL.centerX - 16,
        maxX: WINDWARD_MILL.centerX - 5,
        minZ: WINDWARD_MILL.centerZ - 8,
        maxZ: WINDWARD_MILL.centerZ + 7,
        y: terrainHeight(WINDWARD_MILL.centerX - 10, WINDWARD_MILL.centerZ) - 4,
        height: 10,
      },
    ],
    focus: { x: WINDWARD_MILL.centerX, z: WINDWARD_MILL.centerZ },
    tagHeight: 4.5,
  },
  {
    id: 'amber',
    name: 'Amber Bluff',
    kind: 'scenic',
    view: 'amber',
    role: 'A stratified rock formation on the western horizon.',
    does: 'Scenic only. No resident route leads here.',
    shapes: [disc(AMBER_BLUFF.x, AMBER_BLUFF.z, AMBER_BLUFF.footprintRadius, 6, 18)],
    focus: { x: AMBER_BLUFF.x, z: AMBER_BLUFF.z },
    tagHeight: 12,
  },
  {
    id: 'northstar:rocket',
    name: 'Survey rocket',
    kind: 'machine',
    view: 'northstar',
    parent: 'northstar',
    role: 'The survey rocket on its pad beside the gantry.',
    does: 'Its ignition, climb and reset every ninety seconds are decorative and say nothing about any agent.',
    shapes: [disc(NORTHSTAR_TOWER_XZ[0], NORTHSTAR_TOWER_XZ[1], 2.4, 1, 13)],
    focus: { x: NORTHSTAR_TOWER_XZ[0], z: NORTHSTAR_TOWER_XZ[1] },
    tagHeight: 9,
  },
  {
    id: 'courtyard:dish',
    name: 'Communications dish',
    kind: 'machine',
    view: 'courtyard',
    parent: 'courtyard',
    role: 'The dish on the Comms Court roof. It tracks slowly across the sky, swings back and re-acquires.',
    does: 'Decorative. Live telemetry reaches the colony through the local bridge, not through the dish.',
    shapes: [
      {
        kind: 'disc',
        x: ROOF_DISH.x,
        z: ROOF_DISH.z,
        radius: 2.2,
        y: roofTop(ROOF_DISH.zone) + 0.4,
        height: 3.2,
      },
    ],
    focus: { x: ROOF_DISH.x, z: ROOF_DISH.z },
    tagHeight: 0,
  },
  {
    id: 'observatory:telescope',
    name: 'Deep sky telescope',
    kind: 'machine',
    view: 'observatory',
    parent: 'observatory',
    role: 'The brass telescope under its half-ring on the array terrace. It dwells on a target, then slews to the next.',
    does: 'Decorative. Residents survey the sky beside it; its targets are a schedule, not data.',
    shapes: [disc(OBSERVATORY.x - 1.25, OBSERVATORY.z - 1.55, 2.7, 0.5, 3.6)],
    focus: { x: OBSERVATORY.x - 1.25, z: OBSERVATORY.z - 1.55 },
    tagHeight: 3.2,
  },
];

function build(spec: PlaceSpec): Place {
  const destinations =
    spec.kind === 'machine'
      ? []
      : DESTINATIONS.filter((destination) => {
          const node = NODES[destination.node];
          return !!node && placeContains(spec, node[0], node[2]);
        });
  const [x, z] = [spec.focus.x, spec.focus.z];
  const ground =
    spec.kind === 'module'
      ? roofTop(spec.id as ZoneName) + 1
      : spec.id === 'courtyard:dish'
        ? roofTop(ROOF_DISH.zone) + 3.4
        : terrainHeight(x, z);
  return {
    ...spec,
    seats: spec.seats ?? [],
    area: spec.shapes.reduce((sum, shape) => sum + shapeArea(shape), 0),
    spots: [...new Set(destinations.map((destination) => destination.label))],
    destinations: destinations.map((destination) => destination.id),
    anchor: [x, ground + spec.tagHeight, z],
  };
}

export const PLACES: readonly Place[] = SPECS.map(build);
const BY_ID = new Map(PLACES.map((place) => [place.id, place]));

export function placeById(id: string | null | undefined): Place | undefined {
  return id ? BY_ID.get(id) : undefined;
}
/** The place a camera preset frames, if the preset looks at one (Horizon does not). */
export function placeForView(view: WorldView): Place | undefined {
  return PLACES.find((place) => place.kind !== 'machine' && place.view === view);
}
/** Of the proxies under the pointer, the most specific one: a machine before the landmark around it. */
export function pickPlace(ids: Iterable<string>): Place | null {
  let best: Place | null = null;
  for (const id of ids) {
    const place = BY_ID.get(id);
    if (place && (!best || place.area < best.area)) best = place;
  }
  return best;
}
/** True when a camera preset already frames the place as authored. */
export function cameraAtPlace(
  place: Place,
  camera: { view: WorldView; customized: boolean; following: boolean },
) {
  return !!place.view && camera.view === place.view && !camera.customized && !camera.following;
}
/** Hover tags answer the pointer only: never in watch mode, and not for the place already open. */
export function placeTagVisible(state: {
  hovered: string | null;
  open: string | null;
  watchMode: boolean;
}) {
  return !!state.hovered && !state.watchMode && state.hovered !== state.open;
}

export type PlaceResident = {
  id: string;
  name: string;
  seat: number;
  /** The character's visual activity, not a report from the agent. */
  activity: string;
  /** Standing inside the place right now. */
  here: boolean;
  /** Has a desk in the place. */
  based: boolean;
};

/** Residents inside the place or based at one of its desks, present ones first. */
export function placeResidents(
  place: Pick<Place, 'shapes' | 'seats' | 'kind'>,
  agents: readonly { id: string; name: string; seat: number }[],
  positions: ReadonlyMap<string, ResidentPosition>,
): PlaceResident[] {
  if (place.kind === 'machine') return [];
  const result: PlaceResident[] = [];
  for (const agent of agents) {
    if (agent.seat < 0 || agent.seat >= 8) continue;
    const position = positions.get(agent.id);
    if (!position || position.seat !== agent.seat) continue;
    const here = placeContains(place, position.point.x, position.point.z);
    const based = place.seats.includes(agent.seat);
    if (!here && !based) continue;
    result.push({
      id: agent.id,
      name: agent.name,
      seat: agent.seat,
      activity: position.activity ?? 'Near desk',
      here,
      based,
    });
  }
  return result.sort((a, b) => Number(b.here) - Number(a.here) || a.seat - b.seat);
}

// Who is at the open place is published from the render loop at most four times
// a second, like the map snapshot, so the pane never subscribes to per-frame state.
const EMPTY: readonly PlaceResident[] = [];
const listeners = new Set<() => void>();
let residents: readonly PlaceResident[] = EMPTY;
export function subscribePlaceResidents(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getPlaceResidents() {
  return residents;
}
export function publishPlaceResidents(next: readonly PlaceResident[]) {
  const unchanged =
    next.length === residents.length &&
    next.every((entry, index) => {
      const other = residents[index];
      return (
        entry.id === other.id &&
        entry.name === other.name &&
        entry.activity === other.activity &&
        entry.here === other.here &&
        entry.based === other.based
      );
    });
  if (unchanged) return;
  residents = next.length === 0 ? EMPTY : next;
  listeners.forEach((listener) => listener());
}
