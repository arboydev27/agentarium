import { describe, expect, it } from 'vitest';
import { CAMERA_PAN_BOUNDS } from '../cameraPan';
import { EAST_TRAIL_XZ } from './dawnlightPlacement';
import {
  WINDWARD_BRANCH_XZ,
  WINDWARD_DAWNLIGHT_BRANCH_INDEX,
  WINDWARD_MILL,
  WINDWARD_TRAIL_XZ,
  clearOfWindwardTrail,
} from './windwardPlacement';

function distanceToSegment(
  x: number,
  z: number,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  const dx = to[0] - from[0],
    dz = to[1] - from[1];
  const length = dx * dx + dz * dz;
  const t = length
    ? Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / length))
    : 0;
  return Math.hypot(x - from[0] - t * dx, z - from[1] - t * dz);
}

describe('Windward Mill placement', () => {
  it('shares the safe Dawnlight exit then branches away without cutting through its route', () => {
    expect(WINDWARD_TRAIL_XZ.slice(0, WINDWARD_DAWNLIGHT_BRANCH_INDEX + 1)).toEqual(
      EAST_TRAIL_XZ.slice(0, WINDWARD_DAWNLIGHT_BRANCH_INDEX + 1),
    );
    expect(WINDWARD_BRANCH_XZ[0]).toEqual(EAST_TRAIL_XZ[WINDWARD_DAWNLIGHT_BRANCH_INDEX]);
    expect(WINDWARD_BRANCH_XZ.at(-1)).toEqual([WINDWARD_MILL.x, WINDWARD_MILL.z]);
    for (const [x, z] of WINDWARD_BRANCH_XZ.slice(1)) {
      let nearest = Infinity;
      for (let index = WINDWARD_DAWNLIGHT_BRANCH_INDEX + 1; index < EAST_TRAIL_XZ.length; index++)
        nearest = Math.min(
          nearest,
          distanceToSegment(x, z, EAST_TRAIL_XZ[index - 1], EAST_TRAIL_XZ[index]),
        );
      expect(nearest, `Windward branch near Dawnlight at ${x},${z}`).toBeGreaterThan(0.8);
    }
  });

  it('keeps the walk outside the mill footprint and inside the navigable camera area', () => {
    expect(WINDWARD_MILL.x).toBeLessThanOrEqual(CAMERA_PAN_BOUNDS.maxX);
    expect(WINDWARD_MILL.centerX).toBeLessThanOrEqual(CAMERA_PAN_BOUNDS.maxX);
    for (let index = 1; index < WINDWARD_BRANCH_XZ.length; index++) {
      const from = WINDWARD_BRANCH_XZ[index - 1];
      const to = WINDWARD_BRANCH_XZ[index];
      for (let step = 0; step <= 10; step++) {
        const t = step / 10;
        const x = from[0] + (to[0] - from[0]) * t;
        const z = from[1] + (to[1] - from[1]) * t;
        expect(Math.hypot(x - WINDWARD_MILL.centerX, z - WINDWARD_MILL.centerZ)).toBeGreaterThan(
          WINDWARD_MILL.footprintRadius + 0.8,
        );
        expect(clearOfWindwardTrail(x, z)).toBe(false);
      }
    }
    expect(clearOfWindwardTrail(WINDWARD_MILL.centerX, WINDWARD_MILL.centerZ)).toBe(false);
    expect(clearOfWindwardTrail(50, 30)).toBe(true);
  });
});
