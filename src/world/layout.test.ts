import { describe, expect, it } from 'vitest';
import { WORLD, ZONES, SEATS, CAMERA_VIEWS } from './layout';
import { routeForSeat } from './motion';
import { showFineDetail } from './detail';

describe('expanded world layout', () => {
  it('keeps all eight desks and their full routes on assigned floors inside the island', () => {
    expect(
      Object.values(ZONES)
        .flatMap((zone) => zone.seats)
        .sort(),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const zone of Object.values(ZONES)) {
      const [x, y, z] = zone.center;
      const [w, d] = zone.size;
      expect(Math.abs(x) + w / 2).toBeLessThan(WORLD.width / 2);
      expect(Math.abs(z) + d / 2).toBeLessThan(WORLD.depth / 2);
      for (const seat of zone.seats) {
        const [sx, sy, sz] = SEATS[seat];
        expect(sy).toBe(y);
        expect(Math.abs(sx - x) + 0.8).toBeLessThan(w / 2);
        expect(Math.abs(sz - z) + 1.1).toBeLessThan(d / 2);
        for (const [px, py, pz] of routeForSeat(seat)) {
          expect(py).toBe(y);
          // Reserve space around the path for the character's body.
          expect(Math.abs(px - x) + 0.35).toBeLessThan(w / 2);
          expect(Math.abs(pz - z) + 0.35).toBeLessThan(d / 2);
        }
      }
    }
  });
  it('has a camera looking into each zone with a positive viewport span', () => {
    for (const name of Object.keys(ZONES) as (keyof typeof ZONES)[]) {
      const camera = CAMERA_VIEWS[name],
        zone = ZONES[name];
      expect(Math.abs(camera.look[0] - zone.center[0])).toBeLessThan(zone.size[0] / 2);
      expect(Math.abs(camera.look[2] - zone.center[2])).toBeLessThan(zone.size[1] / 2);
      expect(camera.span.every((value) => value > 0)).toBe(true);
    }
  });
  it('offers a wider horizon view beyond the inhabited island', () => {
    expect(CAMERA_VIEWS.horizon.look[2]).toBeLessThan(-WORLD.depth / 2);
    expect(CAMERA_VIEWS.horizon.span[0]).toBeGreaterThan(WORLD.width * 1.5);
  });
  it('bookmarks the first outside lookout beyond the original district', () => {
    expect(CAMERA_VIEWS.lookout.look[2]).toBeLessThan(-WORLD.depth / 2);
    expect(CAMERA_VIEWS.lookout.span.every((value) => value > 0)).toBe(true);
  });
});

describe('decorative detail selection', () => {
  it('uses hysteresis so small camera changes do not churn scene objects', () => {
    expect(showFineDetail(false, 25, true, 'high')).toBe(false);
    expect(showFineDetail(false, 26, true, 'high')).toBe(true);
    expect(showFineDetail(true, 23, true, 'high')).toBe(true);
    expect(showFineDetail(true, 21, true, 'high')).toBe(false);
  });
  it('unmounts fine detail offscreen or at low quality even when zoomed in', () => {
    expect(showFineDetail(true, 80, false, 'high')).toBe(false);
    expect(showFineDetail(true, 80, true, 'low')).toBe(false);
    expect(showFineDetail(false, 80, true, 'high')).toBe(true);
  });
});
