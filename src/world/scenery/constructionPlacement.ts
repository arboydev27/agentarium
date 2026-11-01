import type { Placement } from '../habitat/habitatLayout';
import { renderedTerrainHeight } from '../terrain';
import { WINDWARD_BRANCH_BENDS } from './windwardPlacement';

// The Fabrication Bay: the colony's fifth module going up east of the Research
// Array, in the wedge between the module and the Helios branch of the eastern
// trail. These are the placement constants the scenery, the crew schedule, the
// place registry, the HUD label and the rock exclusions all read, so there is no
// second set of numbers to drift. Pure and deterministic; nothing here reads or
// writes resident state.

/** Metres the site keeps from the centreline of the Helios branch along its south-east side. */
export const TRAIL_SETBACK = 2.7;

export const FABRICATION_BAY = {
  id: 'fabrication-bay',
  label: 'Fabrication Bay',
  /** Foundation raft: a level top on sloping ground, its base sunk under the lowest point beneath it. */
  slab: { minX: 16.2, maxX: 22.2, minZ: -8.2, maxZ: -2.6, top: 0.5, base: -0.75 },
  /** The ramp up the raft's west edge, where the crew cross between the yard and the raft. */
  ramp: { minX: 15.35, minZ: -7, maxZ: -4.6 },
  /**
   * Keep-out line of posts and tape. West, south and east sides are these lines;
   * the south-east side follows the Helios branch at TRAIL_SETBACK (see
   * fenceCorners); the north side is open.
   */
  fence: { minX: 13.8, maxX: 26, minZ: -9, maxZ: 2.4 },
  /** Everything the site occupies, spoil heaps included; rocks and groundcover keep out of it. */
  bounds: { minX: 13, maxX: 27, minZ: -12.2, maxZ: 3.2 },
  /** The hoist south of the raft: mast height, boom length, slew half-angle in radians and cycle seconds. */
  hoist: { x: 19, z: -1, mast: 5.6, boom: 3.9, swing: 0.22, period: 40 },
  /** Spoil from the raft's footing, dumped north of the open fence line. */
  heaps: [
    { x: 24.5, z: -10.3, scale: [2, 0.7, 1.5] },
    { x: 20.5, z: -10.4, scale: [1.3, 0.5, 1] },
  ],
} as const;

/** The kit crate stands this tall; the yard stacks one on another. */
export const CRATE_HEIGHT = 0.73;
/** The cargo box the hoist carries: width, height and depth in metres. */
export const LOAD_SIZE: readonly [number, number, number] = [0.8, 0.7, 0.8];
/** Where the hanging load's bottom sits above the raft at the top and bottom of its travel. */
export const LOAD_HIGH = 3;
export const LOAD_LOW = 0.9;

const { slab, fence, hoist } = FABRICATION_BAY;
// The branch leaves the Dawnlight trail and bends twice as it passes the site.
const [legA, legB, legC] = WINDWARD_BRANCH_BENDS;
const legDx = legB[0] - legA[0];
const legDz = legB[1] - legA[1];
const legLength = Math.hypot(legDx, legDz);

function segmentDistance(
  x: number,
  z: number,
  a: readonly [number, number],
  b: readonly [number, number],
) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

/** Signed distance from the branch's first leg: negative on the colony's side, positive beyond the trail. */
export function trailSide(x: number, z: number) {
  return ((x - legA[0]) * -legDz + (z - legA[1]) * legDx) / legLength;
}
/** Distance to the two legs of the branch that pass the site. */
export function trailDistance(x: number, z: number) {
  return Math.min(segmentDistance(x, z, legA, legB), segmentDistance(x, z, legB, legC));
}
/** x of the fence's south-east line at `z`: the first leg pushed TRAIL_SETBACK toward the colony. */
export function fenceEastX(z: number) {
  return legA[0] + (-TRAIL_SETBACK * legLength - (z - legA[1]) * legDx) / -legDz;
}
/** z of that same line at `x`. */
export function fenceEastZ(x: number) {
  return legA[1] + (-TRAIL_SETBACK * legLength - (x - legA[0]) * -legDz) / legDx;
}

/** True inside the fence line, which is what the HUD location label names. */
export function insideFabricationBay(x: number, z: number) {
  return (
    x >= fence.minX && x <= fence.maxX && z >= fence.minZ && z <= fence.maxZ && x <= fenceEastX(z)
  );
}

/** The fence as a closed walk from the open north-west corner to the open north-east corner. */
export function fenceCorners(): [number, number][] {
  return [
    [fence.minX, fence.minZ],
    [fence.minX, fence.maxZ],
    [fenceEastX(fence.maxZ), fence.maxZ],
    [fence.maxX, fenceEastZ(fence.maxX)],
    [fence.maxX, fence.minZ],
  ];
}

/** Fence posts in order along the west, south, trail-side and east runs; the north side stays open. */
export function fencePosts(): { x: number; z: number }[] {
  const corners = fenceCorners();
  const posts: { x: number; z: number }[] = [];
  corners.slice(1).forEach(([bx, bz], index) => {
    const [ax, az] = corners[index];
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3.9));
    for (let i = 0; i < steps; i++)
      posts.push({ x: ax + ((bx - ax) * i) / steps, z: az + ((bz - az) * i) / steps });
  });
  posts.push({ x: corners[corners.length - 1][0], z: corners[corners.length - 1][1] });
  return posts;
}

export type FenceBox = { minX: number; maxX: number; minZ: number; maxZ: number };
/** Axis-aligned boxes stepping down the fence's diagonal, for the pick proxies. */
export function fenceBoxes(bands = 5): FenceBox[] {
  return Array.from({ length: bands }, (_, i) => {
    const minZ = fence.minZ + ((fence.maxZ - fence.minZ) * i) / bands;
    const maxZ =
      i + 1 === bands ? fence.maxZ : fence.minZ + ((fence.maxZ - fence.minZ) * (i + 1)) / bands;
    return { minX: fence.minX, maxX: Math.min(fence.maxX, fenceEastX(maxZ)), minZ, maxZ };
  });
}

/** The keep-out sign hangs on the trail-side run, facing the trail. */
export function signPlacement() {
  const [, , from, to] = fenceCorners();
  const x = (from[0] + to[0]) / 2;
  const z = (from[1] + to[1]) / 2;
  const nx = -legDz / legLength;
  const nz = legDx / legLength;
  return { x: x - nx * 0.06, z: z - nz * 0.06, yaw: Math.atan2(nx, nz) };
}

export type ConstructionModule = 'hab-wall' | 'hab-corner' | 'hab-crate' | 'pad-beacon';

const prop = (module: ConstructionModule, x: number, z: number, turn = 0, lift = 0): Placement => ({
  module,
  position: [x, renderedTerrainHeight(x, z) + lift, z],
  rotationY: turn,
  scale: [1, 1, 1],
});

/**
 * Every kit module on the site, grouped for instancing: one instanced draw per
 * kit material, however many placements. Two north wall tiles stand and the
 * east run has begun; the third north tile lies on its back on the raft,
 * waiting to be raised. Crates wait in the yard west of the ramp, and two
 * beacons mark the open north corners.
 */
export function constructionPlacements(): Record<ConstructionModule, Placement[]> {
  const y = slab.top;
  const tile = (x: number, z: number, rotationY: number): Placement => ({
    module: 'hab-wall',
    position: [x, y, z],
    rotationY,
    scale: [1, 1, 1],
  });
  const corner = (x: number, z: number): Placement => ({
    module: 'hab-corner',
    position: [x, y, z],
    rotationY: 0,
    scale: [1, 1, 1],
  });
  return {
    'hab-wall': [
      tile(slab.minX + 1, slab.minZ, Math.PI),
      tile(slab.minX + 3, slab.minZ, Math.PI),
      tile(slab.maxX, slab.minZ + 1, Math.PI / 2),
      {
        module: 'hab-wall',
        position: [slab.minX + 3.5, slab.top + 0.09, slab.maxZ - 0.8],
        rotationY: 0,
        rotation: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
      },
    ],
    'hab-corner': [
      corner(slab.maxX + 0.1, slab.minZ - 0.1),
      corner(slab.minX - 0.1, slab.minZ - 0.1),
    ],
    'hab-crate': [
      prop('hab-crate', 14.6, -6.9, 0.15),
      prop('hab-crate', 14.6, -6.9, 0.5, CRATE_HEIGHT),
      prop('hab-crate', 14.5, -5.9, -0.1),
      prop('hab-crate', 14.6, -4.7, 0.3),
    ],
    'pad-beacon': [prop('pad-beacon', 14.3, -8.7), prop('pad-beacon', 25.5, -8.7)],
  };
}

/**
 * Walking surface inside the site: the raft top on the raft, the ramp's grade
 * across its band, and the rendered terrain everywhere else.
 */
export function siteGround(x: number, z: number) {
  const ground = renderedTerrainHeight(x, z);
  if (z < slab.minZ || z > slab.maxZ) return ground;
  if (x >= slab.minX && x <= slab.maxX) return slab.top;
  const { ramp } = FABRICATION_BAY;
  if (x >= ramp.minX && x < slab.minX && z >= ramp.minZ && z <= ramp.maxZ) {
    const foot = rampFoot();
    return foot + (slab.top - foot) * ((x - ramp.minX) / (slab.minX - ramp.minX));
  }
  return ground;
}

/** Ground height where the ramp leaves the yard. */
export function rampFoot() {
  const { ramp } = FABRICATION_BAY;
  return renderedTerrainHeight(ramp.minX, (ramp.minZ + ramp.maxZ) / 2);
}

/** Height of the boom's pivot, just under the mast top. */
export function hoistTipHeight() {
  return renderedTerrainHeight(hoist.x, hoist.z) + hoist.mast - 0.1;
}

/**
 * Boom yaw (radians; 0 points north, over the raft) and how far the load has
 * come down, 0 at the top of its travel to 1 at the bottom. The two are a
 * quarter cycle apart, so the load is low while the boom is near centre and
 * high while it slews. Reduced motion holds the boom centred with the load up.
 */
export function hoistPose(time: number, reduced = false) {
  if (reduced) return { yaw: 0, lift: 0 };
  const period = hoist.period;
  const phase = (((time % period) + period) % period) / period;
  return {
    yaw: hoist.swing * Math.sin(phase * Math.PI * 2),
    lift: 0.5 - 0.5 * Math.cos(phase * Math.PI * 2),
  };
}

/** The hanging load at `time`: ground position, bottom height, cable length and the boom's yaw. */
export function hoistLoad(time: number, reduced = false) {
  const { yaw, lift } = hoistPose(time, reduced);
  const bottom = slab.top + LOAD_HIGH - (LOAD_HIGH - LOAD_LOW) * lift;
  return {
    x: hoist.x - Math.sin(yaw) * hoist.boom,
    z: hoist.z - Math.cos(yaw) * hoist.boom,
    bottom,
    cable: hoistTipHeight() - LOAD_SIZE[1] - bottom,
    yaw,
  };
}

/** False inside the site's exclusion bounds (plus `radius`), so rocks and groundcover keep out. */
export function clearOfConstructionSite(x: number, z: number, radius = 0) {
  const b = FABRICATION_BAY.bounds;
  return x < b.minX - radius || x > b.maxX + radius || z < b.minZ - radius || z > b.maxZ + radius;
}
