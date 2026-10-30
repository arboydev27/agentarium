import { describe, expect, it } from 'vitest';
import { DESTINATIONS, NODES } from './navigation';
import { ZONES } from './layout';
import {
  beaconPulse,
  DEVIL_ACTIVE,
  DEVIL_CYCLE,
  DUST_DEVILS,
  dustDevilState,
  launchDustWash,
  ROVER_LOOP,
  roverPatrolPose,
} from './ambientLife';
import {
  NORTHSTAR_OUTPOST,
  NORTHSTAR_TOWER_XZ,
  NORTHSTAR_TRAIL_XZ,
} from './scenery/northstarPlacement';

describe('ambient life', () => {
  it('keeps dust devils far from the colony, every destination and the trails', () => {
    const points = [
      ...Object.values(NODES).map(([x, , z]) => [x, z]),
      ...Object.values(ZONES).map(({ center }) => [center[0], center[2]]),
    ];
    for (const [index, devil] of DUST_DEVILS.entries()) {
      for (let t = 0; t < 400; t += 7) {
        const { x, z } = dustDevilState(t, index);
        expect(Math.hypot(x - devil.center[0], z - devil.center[1])).toBeLessThan(devil.radius + 4);
        for (const [px, pz] of points)
          expect(Math.hypot(x - px, z - pz), `t=${t}`).toBeGreaterThan(30);
      }
    }
    expect(DESTINATIONS.length).toBeGreaterThan(0);
  });

  it('fades each devil in and out inside its cycle', () => {
    expect(dustDevilState(0, 0).presence).toBe(0);
    expect(dustDevilState(20, 0).presence).toBe(1);
    expect(dustDevilState(DEVIL_ACTIVE + 1, 0).presence).toBe(0);
    expect(dustDevilState(DEVIL_CYCLE + 3, 0).presence).toBeCloseTo(0.5, 5);
  });

  it('pulses beacons between a floor and a peak, steady under reduced motion', () => {
    const samples = Array.from({ length: 32 }, (_, i) => beaconPulse(i / 20, false));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.9);
    expect(Math.max(...samples)).toBeLessThanOrEqual(2.8);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(1);
    expect(beaconPulse(0.4, true)).toBe(2);
  });

  it('drives the rover on a loop clear of the pad, the arrival trail and the fuel farm', () => {
    const [tx, tz] = NORTHSTAR_TOWER_XZ;
    for (let t = 0; t < ROVER_LOOP.period; t += 0.5) {
      const { x, z, heading } = roverPatrolPose(t);
      expect(Math.hypot(x, z)).toBeGreaterThan(4.5 + 1.4);
      for (const [px, pz] of NORTHSTAR_TRAIL_XZ)
        expect(Math.hypot(tx + x - px, tz + z - pz)).toBeGreaterThan(2.5);
      expect(
        Math.hypot(tx + x - NORTHSTAR_OUTPOST.x, tz + z - NORTHSTAR_OUTPOST.z),
      ).toBeGreaterThan(5);
      expect(Math.hypot(tx + x - 55, tz + z + 124)).toBeGreaterThan(3.2);
      expect(Number.isFinite(heading)).toBe(true);
    }
    const a = roverPatrolPose(0);
    const b = roverPatrolPose(0.1);
    expect(Math.atan2(b.x - a.x, b.z - a.z)).toBeCloseTo(a.heading, 1);
  });

  it('washes dust outward for three seconds after ignition', () => {
    expect(launchDustWash(-1)).toEqual({ scale: 0, opacity: 0 });
    expect(launchDustWash(0).opacity).toBeCloseTo(0.55);
    expect(launchDustWash(1.5).scale).toBeGreaterThan(launchDustWash(0.5).scale);
    expect(launchDustWash(2.9).opacity).toBeLessThan(0.01);
    expect(launchDustWash(3.1)).toEqual({ scale: 0, opacity: 0 });
  });
});
