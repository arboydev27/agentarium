import { SEATS, ZONES, type ZoneName } from '../layout';
import type { Point } from '../motion';
import { NODES } from '../navigation';
import type { WorldKitModule } from '../scenery/WorldKit';

// Pressurized modules enclose the existing colony decks. Every wall tile keeps
// its interior face on the deck edge, so the walkable floor, seats, door nodes
// and route graph are unchanged; only the airlocks interrupt the wall line.

export type Side = 'north' | 'south' | 'east' | 'west';
export const SIDES: readonly Side[] = ['north', 'south', 'east', 'west'];
export const ZONE_NAMES = Object.keys(ZONES) as ZoneName[];

export type Placement = {
  module: WorldKitModule;
  position: Point;
  rotationY: number;
  scale: [number, number, number];
};
export type ShellPart =
  'wall' | 'glass' | 'corner' | 'roof' | 'airlock' | 'radiator' | 'roof-radiator';
export type ShellPlacement = Placement & { zone: ZoneName; part: ShellPart; side?: Side };

/** Authored tile width in metres; runs are scaled between 0.8 and 1.05 of it. */
export const TILE = 2;
const MAX_TILE = 2.1;
export const WALL_HEIGHT = 3.2;
export const ROOF_THICKNESS = 0.22;
export const WALL_EXTERIOR = 0.3;
export const CORNER_OFFSET = 0.1;

export type OpeningKind = 'airlock' | 'gate' | 'flush';
export const OPENING_WIDTH: Record<OpeningKind, number> = { airlock: 2, gate: 3.2, flush: 2 };
export const OPENING_CLEAR: Record<OpeningKind, number> = { airlock: 1.3, gate: 2.4, flush: 1.3 };
/** How far each housing stands proud of the wall line. */
export const OPENING_DEPTH: Record<OpeningKind, number> = { airlock: 0.6, gate: 0.5, flush: 0.25 };
export type OpeningModule = 'hab-airlock' | 'hab-gate' | 'hab-airlock-flush';
export const OPENING_MODULE: Record<OpeningKind, OpeningModule> = {
  airlock: 'hab-airlock',
  gate: 'hab-gate',
  flush: 'hab-airlock-flush',
};

export type Opening = { side: Side; at: number; kind: OpeningKind };
type GlassSpec = Partial<Record<Side, 'all' | readonly (readonly [number, number])[]>>;
export type HabitatSpec = {
  title: string;
  openings: readonly Opening[];
  glass: GlassSpec;
  /** Service sides that carry exterior radiators. */
  radiators: readonly Side[];
};

// Glazing faces +X and +Z, where the authored cameras look in from. The café's
// north wall keeps one window beside the "habitat viewport" rest spot.
export const HABITATS: Record<ZoneName, HabitatSpec> = {
  café: {
    title: 'HABITAT COMMONS',
    openings: [{ side: 'south', at: -6.8, kind: 'airlock' }],
    glass: { south: 'all', east: 'all', north: [[-3.8, -1.0]] },
    radiators: ['west', 'north'],
  },
  garden: {
    title: 'RESOURCE LAB',
    // The Dawnlight trail crosses the deck's southern strip, so the lab stops
    // short of it: a south door opens onto the open sampling terrace where the
    // resource-lab rest spots stay. Both doors are flush units because the
    // concourse lane and the terrace chords pass close to the wall.
    openings: [
      { side: 'north', at: 6.8, kind: 'flush' },
      { side: 'south', at: 6.8, kind: 'flush' },
    ],
    glass: { south: 'all', east: 'all' },
    radiators: ['west', 'north'],
  },
  studio: {
    title: 'RESEARCH ARRAY',
    openings: [{ side: 'south', at: 6.8, kind: 'airlock' }],
    glass: { south: 'all', east: 'all' },
    radiators: ['west', 'north'],
  },
  courtyard: {
    title: 'COMMS COURT',
    // The Southwind trail leaves through a wider gate in the south wall.
    openings: [
      { side: 'north', at: -6.8, kind: 'airlock' },
      { side: 'south', at: -8.5, kind: 'gate' },
    ],
    glass: { south: 'all', east: 'all' },
    radiators: ['west', 'north'],
  },
};

// Where shared paths run tight against a deck, the wall steps back from the deck
// edge so a walking body (0.45 m radius; concourse lane at z 0.85, promenade at
// x 0.1, Dawnlight trail across the lab deck) clears the exterior ribs and the
// airlock housings. The uncovered deck reads as an apron or terrace outside.
// A negative inset pushes the wall past the deck edge (the Research Array's
// door-to-terrace chord hugs its south edge); `apronSlabs` floors that strip.
export const INSETS: Record<ZoneName, Partial<Record<Side, number>>> = {
  café: { south: 0.8 },
  garden: { north: 0.9, south: 3.0 },
  studio: { south: -0.6 },
  courtyard: { east: 0.3 },
};

export type Footprint = { minX: number; maxX: number; minZ: number; maxZ: number; y: number };

/** The enclosed rectangle: the deck bounds less any wall insets. */
export function footprint(zone: ZoneName): Footprint {
  const {
    center: [cx, y, cz],
    size: [w, d],
  } = ZONES[zone];
  const inset = INSETS[zone];
  return {
    minX: cx - w / 2 + (inset.west ?? 0),
    maxX: cx + w / 2 - (inset.east ?? 0),
    minZ: cz - d / 2 + (inset.north ?? 0),
    maxZ: cz + d / 2 - (inset.south ?? 0),
    y,
  };
}

export type SideFrame = {
  /** Start and end of the wall along its own axis (x for north/south, z for east/west). */
  from: number;
  to: number;
  /** Fixed coordinate of the wall line (the deck edge). */
  line: number;
  rotationY: number;
  y: number;
  outward: [number, number];
};

export function sideFrame(zone: ZoneName, side: Side): SideFrame {
  const { minX, maxX, minZ, maxZ, y } = footprint(zone);
  switch (side) {
    case 'south':
      return { from: minX, to: maxX, line: maxZ, rotationY: 0, y, outward: [0, 1] };
    case 'north':
      return { from: minX, to: maxX, line: minZ, rotationY: Math.PI, y, outward: [0, -1] };
    case 'east':
      return { from: minZ, to: maxZ, line: maxX, rotationY: Math.PI / 2, y, outward: [1, 0] };
    case 'west':
      return { from: minZ, to: maxZ, line: minX, rotationY: -Math.PI / 2, y, outward: [-1, 0] };
  }
}

/** World x/z of a point `along` a side, `offset` metres outward from the wall line. */
export function pointOnSide(
  side: Side,
  frame: SideFrame,
  along: number,
  offset = 0,
): [number, number] {
  const line = frame.line + offset * (frame.outward[0] || frame.outward[1]);
  return side === 'north' || side === 'south' ? [along, line] : [line, along];
}

export type Segment = { center: number; scale: number };

/** Splits a run into equal tiles no wider than MAX_TILE; empty for gaps too narrow to build. */
export function splitRun(from: number, to: number): Segment[] {
  const length = to - from;
  if (length < 0.3) return [];
  const count = Math.max(1, Math.ceil(length / MAX_TILE));
  const width = length / count;
  return Array.from({ length: count }, (_, i) => ({
    center: from + width * (i + 0.5),
    scale: width / TILE,
  }));
}

export type SideSegment = Segment & { module: 'hab-wall' | 'hab-glass' | OpeningModule };

export function sideSegments(zone: ZoneName, side: Side): SideSegment[] {
  const frame = sideFrame(zone, side);
  const spec = HABITATS[zone];
  const glass = spec.glass[side];
  const glazed = (center: number) =>
    glass === 'all' || (!!glass && glass.some(([a, b]) => center >= a && center <= b));
  const fill = (from: number, to: number): SideSegment[] =>
    splitRun(from, to).map((segment) => ({
      ...segment,
      module: glazed(segment.center) ? 'hab-glass' : 'hab-wall',
    }));
  const openings = spec.openings
    .filter((opening) => opening.side === side)
    .sort((a, b) => a.at - b.at);
  const segments: SideSegment[] = [];
  let cursor = frame.from;
  for (const opening of openings) {
    const half = OPENING_WIDTH[opening.kind] / 2;
    segments.push(...fill(cursor, opening.at - half));
    segments.push({ center: opening.at, scale: 1, module: OPENING_MODULE[opening.kind] });
    cursor = opening.at + half;
  }
  segments.push(...fill(cursor, frame.to));
  return segments;
}

export function shellPlacements(zone: ZoneName): ShellPlacement[] {
  const { minX, maxX, minZ, maxZ, y } = footprint(zone);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const out: ShellPlacement[] = [];
  for (const side of SIDES) {
    const frame = sideFrame(zone, side);
    const segments = sideSegments(zone, side);
    for (const segment of segments) {
      const [x, z] = pointOnSide(side, frame, segment.center);
      const part: ShellPart =
        segment.module === 'hab-wall'
          ? 'wall'
          : segment.module === 'hab-glass'
            ? 'glass'
            : 'airlock';
      out.push({
        zone,
        side,
        part,
        module: segment.module,
        position: [x, y, z],
        rotationY: frame.rotationY,
        scale: [segment.scale, 1, 1],
      });
    }
    if (HABITATS[zone].radiators.includes(side)) {
      // Hang radiators on the opaque tiles nearest each end, away from the corners.
      const walls = segments.filter((segment) => segment.module === 'hab-wall');
      const picks =
        walls.length > 3
          ? [walls[1], walls[walls.length - 2]]
          : walls.length > 1
            ? [walls[0], walls[walls.length - 1]]
            : walls;
      for (const wall of picks) {
        const [x, z] = pointOnSide(side, frame, wall.center, WALL_EXTERIOR);
        out.push({
          zone,
          side,
          part: 'radiator',
          module: 'hab-radiator',
          position: [x, y + 1.3, z],
          rotationY: frame.rotationY,
          scale: [1, 1, 1],
        });
      }
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      out.push({
        zone,
        part: 'corner',
        module: 'hab-corner',
        position: [cx + sx * (w / 2 + CORNER_OFFSET), y, cz + sz * (d / 2 + CORNER_OFFSET)],
        rotationY: 0,
        scale: [1, 1, 1],
      });
    }
  }
  const columns = splitRun(cx - w / 2, cx + w / 2);
  const rows = splitRun(cz - d / 2, cz + d / 2);
  for (const column of columns) {
    for (const row of rows) {
      out.push({
        zone,
        part: 'roof',
        module: 'hab-roof',
        position: [column.center, y + WALL_HEIGHT, row.center],
        rotationY: 0,
        scale: [column.scale, 1, row.scale],
      });
    }
  }
  // Standing radiators on the roof, facing the glazed side so they read from the cameras.
  for (const sx of [-1, 1]) {
    out.push({
      zone,
      part: 'roof-radiator',
      module: 'hab-radiator',
      position: [cx + sx * w * 0.3, y + WALL_HEIGHT + ROOF_THICKNESS, cz - d * 0.2],
      rotationY: 0,
      scale: [1, 1, 1],
    });
  }
  return out;
}

export type ApronSlab = { x: number; z: number; w: number; d: number; y: number };

/** Floor slabs between a deck edge and a wall that stands outside it, split at the openings. */
export function apronSlabs(zone: ZoneName): ApronSlab[] {
  const {
    center: [cx, y, cz],
    size: [w, d],
  } = ZONES[zone];
  const slabs: ApronSlab[] = [];
  for (const side of SIDES) {
    const inset = INSETS[zone][side] ?? 0;
    if (inset >= 0) continue;
    const frame = sideFrame(zone, side);
    const edge =
      side === 'south'
        ? cz + d / 2
        : side === 'north'
          ? cz - d / 2
          : side === 'east'
            ? cx + w / 2
            : cx - w / 2;
    const across = (edge + frame.line) / 2;
    const depth = Math.abs(frame.line - edge);
    const openings = HABITATS[zone].openings
      .filter((opening) => opening.side === side)
      .sort((a, b) => a.at - b.at);
    let cursor = frame.from;
    const push = (from: number, to: number) => {
      if (to - from < 0.05) return;
      const along = (from + to) / 2;
      const [x, z] = pointOnSide(side, frame, along);
      const isX = side === 'north' || side === 'south';
      slabs.push({
        x: isX ? x : across,
        z: isX ? across : z,
        w: isX ? to - from : depth,
        d: isX ? depth : to - from,
        y,
      });
    };
    for (const opening of openings) {
      const half = OPENING_CLEAR[opening.kind] / 2;
      push(cursor, opening.at - half);
      cursor = opening.at + half;
    }
    push(cursor, frame.to);
  }
  return slabs;
}

export type DoorPlacement = Opening & {
  zone: ZoneName;
  title: string;
  position: Point;
  rotationY: number;
  /** Chord the residents walk, from the outside node up to the floor, that the ramp follows. */
  ramp?: { from: Point; to: Point; width: number };
};

// Route chords that cross each opening; the ramp follows them exactly so the
// characters' feet stay on its surface. `inside` clips a long chord to start
// just inside the wall line.
const RAMPS: Record<
  ZoneName,
  Partial<Record<Side, { from: string; to: string; inside?: number }>>
> = {
  café: { south: { from: 'west', to: 'cafe-door' } },
  garden: { north: { from: 'east', to: 'garden-door' } },
  studio: { south: { from: 'studio-step0', to: 'studio-door' } },
  courtyard: {
    north: { from: 'west', to: 'court-door' },
    south: { from: 'court-front', to: 'southwind:trail-1', inside: 0.3 },
  },
};

export function doorPlacements(zone: ZoneName): DoorPlacement[] {
  return HABITATS[zone].openings.map((opening) => {
    const frame = sideFrame(zone, opening.side);
    const [x, z] = pointOnSide(opening.side, frame, opening.at);
    const chord = RAMPS[zone][opening.side];
    let ramp: DoorPlacement['ramp'];
    if (chord) {
      const to = NODES[chord.to];
      let from = NODES[chord.from];
      if (chord.inside !== undefined) {
        // Parameter along the chord where it sits `inside` metres before the wall line.
        const axis = opening.side === 'north' || opening.side === 'south' ? 2 : 0;
        const target = frame.line - frame.outward[axis === 2 ? 1 : 0] * chord.inside;
        const t = (target - from[axis]) / (to[axis] - from[axis]);
        from = [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * t) as Point;
      }
      ramp = { from, to, width: OPENING_CLEAR[opening.kind] - 0.2 };
    }
    return {
      ...opening,
      zone,
      title: HABITATS[zone].title,
      position: [x, frame.y, z],
      rotationY: frame.rotationY,
      ramp,
    };
  });
}

export type PropPlacement = {
  module: WorldKitModule;
  zone: ZoneName;
  x: number;
  z: number;
  turn: number;
};

// Interior furnishing per module. Fronts face into the room; everything stays
// clear of seats, desk approaches and the authored rest spots (verified by test).
export const HABITAT_PROPS: readonly PropPlacement[] = [
  { module: 'hab-galley', zone: 'café', x: -12.0, z: -6.15, turn: Math.PI / 2 },
  { module: 'hab-locker', zone: 'café', x: -12.45, z: -3.2, turn: Math.PI / 2 },
  { module: 'hab-locker', zone: 'café', x: -12.45, z: -1.9, turn: Math.PI / 2 },
  { module: 'hab-crate', zone: 'café', x: -2.1, z: -0.95, turn: 0.3 },
  { module: 'hab-crate', zone: 'café', x: -2.9, z: -1.7, turn: -0.2 },
  { module: 'hab-rack', zone: 'studio', x: 4.2, z: -8.3, turn: 0 },
  { module: 'hab-rack', zone: 'studio', x: 4.9, z: -8.3, turn: 0 },
  { module: 'hab-rack', zone: 'studio', x: 5.6, z: -8.3, turn: 0 },
  { module: 'hab-rack', zone: 'studio', x: 9.5, z: -8.3, turn: 0 },
  { module: 'hab-rack', zone: 'studio', x: 10.2, z: -8.3, turn: 0 },
  { module: 'sample-cabinet', zone: 'studio', x: 3.0, z: -7.6, turn: 0 },
  { module: 'hab-crate', zone: 'studio', x: 10.9, z: -2.1, turn: 0.4 },
  { module: 'hab-planter', zone: 'garden', x: 2.4, z: 3.3, turn: Math.PI / 2 },
  { module: 'hab-planter', zone: 'garden', x: 2.4, z: 5.1, turn: Math.PI / 2 },
  { module: 'hab-planter', zone: 'garden', x: 11.55, z: 4.0, turn: -Math.PI / 2 },
  { module: 'hab-locker', zone: 'garden', x: 4.0, z: 2.1, turn: 0 },
  { module: 'hab-crate', zone: 'garden', x: 11.3, z: 2.4, turn: 0.2 },
  { module: 'survey-console', zone: 'courtyard', x: -1.5, z: 4.6, turn: Math.PI / 2 },
  { module: 'hab-locker', zone: 'courtyard', x: -11.2, z: 6.3, turn: Math.PI / 2 },
  { module: 'hab-crate', zone: 'courtyard', x: -10.9, z: 8.3, turn: 0.5 },
];

/** Exterior hardware: on the terrain beside the service walls, and on the lab's open terrace. */
export const YARD_PROPS: readonly {
  module: WorldKitModule;
  x: number;
  z: number;
  turn: number;
  /** Deck height when the prop stands on a deck instead of the terrain. */
  y?: number;
}[] = [
  { module: 'resource-tank', x: -14.1, z: -4.2, turn: Math.PI },
  { module: 'resource-tank', x: -14.1, z: -5.4, turn: Math.PI },
  { module: 'hab-crate', x: -14.3, z: -7.4, turn: 0.4 },
  { module: 'resource-tank', x: 11.3, z: 8.4, turn: 0, y: ZONES.garden.center[1] },
];

/** The dish moves from the court floor to its roof; both fade together in the dollhouse view. */
export const ROOF_DISH = { zone: 'courtyard' as ZoneName, x: -1.5, z: 8.1 };

export function propPlacement(prop: PropPlacement): Placement {
  return {
    module: prop.module,
    position: [prop.x, ZONES[prop.zone].center[1], prop.z],
    rotationY: prop.turn,
    scale: [1, 1, 1],
  };
}

export function roofTop(zone: ZoneName) {
  return ZONES[zone].center[1] + WALL_HEIGHT + ROOF_THICKNESS;
}

/** Zone whose deck holds this seat, if it is one of the eight visible desks. */
export function zoneOfSeat(seat: number): ZoneName | undefined {
  return ZONE_NAMES.find((zone) => ZONES[zone].seats.includes(seat));
}

/** Every kit placement the habitats add to the scene, for clearance and bounds tests. */
export function habitatPlacements(): (Placement & { zone?: ZoneName; part?: ShellPart })[] {
  return [
    ...ZONE_NAMES.flatMap((zone) => shellPlacements(zone)),
    ...HABITAT_PROPS.map((prop) => ({ ...propPlacement(prop), zone: prop.zone })),
    {
      module: 'communications-dish',
      position: [ROOF_DISH.x, roofTop(ROOF_DISH.zone), ROOF_DISH.z],
      rotationY: 0,
      scale: [1, 1, 1],
      zone: ROOF_DISH.zone,
    },
  ];
}

export { SEATS };
