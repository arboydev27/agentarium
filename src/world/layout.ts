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
export const CAMERA_VIEWS: Record<WorldView, { pos: Point; look: Point; span: [number, number] }> =
  {
    overview: { pos: [27, 26, 35], look: [0, 2.8, 0], span: [40, 32] },
    café: { pos: [-0.5, 12, 11], look: [-7, 2, -4.5], span: [17, 13] },
    garden: { pos: [15, 12, 18], look: [7, 1.8, 5], span: [16, 12] },
    studio: { pos: [15, 12, 9], look: [7, 2.2, -5], span: [16, 12] },
    courtyard: { pos: [1, 11, 18], look: [-6, 1.5, 5.5], span: [16, 12] },
    lookout: { pos: [27, 16, -16], look: [LOOKOUT.x, 4, LOOKOUT.z], span: [24, 17] },
    orchard: { pos: [61, 22, -55], look: [43, 9.7, -76], span: [25, 18] },
    northstar: {
      pos: [NORTHSTAR_OUTPOST.x - 12, 24, NORTHSTAR_OUTPOST.z - 18],
      look: [NORTHSTAR_OUTPOST.centerX + 1, 12, NORTHSTAR_OUTPOST.centerZ - 2],
      span: [32, 24],
    },
    observatory: { pos: [-45, 20, -30], look: [OBSERVATORY.x, 5.5, OBSERVATORY.z], span: [27, 19] },
    hollow: {
      pos: [WOODLAND_HOLLOW.x + 15, 14, WOODLAND_HOLLOW.z + 19],
      look: [WOODLAND_HOLLOW.x - 3, 2, WOODLAND_HOLLOW.z + 1],
      span: [28, 20],
    },
    mere: { pos: [-27, 15, 65], look: [-48, 1.5, 45], span: [28, 20] },
    dawnlight: {
      pos: [63, 18, 48],
      look: [DAWNLIGHT_GLASSHOUSE.centerX + 1, 2, DAWNLIGHT_GLASSHOUSE.centerZ + 1],
      span: [27, 19],
    },
    windward: {
      pos: [57, 20, 1],
      look: [WINDWARD_MILL.centerX, 5, WINDWARD_MILL.centerZ],
      span: [30, 21],
    },
    amber: {
      pos: [-89, 19, 112],
      look: [AMBER_BLUFF.x, 5, AMBER_BLUFF.z],
      span: [34, 24],
    },
    horizon: { pos: [0, 12, 35], look: [0, 2, -22], span: [50, 28] },
  };
