import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { COLORS, initialAgents } from '../state';
import { DOCK_PADS } from './ambient/drones';
import { CLIP_NAMES, RESIDENT_HEIGHT } from './character';
import { CREW, CREW_PACE, CREW_SCALE, CREW_SUIT, crewByRole, crewCycle, crewPose } from './crew';
import { WALL_EXTERIOR, YARD_PROPS } from './habitat/habitatLayout';
import { districtAt } from './hud';
import { SEATS, WORLD_LOCATION_LABELS, ZONES } from './layout';
import { visibleMapResidents, type ResidentPosition } from './mapSnapshot';
import type { Point } from './motion';
import { EDGES, NODES } from './navigation';
import { placeById, placeContains } from './places';
import {
  clearOfConstructionSite,
  constructionPlacements,
  FABRICATION_BAY,
  fenceBoxes,
  fenceCorners,
  fenceEastX,
  fencePosts,
  hoistLoad,
  hoistPose,
  insideFabricationBay,
  LOAD_HIGH,
  LOAD_LOW,
  signPlacement,
  siteGround,
  TRAIL_SETBACK,
  trailDistance,
  trailSide,
} from './scenery/constructionPlacement';
import { EAST_TRAIL_XZ } from './scenery/dawnlightPlacement';
import { clearOfMeadowRoutes } from './scenery/meadowPlacement';

const BODY = 0.45;
/** A walking body plus half a metre: what the site and the crew keep from every lane. */
const CLEARANCE = BODY + 0.5;
type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
const { slab, fence, bounds, hoist } = FABRICATION_BAY;
const segments = EDGES.map(([a, b]) => [NODES[a], NODES[b]] as const);

function distanceToSegmentXZ(x: number, z: number, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / length)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz);
}
function distanceToRect(x: number, z: number, rect: Rect) {
  return Math.hypot(
    Math.max(rect.minX - x, 0, x - rect.maxX),
    Math.max(rect.minZ - z, 0, z - rect.maxZ),
  );
}
function segmentToRect(a: Point, b: Point, rect: Rect) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.25));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    best = Math.min(best, distanceToRect(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t, rect));
  }
  return best;
}
const inflate = (rect: Rect, by: number): Rect => ({
  minX: rect.minX - by,
  maxX: rect.maxX + by,
  minZ: rect.minZ - by,
  maxZ: rect.maxZ + by,
});
const overlaps = (a: Rect, b: Rect) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
/** Inside the fence polygon shrunk (positive margin) or grown (negative) by `margin`. */
function insideFenceBy(x: number, z: number, margin: number) {
  return (
    x >= fence.minX + margin &&
    x <= fence.maxX - margin &&
    z >= fence.minZ + margin &&
    z <= fence.maxZ - margin &&
    trailSide(x, z) <= -(TRAIL_SETBACK + margin)
  );
}
const STEP = 0.2;
const samples = (member: (typeof CREW)[number]) =>
  Array.from({ length: Math.ceil(crewCycle(member) / STEP) }, (_, i) => crewPose(member, i * STEP));
const longest = Math.max(...CREW.map(crewCycle));

describe('construction site and crew', () => {
  it('keeps the site and every crew path a body radius and half a metre from every lane and node', () => {
    // No lane comes within the clearance of the fence line (grown by that clearance).
    for (const [a, b] of segments) {
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.1));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[2] + (b[2] - a[2]) * t;
        expect(insideFenceBy(x, z, -CLEARANCE), `lane at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(
          false,
        );
      }
    }
    for (const [id, [x, , z]] of Object.entries(NODES))
      expect(insideFenceBy(x, z, -CLEARANCE), id).toBe(false);
    // The fence's trail-side run keeps the authored setback from the branch itself.
    for (const post of fencePosts())
      expect(trailDistance(post.x, post.z)).toBeGreaterThanOrEqual(TRAIL_SETBACK - 1e-6);
    expect(trailSide(slab.minX, slab.minZ)).toBeLessThan(0);
    expect(trailSide(30, 10)).toBeGreaterThan(0);
    for (const member of CREW) {
      for (const pose of samples(member)) {
        for (const [a, b] of segments)
          expect(distanceToSegmentXZ(pose.x, pose.z, a, b), member.role).toBeGreaterThanOrEqual(
            CLEARANCE,
          );
      }
    }
  });

  it('stands clear of the decks, the yard, the drone pads, the resource bank and the eastern trail', () => {
    for (const zone of Object.values(ZONES)) {
      const [cx, , cz] = zone.center;
      const deck = {
        minX: cx - zone.size[0] / 2,
        maxX: cx + zone.size[0] / 2,
        minZ: cz - zone.size[1] / 2,
        maxZ: cz + zone.size[1] / 2,
      };
      expect(overlaps(inflate(deck, WALL_EXTERIOR + 0.5), bounds)).toBe(false);
    }
    for (const prop of YARD_PROPS)
      expect(distanceToRect(prop.x, prop.z, bounds), prop.module).toBeGreaterThan(1);
    // The rock-exclusion bounds may overlap the east drone pad; the fence and the heaps must not.
    for (const pad of DOCK_PADS) {
      expect(insideFenceBy(pad.x, pad.z, -(0.75 + 0.3)), pad.id).toBe(false);
      for (const heap of FABRICATION_BAY.heaps)
        expect(Math.hypot(pad.x - heap.x, pad.z - heap.z), pad.id).toBeGreaterThan(
          heap.scale[0] + 0.75 + 0.3,
        );
    }
    // The resource processing bank south of the lab (Colony.tsx).
    expect(overlaps({ minX: 2.05, maxX: 11.45, minZ: 11.75, maxZ: 13.25 }, bounds)).toBe(false);
    for (const [x, z] of EAST_TRAIL_XZ)
      expect(distanceToRect(x, z, bounds), 'eastern trail').toBeGreaterThan(2.2 + CLEARANCE);
    for (const [x, , z] of SEATS) expect(distanceToRect(x, z, bounds)).toBeGreaterThan(3);
    // The fence encloses the raft, the ramp and the hoist, and the exclusion bounds enclose the fence and the heaps.
    for (const [x, z] of [
      [slab.minX, slab.minZ],
      [slab.maxX, slab.minZ],
      [slab.minX, slab.maxZ],
      [slab.maxX, slab.maxZ],
      [FABRICATION_BAY.ramp.minX, FABRICATION_BAY.ramp.minZ],
    ])
      expect(insideFenceBy(x, z, 0.3), `${x}, ${z}`).toBe(true);
    expect(insideFenceBy(hoist.x, hoist.z, 0.8)).toBe(true);
    for (const heap of FABRICATION_BAY.heaps) {
      expect(distanceToRect(heap.x, heap.z, bounds)).toBe(0);
      expect(insideFabricationBay(heap.x, heap.z)).toBe(false);
    }
    for (const post of fencePosts()) expect(distanceToRect(post.x, post.z, bounds)).toBe(0);
    expect(fencePosts()).toHaveLength(9);
    expect(fenceCorners()).toHaveLength(5);
    for (const box of fenceBoxes()) {
      expect(box.maxX).toBeGreaterThan(box.minX);
      expect(insideFabricationBay(box.maxX, box.maxZ)).toBe(true);
      expect(insideFabricationBay(box.maxX + 0.05, box.maxZ)).toBe(false);
    }
    expect(fenceEastX(fence.maxZ)).toBeLessThan(fence.maxX);
    const sign = signPlacement();
    expect(insideFenceBy(sign.x, sign.z, 0)).toBe(true);
    expect(insideFenceBy(sign.x, sign.z, 0.1)).toBe(false);
  });

  it('never lets two crew meet, and keeps them inside the fence and off the kit modules', () => {
    const kit = Object.values(constructionPlacements()).flat();
    for (let t = 0; t < longest; t += STEP) {
      const poses = CREW.map((member) => crewPose(member, t));
      for (let i = 0; i < poses.length; i++) {
        expect(insideFenceBy(poses[i].x, poses[i].z, BODY), `${CREW[i].role} at ${t}`).toBe(true);
        for (let j = i + 1; j < poses.length; j++)
          expect(
            Math.hypot(poses[i].x - poses[j].x, poses[i].z - poses[j].z),
            `${CREW[i].role} and ${CREW[j].role} at ${t}`,
          ).toBeGreaterThanOrEqual(2 * BODY * CREW_SCALE);
        for (const placement of kit)
          expect(
            Math.hypot(poses[i].x - placement.position[0], poses[i].z - placement.position[2]),
            `${CREW[i].role} and ${placement.module} at ${t}`,
          ).toBeGreaterThanOrEqual(0.9);
        expect(Math.hypot(poses[i].x - hoist.x, poses[i].z - hoist.z)).toBeGreaterThan(BODY + 0.4);
      }
    }
  });

  it('walks between authored stops with authored clips, at a reduced scale, and parks under reduced motion', () => {
    expect(CREW_SCALE).toBeLessThan(1);
    expect(CREW_SCALE).toBeGreaterThan(0.8);
    expect(CREW).toHaveLength(3);
    for (const member of CREW) {
      expect(member.stops.length).toBeGreaterThanOrEqual(2);
      for (const stop of member.stops) {
        expect(CLIP_NAMES).toContain(stop.clip);
        expect(stop.clip).not.toBe('Walking');
        expect(stop.dwell).toBeGreaterThan(2);
      }
      const poses = samples(member);
      let walked = 0;
      let stood = 0;
      poses.forEach((pose, index) => {
        expect(pose.moving).toBe(pose.clip === 'Walking');
        pose.moving ? walked++ : stood++;
        expect(Number.isFinite(pose.heading)).toBe(true);
        expect(pose.y).toBeCloseTo(siteGround(pose.x, pose.z), 9);
        if (index > 0) {
          const before = poses[index - 1];
          expect(Math.hypot(pose.x - before.x, pose.z - before.z)).toBeLessThanOrEqual(
            CREW_PACE * STEP + 1e-6,
          );
        }
      });
      expect(walked).toBeGreaterThan(0);
      expect(stood).toBeGreaterThan(0);
      // Loops close: the pose at one cycle matches the pose at zero.
      const start = crewPose(member, 0);
      const lap = crewPose(member, crewCycle(member));
      expect(lap.x).toBeCloseTo(start.x, 6);
      expect(lap.z).toBeCloseTo(start.z, 6);
      const parked = crewPose(member, 37.3, true);
      expect(parked.moving).toBe(false);
      expect([parked.x, parked.z, parked.clip]).toEqual([
        member.stops[0].x,
        member.stops[0].z,
        member.stops[0].clip,
      ]);
    }
    // The hauler climbs onto the raft; the walking surface steps up with the ramp.
    const onRaft = samples(crewByRole('hauler')).find((pose) => pose.x > slab.minX + 0.2);
    expect(onRaft?.y).toBe(slab.top);
    const { ramp } = FABRICATION_BAY;
    const mid = (ramp.minZ + ramp.maxZ) / 2;
    expect(siteGround(slab.minX - 0.2, mid)).toBeLessThan(slab.top);
    expect(siteGround(slab.minX - 0.2, mid)).toBeGreaterThan(siteGround(ramp.minX + 0.05, mid));
    expect(siteGround(30, 30)).toBeLessThan(slab.top);
  });

  it('carries no identity into the store, the roster or the map', async () => {
    for (const member of CREW) {
      for (const key of ['id', 'name', 'seat', 'sessionId', 'agentId', 'status', 'task'])
        expect(member, key).not.toHaveProperty(key);
      expect(member.look.color).toBe(CREW_SUIT);
    }
    expect(COLORS).not.toContain(CREW_SUIT);
    // The map lists roster agents only, so a stray non-roster entry could never show.
    const agents = initialAgents();
    const positions = new Map<string, ResidentPosition>();
    positions.set(agents[0].id, { point: { x: 1, y: 0.5, z: 2 }, seat: 0 });
    positions.set('crew-hauler', { point: { x: 16, y: 0.4, z: -5 }, seat: 0 });
    const shown = visibleMapResidents(agents, positions);
    expect(shown.map((resident) => resident.id)).toEqual([agents[0].id]);
    // The component never touches the shared position map, the roster, selection or labels.
    const source = await readFile(new URL('./ConstructionCrew.tsx', import.meta.url), 'utf8');
    for (const forbidden of [
      'positions',
      'userData.resident',
      'resident:',
      'select(',
      's.agents',
      'WorldLabel',
      'onClick',
      'setPlace',
    ])
      expect(source, forbidden).not.toContain(forbidden);
  });

  it('hangs the hoist load over the raft and above every head', () => {
    const head = slab.top + RESIDENT_HEIGHT * CREW_SCALE + 0.3;
    let lowest = Infinity;
    let highest = -Infinity;
    for (let t = 0; t < Math.max(longest, hoist.period); t += STEP) {
      const load = hoistLoad(t);
      expect(distanceToRect(load.x, load.z, slab)).toBe(0);
      expect(load.cable).toBeGreaterThan(0.5);
      lowest = Math.min(lowest, load.bottom);
      highest = Math.max(highest, load.bottom);
      if (load.bottom < head)
        for (const member of CREW) {
          const pose = crewPose(member, t);
          expect(
            Math.hypot(pose.x - load.x, pose.z - load.z),
            `${member.role} at ${t}`,
          ).toBeGreaterThan(BODY + 0.6);
        }
    }
    expect(lowest).toBeCloseTo(slab.top + LOAD_LOW, 2);
    expect(highest).toBeCloseTo(slab.top + LOAD_HIGH, 2);
    expect(hoistPose(13, true)).toEqual({ yaw: 0, lift: 0 });
    expect(Math.abs(hoistPose(hoist.period / 4).yaw)).toBeCloseTo(hoist.swing, 6);
  });

  it('is a place you can click and a location the HUD can name, with no preset of its own', () => {
    const place = placeById(FABRICATION_BAY.id)!;
    expect(place).toBeDefined();
    expect(place.kind).toBe('landmark');
    expect(place.view).toBeUndefined();
    expect(place.seats).toEqual([]);
    expect(place.destinations).toEqual([]);
    for (const [x, z] of [
      [slab.minX, slab.minZ],
      [slab.maxX, slab.maxZ],
      [hoist.x, hoist.z],
    ])
      expect(placeContains(place, x, z)).toBe(true);
    for (const member of CREW)
      for (const stop of member.stops) expect(placeContains(place, stop.x, stop.z)).toBe(true);
    expect(place.anchor[1]).toBeGreaterThan(hoist.mast);
    expect(districtAt(place.focus.x, place.focus.z)).toBe('fabrication-bay');
    expect(insideFabricationBay(place.focus.x, place.focus.z)).toBe(true);
    expect(districtAt(7, -5)).toBe('studio');
    expect(WORLD_LOCATION_LABELS['fabrication-bay']).toBe(FABRICATION_BAY.label);
  });

  it('keeps rocks and groundcover off the site', () => {
    expect(clearOfConstructionSite(30, 0)).toBe(true);
    expect(clearOfConstructionSite(bounds.maxX + 0.5, 0)).toBe(true);
    expect(clearOfConstructionSite(bounds.maxX + 0.5, 0, 1)).toBe(false);
    expect(clearOfMeadowRoutes(20, -4)).toBe(false);
    for (const heap of FABRICATION_BAY.heaps)
      expect(clearOfMeadowRoutes(heap.x, heap.z, 1)).toBe(false);
    expect(clearOfMeadowRoutes(40, 0)).toBe(true);
  });
});
