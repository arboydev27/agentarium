import { describe, expect, it } from 'vitest';
import { CAMERA_PAN_BOUNDS } from './cameraPan';
import { AMBER_BLUFF } from './scenery/amberPlacement';
import { DAWNLIGHT_GLASSHOUSE } from './scenery/dawnlightPlacement';
import { SOUTHWIND_SHORE } from './scenery/southwindTrailPlacement';
import { TRAIL_TURNOUTS, turnoutPoint } from './scenery/turnoutPlacement';
import { WINDWARD_MILL } from './scenery/windwardPlacement';
import {
  activateMap,
  detailMapBounds,
  getMapSnapshot,
  groupNearbyMapResidents,
  MAP_LANDMARKS,
  mapToWorld,
  pointInMapBounds,
  publishMapSnapshot,
  subscribeMapSnapshot,
  visibleMapResidents,
  worldToMap,
} from './mapSnapshot';

describe('live landmark map', () => {
  it('projects world coordinates consistently with north at the top', () => {
    expect(worldToMap({ x: CAMERA_PAN_BOUNDS.minX, z: CAMERA_PAN_BOUNDS.minZ })).toEqual({
      left: 0,
      top: 0,
    });
    expect(worldToMap({ x: CAMERA_PAN_BOUNDS.maxX, z: CAMERA_PAN_BOUNDS.maxZ })).toEqual({
      left: 100,
      top: 100,
    });
    expect(worldToMap({ x: 0, z: 0 })).toEqual({ left: 50, top: 50 });
    expect(worldToMap({ x: 900, z: -900 })).toEqual({ left: 100, top: 0 });
  });

  it('round-trips camera targets and clamps map choices to camera bounds', () => {
    expect(mapToWorld(worldToMap({ x: 24, z: -71 }))).toEqual({ x: 24, z: -71 });
    expect(mapToWorld({ left: -10, top: 150 })).toEqual({
      x: CAMERA_PAN_BOUNDS.minX,
      z: CAMERA_PAN_BOUNDS.maxZ,
    });
  });

  it('plots named outside places at their shared world destinations', () => {
    expect(MAP_LANDMARKS).toHaveLength(9);
    expect(MAP_LANDMARKS.map((landmark) => landmark.id)).toEqual([
      'lookout',
      'orchard',
      'observatory',
      'dawnlight',
      'windward',
      'amber',
      'mere',
      'meadow:rest-west',
      'meadow:rest-east',
    ]);
    const mere = MAP_LANDMARKS.find((landmark) => landmark.id === 'mere')!;
    expect(mere.point).toEqual({ x: SOUTHWIND_SHORE.x, z: SOUTHWIND_SHORE.z });
    expect(mere.view).toBe('mere');
    const dawnlight = MAP_LANDMARKS.find((landmark) => landmark.id === 'dawnlight')!;
    expect(dawnlight.point).toEqual({ x: DAWNLIGHT_GLASSHOUSE.x, z: DAWNLIGHT_GLASSHOUSE.z });
    expect(dawnlight.view).toBe('dawnlight');
    const windward = MAP_LANDMARKS.find((landmark) => landmark.id === 'windward')!;
    expect(windward.point).toEqual({ x: WINDWARD_MILL.centerX, z: WINDWARD_MILL.centerZ });
    expect(windward.view).toBe('windward');
    const amber = MAP_LANDMARKS.find((landmark) => landmark.id === 'amber')!;
    expect(amber).toMatchObject({
      point: { x: AMBER_BLUFF.x, z: AMBER_BLUFF.z },
      view: 'amber',
      scenicOnly: true,
    });
    expect(worldToMap(amber.point).left).toBeGreaterThan(0);
    expect(worldToMap(amber.point).left).toBeLessThan(12);
    expect(worldToMap(windward.point).left).toBeLessThan(96); // keep its entire pin inside the eastern edge
    expect(worldToMap({ x: WINDWARD_MILL.x, z: WINDWARD_MILL.z }).left).toBeGreaterThan(
      worldToMap(windward.point).left,
    );
    for (const turnout of TRAIL_TURNOUTS) {
      const [x, , z] = turnoutPoint(turnout.trailIndex, turnout.side, 4.8);
      const landmark = MAP_LANDMARKS.find((item) => item.id === turnout.id);
      expect(landmark?.point).toEqual({ x, z });
      expect(landmark?.view).toBeUndefined();
    }
    for (const landmark of MAP_LANDMARKS) {
      const position = worldToMap(landmark.point);
      expect(position.left).toBeGreaterThan(0);
      expect(position.left).toBeLessThan(100);
      expect(position.top).toBeGreaterThan(0);
      expect(position.top).toBeLessThan(100);
      expect(mapToWorld(position).x).toBeCloseTo(landmark.point.x);
      expect(mapToWorld(position).z).toBeCloseTo(landmark.point.z);
    }
  });

  it('projects 2× detail consistently and keeps the focused frame inside finite bounds', () => {
    const detail = detailMapBounds({ x: 0, z: -5 });
    expect(detail).toEqual({ minX: -62.5, maxX: 62.5, minZ: -67.5, maxZ: 57.5 });
    expect(worldToMap({ x: 0, z: -5 }, detail)).toEqual({ left: 50, top: 50 });
    expect(mapToWorld({ left: 50, top: 50 }, detail)).toEqual({ x: 0, z: -5 });
    expect(pointInMapBounds({ x: 100, z: 80 }, detail)).toBe(false);
    expect(pointInMapBounds({ x: 36, z: -20 }, detail)).toBe(true);
    expect(detailMapBounds({ x: CAMERA_PAN_BOUNDS.maxX, z: CAMERA_PAN_BOUNDS.maxZ })).toEqual({
      minX: 0,
      maxX: 125,
      minZ: 0,
      maxZ: 125,
    });
    expect(detailMapBounds({ x: CAMERA_PAN_BOUNDS.minX, z: CAMERA_PAN_BOUNDS.minZ })).toEqual({
      minX: -125,
      maxX: 0,
      minZ: -125,
      maxZ: 0,
    });
    expect(mapToWorld({ left: 100, top: 0 }, detailMapBounds({ x: 125, z: 125 }))).toEqual({
      x: 125,
      z: 0,
    });
  });

  it('re-groups nearby residents at the detail scale', () => {
    const residents = [
      { id: 'one', name: 'One', seat: 0, x: 0, z: 0 },
      { id: 'two', name: 'Two', seat: 1, x: 15, z: 0 },
    ];
    expect(groupNearbyMapResidents(residents)).toHaveLength(1);
    expect(groupNearbyMapResidents(residents, detailMapBounds({ x: 0, z: 0 }))).toHaveLength(2);
  });

  it('includes only current visible seat assignments and copies coordinates', () => {
    const point = { x: 36, y: 2, z: -70 };
    const agents = [
      { id: 'orchard', name: 'Orchard visitor', seat: 0 },
      { id: 'hidden', name: 'Hidden session', seat: 8 },
      { id: 'departed', name: 'Old occupant', seat: 1 },
      { id: 'new', name: 'New occupant', seat: 1 },
    ];
    const positions = new Map([
      ['orchard', { point, seat: 0 }],
      ['hidden', { point: { x: 0, y: 1, z: 0 }, seat: 8 }],
      ['departed', { point: { x: 1, y: 1, z: 1 }, seat: 2 }],
      ['new', { point: { x: 2, y: 1, z: 3 }, seat: 1 }],
    ]);
    const residents = visibleMapResidents(agents, positions);
    expect(residents).toEqual([
      { id: 'orchard', name: 'Orchard visitor', seat: 0, x: 36, z: -70 },
      { id: 'new', name: 'New occupant', seat: 1, x: 2, z: 3 },
    ]);
    point.x = 999;
    expect(residents[0].x).toBe(36);
  });

  it('groups overlapping grove markers but leaves distant destinations separate', () => {
    const groups = groupNearbyMapResidents([
      { id: 'a', name: 'A', seat: 0, x: -8, z: -3 },
      { id: 'b', name: 'B', seat: 1, x: -4, z: -3 },
      { id: 'c', name: 'C', seat: 2, x: 6, z: 4 },
      { id: 'd', name: 'D', seat: 3, x: 36, z: -70 },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].residents.map((resident) => resident.id)).toEqual(['a', 'b', 'c']);
    expect(groups[1].residents[0].id).toBe('d');
    expect(groups[0].point.x).toBeCloseTo(-2);
  });

  it('notifies subscribers only when the snapshot changes and clears on opening', () => {
    const changes: number[] = [];
    const unsubscribe = subscribeMapSnapshot(() => changes.push(changes.length));
    publishMapSnapshot({ camera: { x: 1, z: 2 }, residents: [] });
    publishMapSnapshot({ camera: { x: 1, z: 2 }, residents: [] });
    expect(changes).toHaveLength(1);
    activateMap(true);
    expect(getMapSnapshot()).toEqual({ camera: null, residents: [] });
    expect(changes).toHaveLength(2);
    activateMap(false);
    unsubscribe();
  });
});
