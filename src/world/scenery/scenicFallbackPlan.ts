import { REFERENCE_HABITAT } from './referenceHabitatPlacement';
import type { ScenicRegionId } from '../scenicVisibility';
import { LOOKOUT, OBSERVATORY, ORCHARD } from '../layout';
import { AMBER_BLUFF } from './amberPlacement';
import { BIOLAB_HABITATS, DAWNLIGHT_GLASSHOUSE } from './dawnlightPlacement';
import { WINDWARD_MILL } from './windwardPlacement';
import { WOODLAND_SHELTER_XZ } from './woodlandPlacement';
import { NORTHSTAR_TOWER_XZ } from './northstarPlacement';
import { SLATE_REACH } from './slatePlacement';

export type FallbackShape = 'box' | 'cylinder' | 'cone' | 'dome';
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

export const SCENIC_FALLBACK_PLANS: Readonly<Record<ScenicRegionId, ScenicFallbackPlan>> = {
  lookout: {
    label: 'Survey Lookout',
    origin: [LOOKOUT.x, LOOKOUT.z],
    heading: 0,
    retry: [-3.4, 4.1, -2.2],
    parts: [
      part('cylinder', 'wood', [-3.8, 2.6, -2.5], [0.11, 5.2, 0.11]),
      part('box', 'green', [-3.8, 4.8, -2.5], [2.1, 0.14, 0.18]),
    ],
  },
  orchard: {
    label: 'Expedition Base',
    origin: [REFERENCE_HABITAT.x, REFERENCE_HABITAT.z],
    heading: 0,
    retry: [3.6, 5.4, 0],
    parts: [
      part('box', 'wood', [0, 2.5, 0], [7.2, 3.75, 4.35]),
      part('box', 'stone', [0, 1.9, 2.7], [2.1, 2.7, 1.6]),
    ],
  },
  observatory: {
    label: 'Deep Sky Array',
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
    origin: [BIOLAB_HABITATS[0].x, BIOLAB_HABITATS[0].z],
    heading: 0,
    retry: [-5.5, 5.6, 0],
    parts: [part('dome', 'wood', [0, 0.4, 0], [2.8, 2.8, 2.8])],
  },
  windward: {
    label: WINDWARD_MILL.label,
    origin: [WINDWARD_MILL.centerX, WINDWARD_MILL.centerZ],
    heading: 0,
    retry: [0, 4, 0],
    parts: [
      part('dome', 'wood', [0, 0.4, 0], [2.8, 2.8, 2.8]),
      part('box', 'green', [-8, 1.65, -5], [4.2, 0.15, 2.2]),
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
    label: 'Basalt Field Station',
    origin: WOODLAND_SHELTER_XZ,
    heading: Math.PI / 4,
    retry: [-3.2, 4.2, 0],
    parts: [part('dome', 'wood', [0, 0.4, 0], [2.8, 2.8, 2.8])],
  },
  northstar: {
    label: 'Northstar Spaceport',
    origin: NORTHSTAR_TOWER_XZ,
    heading: 0,
    retry: [3.4, 8.8, 0],
    parts: [
      part('cylinder', 'wood', [0, 4.1, 0], [0.74, 4.8, 0.74]),
      part('cone', 'wood', [0, 7.1, 0], [0.74, 1.3, 0.74]),
      part('box', 'green', [-2.6, 4.2, 0], [0.55, 8.4, 0.65]),
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
