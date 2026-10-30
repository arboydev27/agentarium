import type { Point } from './motion';
import { AMBER_BLUFF } from './scenery/amberPlacement';
import { DAWNLIGHT_GLASSHOUSE } from './scenery/dawnlightPlacement';
import { WINDWARD_MILL } from './scenery/windwardPlacement';
import { NORTHSTAR_OUTPOST } from './scenery/northstarPlacement';
import { WOODLAND_HOLLOW } from './scenery/woodlandPlacement';

export const WORLD = { width: 29.25, depth: 22.2 };
// Bounds include the entire walkable floor; y is its top surface.
export const ZONES = {
  café: { center: [-7, 0.68, -4.5] as Point, size: [12, 10], seats: [0, 1] },
  garden: { center: [7, 0.55, 5] as Point, size: [10, 8.4], seats: [2, 3] },
  studio: { center: [7, 1.1, -5] as Point, size: [9.6, 7.6], seats: [4, 5] },
  courtyard: { center: [-6, 0.49, 5.5] as Point, size: [11, 7], seats: [6, 7] },
};
export type ZoneName = keyof typeof ZONES;
export const LOOKOUT = { x: 13.5, z: -38, clearingRadius: 3.2, focusRadius: 7 } as const;
export const ORCHARD = { x: 36, z: -70, clearingRadius: 3.4, focusRadius: 8 } as const;
export const OBSERVATORY = { x: -30, z: -50, clearingRadius: 3.4, focusRadius: 8 } as const;
export const WORLD_VIEWS = [
  'overview',
  'café',
  'garden',
  'studio',
  'courtyard',
  'lookout',
  'orchard',
  'northstar',
  'observatory',
  'hollow',
  'mere',
  'dawnlight',
  'windward',
  'amber',
  'horizon',
] as const;
export type WorldView = (typeof WORLD_VIEWS)[number];
export type WorldLocation =
  | Exclude<WorldView, 'horizon'>
  | 'meadow:rest-west'
  | 'meadow:rest-east'
  | 'western-woods'
  | 'northern-highlands'
  | 'amber-foothills'
  | 'open-landscape';
export const WORLD_VIEW_LABELS: Record<WorldView, string> = {
  overview: 'Overview',
  café: 'Habitat Commons',
  garden: 'Resource Lab',
  studio: 'Research Array',
  courtyard: 'Comms Court',
  lookout: 'Survey Lookout',
  orchard: 'Expedition Base',
  northstar: 'Northstar Spaceport',
  observatory: 'Deep Sky Array',
  hollow: 'Basalt Field Station',
  mere: 'Southwind Crater',
  dawnlight: 'Dawnlight Biolab',
  windward: 'Helios Power Field',
  amber: 'Amber Bluff · scenic only',
  horizon: 'Horizon',
};
export const WORLD_LOCATION_LABELS: Record<WorldLocation, string> = {
  ...WORLD_VIEW_LABELS,
  'meadow:rest-west': 'Western Trail Rest',
  'meadow:rest-east': 'Eastern Trail Rest',
  'western-woods': 'Basalt Flats',
  'northern-highlands': 'Iron Highlands',
  'amber-foothills': 'Amber Foothills',
  'open-landscape': 'Open landscape',
};
export const SEATS: Point[] = [
  [-8.8, 0.68, -2.5],
  [-4.8, 0.68, -2.5],
  [4.5, 0.55, 5.2],
  [8.5, 0.55, 5.2],
  [4.8, 1.1, -4],
  [8.8, 1.1, -4],
  [-8.5, 0.49, 6],
  [-4.5, 0.49, 6],
];
/**
 * A composed shot: the camera sits on `bearing` degrees from the look point
 * (0 = south of it, 90 = east), `pitch` degrees above it. Landmark shots use a
 * low pitch so a foreground, the landmark and the horizon share the frame;
 * the colony shots stay steep so the dollhouse interiors read.
 */
function shot(look: Point, bearing: number, pitch: number, span: [number, number]) {
  const b = (bearing * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  const reach = 40;
  const pos: Point = [
    look[0] + Math.sin(b) * Math.cos(p) * reach,
    look[1] + Math.sin(p) * reach,
    look[2] + Math.cos(b) * Math.cos(p) * reach,
  ];
  return { pos, look, span };
}
export const CAMERA_VIEWS: Record<WorldView, { pos: Point; look: Point; span: [number, number] }> =
  {
    overview: { pos: [27, 26, 35], look: [0, 2.8, 0], span: [40, 32] },
    café: { pos: [-0.5, 12, 11], look: [-7, 2, -4.5], span: [17, 13] },
    garden: { pos: [15, 12, 18], look: [7, 1.8, 5], span: [16, 12] },
    studio: { pos: [15, 12, 9], look: [7, 2.2, -5], span: [16, 12] },
    courtyard: { pos: [1, 11, 18], look: [-6, 1.5, 5.5], span: [16, 12] },
    lookout: shot([LOOKOUT.x, 3.5, LOOKOUT.z], 31, 15, [24, 17]),
    orchard: shot([43, 9.2, -76], 41, 15, [25, 18]),
    northstar: shot(
      [NORTHSTAR_OUTPOST.centerX + 7, 10, NORTHSTAR_OUTPOST.centerZ - 8],
      -118,
      14,
      [32, 24],
    ),
    observatory: shot([OBSERVATORY.x, 4.5, OBSERVATORY.z], -37, 15, [27, 19]),
    hollow: shot([WOODLAND_HOLLOW.x - 3, 2.5, WOODLAND_HOLLOW.z + 1], 45, 15, [28, 20]),
    mere: shot([-48, 1.5, 45], 46, 14, [28, 20]),
    dawnlight: shot(
      [DAWNLIGHT_GLASSHOUSE.centerX + 1, 2.5, DAWNLIGHT_GLASSHOUSE.centerZ + 1],
      42,
      15,
      [27, 19],
    ),
    windward: shot([WINDWARD_MILL.centerX, 4, WINDWARD_MILL.centerZ], -37, 16, [30, 21]),
    amber: shot([AMBER_BLUFF.x, 6, AMBER_BLUFF.z], 32, 15, [34, 24]),
    horizon: { pos: [0, 12, 35], look: [0, 2, -22], span: [50, 28] },
  };
