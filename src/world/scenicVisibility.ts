import { LOOKOUT, OBSERVATORY, ORCHARD } from './layout';
import { AMBER_BLUFF } from './scenery/amberPlacement';
import { DAWNLIGHT_GLASSHOUSE } from './scenery/dawnlightPlacement';
import { SLATE_REACH } from './scenery/slatePlacement';
import { WINDWARD_MILL } from './scenery/windwardPlacement';

export type ScenicRegionId =
  'lookout' | 'orchard' | 'observatory' | 'dawnlight' | 'slate' | 'windward' | 'amber';
export type ScenicPoint = Readonly<{ x: number; z: number }>;
export type ScenicBounds = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}>;
export type ScenicRegion = Readonly<{ id: ScenicRegionId; bounds: ScenicBounds }>;
export type ScenicFrame = Readonly<{
  focus: ScenicPoint;
  camera: ScenicPoint;
  // A conservative ground-plane radius for the entire orthographic viewport.
  // The renderer should measure its frustum (including aspect ratio and zoom).
  visibleGroundRadius: number;
}>;
export type ScenicVisibilityInput = ScenicFrame &
  Readonly<{
    mode: 'orthographic' | 'horizon';
    // Pass the destination preset immediately when a camera transition begins.
    target?: ScenicFrame;
  }>;

const box = (x: number, z: number, radius: number): ScenicBounds =>
  Object.freeze({ minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius });
const region = (id: ScenicRegionId, bounds: ScenicBounds): ScenicRegion =>
  Object.freeze({ id, bounds });

// Stable identities make remount decisions independent of component lifetimes.
// These conservative bounds contain optional authored detail, not walkable paths.
export const SCENIC_REGIONS: readonly ScenicRegion[] = Object.freeze([
  region('lookout', box(LOOKOUT.x, LOOKOUT.z, LOOKOUT.focusRadius + 4)),
  region('orchard', box(ORCHARD.x + 3, ORCHARD.z - 3, ORCHARD.focusRadius + 7)),
  region('observatory', box(OBSERVATORY.x, OBSERVATORY.z, OBSERVATORY.focusRadius + 7)),
  region(
    'dawnlight',
    box(
      DAWNLIGHT_GLASSHOUSE.centerX,
      DAWNLIGHT_GLASSHOUSE.centerZ,
      DAWNLIGHT_GLASSHOUSE.clearingRadius + 7,
    ),
  ),
  region('slate', box(SLATE_REACH.x, SLATE_REACH.z, SLATE_REACH.radius + 7)),
  region(
    'windward',
    box(WINDWARD_MILL.centerX, WINDWARD_MILL.centerZ, WINDWARD_MILL.clearingRadius + 8),
  ),
  region('amber', box(AMBER_BLUFF.x, AMBER_BLUFF.z, AMBER_BLUFF.clearingRadius + 8)),
]);

export const SCENIC_ENTER_PADDING = 18;
export const SCENIC_EXIT_PADDING = 32;
const CAMERA_PREFETCH_RADIUS = 26;

function distanceToBounds(point: ScenicPoint, bounds: ScenicBounds) {
  const dx = Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX);
  const dz = Math.max(bounds.minZ - point.z, 0, point.z - bounds.maxZ);
  return Math.hypot(dx, dz);
}

function valid(frame: ScenicFrame) {
  return (
    Number.isFinite(frame.focus.x) &&
    Number.isFinite(frame.focus.z) &&
    Number.isFinite(frame.camera.x) &&
    Number.isFinite(frame.camera.z) &&
    Number.isFinite(frame.visibleGroundRadius) &&
    frame.visibleGroundRadius >= 0
  );
}

function inFrame(region: ScenicRegion, frame: ScenicFrame, padding: number) {
  return (
    distanceToBounds(frame.focus, region.bounds) <= frame.visibleGroundRadius + padding ||
    distanceToBounds(frame.camera, region.bounds) <= CAMERA_PREFETCH_RADIUS + padding
  );
}

// This policy gates scenic meshes only. Terrain, resident routes, path ribbons,
// agent state and interaction targets must remain mounted independently.
export function selectScenicRegions(
  input: ScenicVisibilityInput,
  previousIds: ReadonlySet<ScenicRegionId> = new Set(),
): ScenicRegion[] {
  if (input.mode === 'horizon' || !valid(input) || (input.target && !valid(input.target)))
    return [...SCENIC_REGIONS];
  return SCENIC_REGIONS.filter(
    (candidate) =>
      inFrame(
        candidate,
        input,
        previousIds.has(candidate.id) ? SCENIC_EXIT_PADDING : SCENIC_ENTER_PADDING,
      ) ||
      (input.target && inFrame(candidate, input.target, SCENIC_ENTER_PADDING)),
  );
}
