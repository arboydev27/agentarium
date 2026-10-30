import { describe, expect, it } from 'vitest';
import { CAMERA_VIEWS } from '../layout';
import { fadedOpacity, REVEAL_FAR, REVEAL_NEAR, revealAmount, sideFacesCamera } from './reveal';

describe('dollhouse reveal', () => {
  it('opens a module as the camera comes within the near distance', () => {
    expect(revealAmount(REVEAL_FAR + 5)).toBe(0);
    expect(revealAmount(REVEAL_NEAR - 3)).toBe(1);
    const middle = revealAmount((REVEAL_NEAR + REVEAL_FAR) / 2);
    expect(middle).toBeGreaterThan(0.4);
    expect(middle).toBeLessThan(0.6);
    expect(revealAmount(REVEAL_FAR + 50, true)).toBe(1);
  });

  it('keeps the overview closed and opens the zone presets', () => {
    const [ox, oy, oz] = CAMERA_VIEWS.overview.pos;
    expect(revealAmount(Math.hypot(ox - 7, oy - 2, oz - 5))).toBe(0);
    for (const zone of ['café', 'garden', 'studio', 'courtyard'] as const) {
      const [x, y, z] = CAMERA_VIEWS[zone].pos;
      const [lx, ly, lz] = CAMERA_VIEWS[zone].look;
      // Presets are authored a little closer than the fitted distance; allow the fit factor.
      expect(revealAmount(Math.hypot(x - lx, y - ly, z - lz) * 1.3)).toBeGreaterThan(0.5);
    }
  });

  it('fades only the walls standing between the camera and the room', () => {
    const [x, , z] = CAMERA_VIEWS.overview.pos;
    for (const zone of ['café', 'garden', 'studio', 'courtyard'] as const) {
      expect(sideFacesCamera('south', zone, { x, z })).toBe(true);
      expect(sideFacesCamera('east', zone, { x, z })).toBe(true);
      expect(sideFacesCamera('north', zone, { x, z })).toBe(false);
      expect(sideFacesCamera('west', zone, { x, z })).toBe(false);
    }
    expect(sideFacesCamera('west', 'café', { x: -20, z: -4 })).toBe(true);
  });

  it('leaves a ghost of faded walls but removes roofs entirely', () => {
    expect(fadedOpacity(1, 0, 0.14)).toBe(1);
    expect(fadedOpacity(1, 1, 0.14)).toBeCloseTo(0.14);
    expect(fadedOpacity(1, 1, 0)).toBe(0);
    expect(fadedOpacity(0.38, 1, 0.1)).toBeCloseTo(0.038);
  });
});
