import { describe, expect, it } from 'vitest';
import { DESTINATIONS, NODES } from './navigation';
import { LOOKOUT, ZONES } from './layout';
import {
  beaconPulse,
  clearOfRoverLoops,
  DEVIL_ACTIVE,
  DEVIL_CYCLE,
  DISH_TRACK,
  dishTrackPose,
  DUST_DEVILS,
  dustDevilState,
  launchDustWash,
  ROVER_LOOP,
  ROVER_LOOPS,
  roverDustPuff,
  roverLoopById,
  roverLoopPose,
  roverPatrolPose,
  TELESCOPE_DWELL,
  TELESCOPE_SLEW,
  TELESCOPE_TARGETS,
  telescopeSlewPose,
  type RoverLoop,
} from './ambientLife';
import {
  NORTHSTAR_OUTPOST,
  NORTHSTAR_TOWER_XZ,
  NORTHSTAR_TRAIL_XZ,
} from './scenery/northstarPlacement';
import { meadowTrailPoint } from './terrain';
import { SOUTHWIND_TRAIL_XZ } from './scenery/southwindTrailPlacement';
import { EAST_TRAIL_XZ } from './scenery/dawnlightPlacement';
import { WINDWARD_MILL, WINDWARD_TRAIL_XZ } from './scenery/windwardPlacement';
import { WOODLAND_TRAIL_XZ } from './scenery/woodlandPlacement';
import { ORCHARD_BRANCH } from './scenery/orchardPlacement';
import { OBSERVATORY_BRANCH } from './scenery/observatoryPlacement';
import { TRAIL_TURNOUTS, turnoutPoint } from './scenery/turnoutPlacement';
import { clearOfMeadowRoutes } from './scenery/meadowPlacement';
import { buildOuterLandscape } from './scenery/outerLandscapePlacement';

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

describe('machines at work', () => {
  const trailSamples = (): [number, number][] => {
    const samples: [number, number][] = [];
    for (let index = 0; index <= 34; index++) {
      const [x, , z] = meadowTrailPoint(index);
      samples.push([x, z]);
    }
    const [startX, , startZ] = meadowTrailPoint(12);
    for (let i = 0; i <= 20; i++)
      samples.push([
        startX + (LOOKOUT.x - startX) * (i / 20),
        startZ + (LOOKOUT.z - startZ) * (i / 20),
      ]);
    for (const trail of [
      SOUTHWIND_TRAIL_XZ,
      EAST_TRAIL_XZ,
      WINDWARD_TRAIL_XZ,
      WOODLAND_TRAIL_XZ,
      NORTHSTAR_TRAIL_XZ,
      ORCHARD_BRANCH,
      OBSERVATORY_BRANCH,
    ])
      for (const [x, z] of trail) samples.push([x, z]);
    return samples;
  };
  const loopPoints = (loop: RoverLoop) =>
    Array.from({ length: Math.ceil(loop.period / 0.5) }, (_, i) => roverLoopPose(loop, i * 0.5));

  it('keeps every rover loop clear of nodes, trails, zones and turnouts', () => {
    const nodes = Object.values(NODES).map(([x, , z]) => [x, z] as const);
    const trails = trailSamples();
    const turnouts = TRAIL_TURNOUTS.map(({ trailIndex, side }) => {
      const [x, , z] = turnoutPoint(trailIndex, side, 4.8);
      return [x, z] as const;
    });
    expect(ROVER_LOOPS.map((loop) => loop.id)).toEqual(['northstar', 'helios', 'plains']);
    for (const loop of ROVER_LOOPS) {
      for (const { x, z, heading } of loopPoints(loop)) {
        expect(Number.isFinite(heading)).toBe(true);
        for (const [px, pz] of nodes)
          expect(Math.hypot(x - px, z - pz), loop.id).toBeGreaterThan(3);
        for (const [px, pz] of trails)
          expect(Math.hypot(x - px, z - pz), loop.id).toBeGreaterThan(3);
        for (const [px, pz] of turnouts)
          expect(Math.hypot(x - px, z - pz), loop.id).toBeGreaterThan(3.6 + 3);
        for (const zone of Object.values(ZONES)) {
          const outside =
            Math.abs(x - zone.center[0]) > zone.size[0] / 2 + 3 ||
            Math.abs(z - zone.center[2]) > zone.size[1] / 2 + 3;
          expect(outside, loop.id).toBe(true);
        }
      }
    }
  });

  it('matches the spaceport loop to the pad-local patrol and follows the tangent', () => {
    const northstar = roverLoopById('northstar');
    const [tx, tz] = NORTHSTAR_TOWER_XZ;
    for (let t = 0; t < northstar.period; t += 4) {
      const local = roverPatrolPose(t);
      const world = roverLoopPose(northstar, t);
      expect(world.x).toBeCloseTo(tx + local.x, 6);
      expect(world.z).toBeCloseTo(tz + local.z, 6);
      expect(world.heading).toBeCloseTo(local.heading, 6);
    }
    for (const loop of ROVER_LOOPS) {
      const a = roverLoopPose(loop, 5);
      const b = roverLoopPose(loop, 5.05);
      expect(Math.atan2(b.x - a.x, b.z - a.z)).toBeCloseTo(a.heading, 1);
      const shifted = roverLoopPose(loop, 0, 10);
      expect(shifted).toEqual(roverLoopPose(loop, 10));
    }
  });

  it('keeps the Helios rover off the racks, the mast and the habitat', () => {
    const helios = roverLoopById('helios');
    const racks = [0, 1, 2].flatMap((row) =>
      [0, 1].map((column) => [
        WINDWARD_MILL.centerX - 8 - column * 5,
        WINDWARD_MILL.centerZ - 5 + row * 4,
      ]),
    );
    for (const { x, z } of loopPoints(helios)) {
      for (const [rx, rz] of racks) expect(Math.hypot(x - rx, z - rz)).toBeGreaterThan(3.5);
      expect(Math.hypot(x - WINDWARD_MILL.centerX, z - WINDWARD_MILL.centerZ)).toBeGreaterThan(7);
      // The tall mast stands at centre + (3, -5).
      expect(
        Math.hypot(x - WINDWARD_MILL.centerX - 3, z - WINDWARD_MILL.centerZ + 5),
      ).toBeGreaterThan(4);
    }
  });

  it('keeps rocks and groundcover out of every rover path', () => {
    for (const loop of ROVER_LOOPS) {
      for (const { x, z } of loopPoints(loop)) {
        expect(clearOfRoverLoops(x, z)).toBe(false);
        expect(clearOfMeadowRoutes(x, z)).toBe(false);
      }
      // Well off the path the loop imposes nothing.
      const far = roverLoopPose(loop, 0);
      expect(
        clearOfRoverLoops(
          loop.center[0] + (far.x - loop.center[0]) * 2.2,
          loop.center[1] + (far.z - loop.center[1]) * 2.2,
        ),
      ).toBe(true);
    }
    const { rocks, trees } = buildOuterLandscape('high');
    for (const piece of [...rocks, ...trees])
      expect(clearOfRoverLoops(piece.x, piece.z)).toBe(true);
    expect(rocks.length).toBeGreaterThan(20);
  });

  it('puffs dust behind a moving rover and none when parked', () => {
    const puff = roverDustPuff(3, false);
    expect(puff.opacity).toBeGreaterThan(0.1);
    expect(puff.opacity).toBeLessThan(0.3);
    expect(puff.scale).toBeGreaterThan(1);
    expect(roverDustPuff(3, true)).toEqual({ scale: 0, opacity: 0 });
  });

  it('tracks the roof dish across the sky, swings it back and holds it', () => {
    const { start, sweep, track, slew, hold } = DISH_TRACK;
    expect(dishTrackPose(0)).toEqual({ yaw: start, tracking: true });
    expect(dishTrackPose(track / 2).yaw).toBeCloseTo(start + sweep / 2, 6);
    expect(dishTrackPose(track - 0.001).yaw).toBeCloseTo(start + sweep, 2);
    const back = dishTrackPose(track + slew / 2);
    expect(back.tracking).toBe(false);
    expect(back.yaw).toBeCloseTo(start + sweep / 2, 6);
    expect(dishTrackPose(track + slew + hold / 2)).toEqual({ yaw: start, tracking: false });
    expect(dishTrackPose(track + slew + hold + 1).yaw).toBeCloseTo(dishTrackPose(1).yaw, 6);
    // Nothing jumps by more than the slew rate between frames.
    let previous = dishTrackPose(0).yaw;
    for (let t = 1 / 60; t < 2 * (track + slew + hold); t += 1 / 60) {
      const { yaw } = dishTrackPose(t);
      expect(Math.abs(yaw - previous)).toBeLessThan(0.02);
      previous = yaw;
    }
  });

  it('dwells the telescope on each target and slews the short way round', () => {
    const step = TELESCOPE_DWELL + TELESCOPE_SLEW;
    TELESCOPE_TARGETS.forEach((target, index) => {
      expect(telescopeSlewPose(index * step + 1)).toEqual({ yaw: target, slewing: false });
    });
    const mid = telescopeSlewPose(TELESCOPE_DWELL + TELESCOPE_SLEW / 2);
    expect(mid.slewing).toBe(true);
    expect(mid.yaw).toBeCloseTo((TELESCOPE_TARGETS[0] + TELESCOPE_TARGETS[1]) / 2, 6);
    // From the last target back to the first the arc is under pi.
    const last = TELESCOPE_TARGETS.length - 1;
    const wrap = telescopeSlewPose(last * step + TELESCOPE_DWELL + TELESCOPE_SLEW / 2);
    const arc = wrap.yaw - TELESCOPE_TARGETS[last];
    expect(Math.abs(arc)).toBeLessThan(Math.PI / 2);
    let previous = telescopeSlewPose(0).yaw;
    for (let t = 1 / 60; t < step * TELESCOPE_TARGETS.length; t += 1 / 60) {
      const { yaw } = telescopeSlewPose(t);
      expect(Math.abs(yaw - previous)).toBeLessThan(0.03);
      previous = yaw;
    }
  });
});
