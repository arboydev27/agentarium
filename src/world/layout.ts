import type { Point } from './motion';

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
  'observatory',
  'horizon',
] as const;
export type WorldView = (typeof WORLD_VIEWS)[number];
export type WorldLocation =
  Exclude<WorldView, 'horizon'> | 'meadow:rest-west' | 'meadow:rest-east' | 'open-landscape';
export const WORLD_VIEW_LABELS: Record<WorldView, string> = {
  overview: 'Overview',
  café: 'Café',
  garden: 'Garden',
  studio: 'Studio',
  courtyard: 'Courtyard',
  lookout: 'Lookout',
  orchard: 'Orchard Commons',
  observatory: 'Cedar Observatory',
  horizon: 'Horizon',
};
export const WORLD_LOCATION_LABELS: Record<WorldLocation, string> = {
  ...WORLD_VIEW_LABELS,
  'meadow:rest-west': 'Western Trail Rest',
  'meadow:rest-east': 'Eastern Trail Rest',
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
    orchard: { pos: [53, 24, -51], look: [ORCHARD.x, 9.7, ORCHARD.z], span: [28, 20] },
    observatory: { pos: [-45, 20, -30], look: [OBSERVATORY.x, 5.5, OBSERVATORY.z], span: [27, 19] },
    horizon: { pos: [0, 12, 35], look: [0, 2, -22], span: [50, 28] },
  };
