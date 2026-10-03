import { describe, expect, it } from 'vitest';
import { CAMERA_PAN_BOUNDS } from './cameraPan';
import {
  activateMap,
  getMapSnapshot,
  groupNearbyMapResidents,
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
    expect(worldToMap({ x: 0, z: -5 })).toEqual({ left: 50, top: 50 });
    expect(worldToMap({ x: 900, z: -900 })).toEqual({ left: 100, top: 0 });
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
