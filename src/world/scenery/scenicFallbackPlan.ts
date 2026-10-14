import type { ScenicRegionId } from '../scenicVisibility';
import { LOOKOUT, OBSERVATORY } from '../layout';
import { ORCHARD_PAVILION } from './orchardPlacement';
import { AMBER_BLUFF } from './amberPlacement';
import { DAWNLIGHT_GLASSHOUSE } from './dawnlightPlacement';
import { WINDWARD_MILL } from './windwardPlacement';
import { WOODLAND_SHELTER_XZ } from './woodlandPlacement';
import { NORTHSTAR_TOWER_XZ } from './northstarPlacement';
import { SLATE_REACH } from './slatePlacement';

export type FallbackShape = 'box' | 'cylinder' | 'cone';
export type FallbackTone = 'wood' | 'green' | 'stone' | 'amber' | 'brass' | 'clay';
type Triple = [number, number, number];
export type FallbackPart = Readonly<{
  shape: FallbackShape;
  tone: FallbackTone;
  position: Triple;
  scale: Triple;
  rotation?: Triple;
}>;
export type ScenicFallbackPlan = Readonly<{
  label: string;
  origin: readonly [number, number];
  heading: number;
  retry: Triple;
  parts: readonly FallbackPart[];
}>;

function part(
  shape: FallbackShape,
  tone: FallbackTone,
  position: Triple,
  scale: Triple,
  rotation?: Triple,
): FallbackPart {
  return { shape, tone, position, scale, rotation };
}

// Open frames retain the authored roof outline without adding a floor, walls,
// furniture, signs, vegetation, or a new resident interaction target.
function canopy(
  halfWidth: number,
  halfDepth: number,
  eave: number,
  rise: number,
  tone: FallbackTone,
): FallbackPart[] {
  const slope = Math.atan2(rise, halfWidth);
  const rafterLength = Math.hypot(halfWidth, rise);
  return [
    ...[-halfWidth, halfWidth].flatMap((x) =>
      [-halfDepth, halfDepth].map((z) => part('box', 'wood', [x, eave / 2, z], [0.14, eave, 0.14])),
    ),
    ...[-halfDepth, halfDepth].flatMap((z) =>
      [-1, 1].map((side) =>
        part(
          'box',
          tone,
          [(side * halfWidth) / 2, eave + rise / 2, z],
          [rafterLength, 0.18, 0.18],
          [0, 0, -side * slope],
        ),
      ),
    ),
    part('box', tone, [0, eave + rise, 0], [0.18, 0.18, halfDepth * 2]),
    ...[-halfWidth, halfWidth].map((x) =>
      part('box', tone, [x, eave, 0], [0.16, 0.16, halfDepth * 2]),
    ),
  ];
}

export const SCENIC_FALLBACK_PLANS: Readonly<Record<ScenicRegionId, ScenicFallbackPlan>> = {
  lookout: {
    label: 'Meadow lookout',
    origin: [LOOKOUT.x, LOOKOUT.z],
    heading: 0,
    retry: [-3.4, 4.1, -2.2],
    parts: canopy(2.35, 2.2, 2.7, 0.9, 'green'),
  },
  orchard: {
    label: 'Orchard commons',
    origin: [ORCHARD_PAVILION.x, ORCHARD_PAVILION.z],
    heading: 0,
    retry: [3.6, 5.4, 0],
    parts: canopy(2.8, 2.1, 4.1, 0.9, 'clay'),
  },
  observatory: {
    label: 'Cedar observatory',
    origin: [OBSERVATORY.x, OBSERVATORY.z],
    heading: 0,
    retry: [-3.4, 3.9, -1.6],
    parts: [
      part('cylinder', 'wood', [-1.25, 0.7, -1.55], [0.13, 1.4, 0.13]),
      part('cylinder', 'brass', [-1.05, 2.2, -1.55], [0.34, 2.45, 0.34], [0.12, 0, -0.58]),
    ],
  },
  dawnlight: {
    label: DAWNLIGHT_GLASSHOUSE.label,
    origin: [DAWNLIGHT_GLASSHOUSE.centerX, DAWNLIGHT_GLASSHOUSE.centerZ],
    heading: Math.atan2(12, 9),
    retry: [-5.5, 5.6, 0],
    parts: canopy(4.8, 3.3, 3.35, 1.7, 'green'),
  },
  windward: {
    label: WINDWARD_MILL.label,
    origin: [WINDWARD_MILL.centerX, WINDWARD_MILL.centerZ],
    heading: Math.atan2(-15, 20),
    retry: [3.9, 8.4, 0],
    parts: [
      part('cylinder', 'stone', [0, 2.9, 0], [1.65, 5.8, 1.65]),
      part('cone', 'green', [0, 6.8, 0], [2, 1.8, 2]),
      part('box', 'wood', [0, 6.15, 2.13], [0.22, 7.1, 0.18], [0, 0, Math.PI / 4]),
      part('box', 'wood', [0, 6.15, 2.13], [7.1, 0.22, 0.18], [0, 0, Math.PI / 4]),
    ],
  },
  amber: {
    label: AMBER_BLUFF.label,
    origin: [AMBER_BLUFF.x, AMBER_BLUFF.z],
    heading: Math.atan2(15, 24),
    retry: [0, 8.7, 0],
    parts: [
      part('box', 'amber', [-5.4, 2.2, 0], [5.2, 4.4, 3.4]),
      part('box', 'amber', [0, 3.55, -0.2], [5.6, 7.1, 3.8]),
      part('box', 'amber', [5.3, 2.4, 0], [5, 4.8, 3.4]),
    ],
  },
  woodland: {
    label: 'Lantern Hollow',
    origin: WOODLAND_SHELTER_XZ,
    heading: Math.PI / 4,
    retry: [-3.2, 4.2, 0],
    parts: canopy(1.88, 1.32, 2.8, 0.8, 'green'),
  },
  northstar: {
    label: 'Northstar Outpost',
    origin: NORTHSTAR_TOWER_XZ,
    heading: Math.atan2(-18, -12),
    retry: [3.4, 8.8, 0],
    parts: [
      ...[-1.55, 1.55].flatMap((x) =>
        [-1.55, 1.55].map((z) => part('box', 'wood', [x, 2.5, z], [0.19, 5, 0.19])),
      ),
      part('cone', 'green', [0, 6.88, 0], [2.45, 1.8, 2.45]),
      part('cylinder', 'brass', [0, 5.8, 0], [0.28, 0.8, 0.28]),
      part('box', 'brass', [0, 8.2, 0], [1.3, 0.12, 0.12]),
      part('box', 'brass', [0, 8.2, 0], [0.12, 0.12, 1.3]),
    ],
  },
  slate: {
    label: 'Slate Reach',
    origin: [SLATE_REACH.x, SLATE_REACH.z],
    heading: 0,
    retry: [4.2, 10.7, 0],
    parts: [
      part('cone', 'stone', [-2.2, 3.9, 0.7], [1.2, 7.8, 0.8]),
      part('cone', 'stone', [0.2, 5.1, -0.35], [1.6, 10.2, 1.1]),
      part('cone', 'stone', [2.1, 3.35, 0.8], [1.3, 6.7, 0.9]),
    ],
  },
};
