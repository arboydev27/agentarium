import { describe, expect, it } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import { CAMERA_PAN_BOUNDS } from './cameraPan';
import { AMBER_BLUFF } from './scenery/amberPlacement';
import {
  WORLD,
  ZONES,
  SEATS,
  CAMERA_VIEWS,
  OBSERVATORY,
  ORCHARD,
  WORLD_VIEWS,
  WORLD_VIEW_LABELS,
} from './layout';
import { DAWNLIGHT_GLASSHOUSE } from './scenery/dawnlightPlacement';
import { SOUTHWIND_SHORE } from './scenery/southwindTrailPlacement';
import { WINDWARD_MILL } from './scenery/windwardPlacement';
import { NORTHSTAR_OUTPOST } from './scenery/northstarPlacement';
import { renderedTerrainHeight } from './terrain';
import { WOODLAND_HOLLOW } from './scenery/woodlandPlacement';
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
  it('bookmarks Orchard Commons in the finite outer terrain', () => {
    expect(WORLD_VIEWS).toContain('orchard');
    expect(ORCHARD).toMatchObject({ x: 36, z: -70 });
    expect(ORCHARD.clearingRadius).toBeGreaterThan(3);
    expect(ORCHARD.focusRadius).toBeGreaterThan(ORCHARD.clearingRadius);
    expect(CAMERA_VIEWS.orchard.look[0]).toBe(ORCHARD.x);
    expect(CAMERA_VIEWS.orchard.look[2]).toBe(ORCHARD.z);
    expect(CAMERA_VIEWS.orchard.span.every((value) => value > 0)).toBe(true);
  });
  it('bookmarks Southwind Mere with the shore and lake in frame', () => {
    const camera = CAMERA_VIEWS.mere;
    expect(WORLD_VIEWS).toContain('mere');
    expect(WORLD_VIEW_LABELS.mere).toBe('Southwind Mere');
    expect(SOUTHWIND_SHORE).toMatchObject({ x: -42, z: 43 });
    expect(
      Math.hypot(camera.look[0] - SOUTHWIND_SHORE.x, camera.look[2] - SOUTHWIND_SHORE.z),
    ).toBeLessThanOrEqual(SOUTHWIND_SHORE.focusRadius);
    expect(camera.look[0]).toBeLessThan(SOUTHWIND_SHORE.x);
    expect(camera.pos[0]).toBeGreaterThan(SOUTHWIND_SHORE.x);
    expect(camera.span.every((value) => value > 0)).toBe(true);
  });
  it('frames Dawnlight Glasshouse and its resident arrival from the eastern view', () => {
    const preset = CAMERA_VIEWS.dawnlight;
    expect(WORLD_VIEWS).toContain('dawnlight');
    expect(WORLD_VIEW_LABELS.dawnlight).toBe('Dawnlight Glasshouse');
    expect(preset.look[0]).toBeCloseTo(DAWNLIGHT_GLASSHOUSE.centerX + 1);
    expect(preset.look[2]).toBeCloseTo(DAWNLIGHT_GLASSHOUSE.centerZ + 1);
    expect(preset.span.every((value) => value > 0)).toBe(true);
    const camera = new OrthographicCamera(
      -preset.span[0] / 2,
      preset.span[0] / 2,
      preset.span[1] / 2,
      -preset.span[1] / 2,
      0.1,
      400,
    );
    camera.position.fromArray(preset.pos);
    camera.lookAt(new Vector3(...preset.look));
    camera.updateMatrixWorld();
    const arrival = new Vector3(DAWNLIGHT_GLASSHOUSE.x, 0, DAWNLIGHT_GLASSHOUSE.z).project(camera);
    expect(Math.abs(arrival.x)).toBeLessThan(1);
    expect(Math.abs(arrival.y)).toBeLessThan(1);
  });
  it('frames Windward Mill and its arrival within the finite camera area', () => {
    const preset = CAMERA_VIEWS.windward;
    expect(WORLD_VIEWS).toContain('windward');
    expect(WORLD_VIEW_LABELS.windward).toBe('Windward Mill');
    expect(preset.look[0]).toBe(WINDWARD_MILL.centerX);
    expect(preset.look[2]).toBe(WINDWARD_MILL.centerZ);
    expect(
      Math.hypot(WINDWARD_MILL.x - WINDWARD_MILL.centerX, WINDWARD_MILL.z - WINDWARD_MILL.centerZ),
    ).toBeLessThan(WINDWARD_MILL.focusRadius);
    for (const [x, z] of [
      [preset.pos[0], preset.pos[2]],
      [preset.look[0], preset.look[2]],
    ]) {
      expect(x).toBeGreaterThanOrEqual(CAMERA_PAN_BOUNDS.minX);
      expect(x).toBeLessThanOrEqual(CAMERA_PAN_BOUNDS.maxX);
      expect(z).toBeGreaterThanOrEqual(CAMERA_PAN_BOUNDS.minZ);
      expect(z).toBeLessThanOrEqual(CAMERA_PAN_BOUNDS.maxZ);
    }
    const camera = new OrthographicCamera(
      -preset.span[0] / 2,
      preset.span[0] / 2,
      preset.span[1] / 2,
      -preset.span[1] / 2,
      0.1,
      400,
    );
    camera.position.fromArray(preset.pos);
    camera.lookAt(new Vector3(...preset.look));
    camera.updateMatrixWorld();
    for (const point of [
      [WINDWARD_MILL.centerX, 0, WINDWARD_MILL.centerZ],
      [WINDWARD_MILL.x, 0, WINDWARD_MILL.z],
    ] as const) {
      const projected = new Vector3(...point).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(1);
      expect(Math.abs(projected.y)).toBeLessThan(1);
    }
  });
  it('frames scenic-only Amber Bluff inside the expanded camera travel area', () => {
    const preset = CAMERA_VIEWS.amber;
    expect(WORLD_VIEWS).toContain('amber');
    expect(WORLD_VIEW_LABELS.amber).toContain('scenic only');
    expect(preset.look[0]).toBe(AMBER_BLUFF.x);
    expect(preset.look[2]).toBe(AMBER_BLUFF.z);
    for (const [x, z] of [
      [preset.pos[0], preset.pos[2]],
      [preset.look[0], preset.look[2]],
    ]) {
      expect(x).toBeGreaterThanOrEqual(CAMERA_PAN_BOUNDS.minX);
      expect(x).toBeLessThanOrEqual(CAMERA_PAN_BOUNDS.maxX);
      expect(z).toBeGreaterThanOrEqual(CAMERA_PAN_BOUNDS.minZ);
      expect(z).toBeLessThanOrEqual(CAMERA_PAN_BOUNDS.maxZ);
    }
    const camera = new OrthographicCamera(
      -preset.span[0] / 2,
      preset.span[0] / 2,
      preset.span[1] / 2,
      -preset.span[1] / 2,
      0.1,
      400,
    );
    camera.position.fromArray(preset.pos);
    camera.lookAt(new Vector3(...preset.look));
    camera.updateMatrixWorld();
    const center = new Vector3(AMBER_BLUFF.x, 5, AMBER_BLUFF.z).project(camera);
    expect(Math.abs(center.x)).toBeLessThan(1);
    expect(Math.abs(center.y)).toBeLessThan(1);
  });
  it('frames Lantern Hollow and its resident arrival inside the western woods', () => {
    const preset = CAMERA_VIEWS.hollow;
    expect(WORLD_VIEWS).toContain('hollow');
    expect(WORLD_VIEW_LABELS.hollow).toBe(WOODLAND_HOLLOW.label);
    expect(
      Math.hypot(preset.look[0] - WOODLAND_HOLLOW.x, preset.look[2] - WOODLAND_HOLLOW.z),
    ).toBeLessThan(4);
    expect(preset.span.every((value) => value > 0)).toBe(true);
    const camera = new OrthographicCamera(
      -preset.span[0] / 2,
      preset.span[0] / 2,
      preset.span[1] / 2,
      -preset.span[1] / 2,
      0.1,
      400,
    );
    camera.position.fromArray(preset.pos);
    camera.lookAt(new Vector3(...preset.look));
    camera.updateMatrixWorld();
    const arrival = new Vector3(WOODLAND_HOLLOW.x, 0, WOODLAND_HOLLOW.z).project(camera);
    expect(Math.abs(arrival.x)).toBeLessThan(1);
    expect(Math.abs(arrival.y)).toBeLessThan(1);
  });
  it('frames Northstar arrival and outpost tower inside the northern highlands', () => {
    const preset = CAMERA_VIEWS.northstar;
    expect(WORLD_VIEWS).toContain('northstar');
    expect(WORLD_VIEW_LABELS.northstar).toBe(NORTHSTAR_OUTPOST.label);
    expect(NORTHSTAR_OUTPOST).toMatchObject({ x: 43, z: -112 });
    expect(preset.span.every((value) => value > 0)).toBe(true);
    for (const [x, z] of [
      [preset.pos[0], preset.pos[2]],
      [preset.look[0], preset.look[2]],
    ]) {
      expect(x).toBeGreaterThanOrEqual(CAMERA_PAN_BOUNDS.minX);
      expect(x).toBeLessThanOrEqual(CAMERA_PAN_BOUNDS.maxX);
      expect(z).toBeGreaterThanOrEqual(CAMERA_PAN_BOUNDS.minZ);
      expect(z).toBeLessThanOrEqual(CAMERA_PAN_BOUNDS.maxZ);
    }
    const camera = new OrthographicCamera(
      -preset.span[0] / 2,
      preset.span[0] / 2,
      preset.span[1] / 2,
      -preset.span[1] / 2,
      0.1,
      400,
    );
    camera.position.fromArray(preset.pos);
    camera.lookAt(new Vector3(...preset.look));
    camera.updateMatrixWorld();
    for (const [x, y, z] of [
      [
        NORTHSTAR_OUTPOST.x,
        renderedTerrainHeight(NORTHSTAR_OUTPOST.x, NORTHSTAR_OUTPOST.z),
        NORTHSTAR_OUTPOST.z,
      ],
      [
        NORTHSTAR_OUTPOST.x + 6,
        renderedTerrainHeight(NORTHSTAR_OUTPOST.x + 6, NORTHSTAR_OUTPOST.z - 6) + 9,
        NORTHSTAR_OUTPOST.z - 6,
      ],
    ]) {
      const projected = new Vector3(x, y, z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(1);
      expect(Math.abs(projected.y)).toBeLessThan(1);
    }
  });
  it('bookmarks Cedar Observatory west of the meadow trail', () => {
    expect(WORLD_VIEWS).toContain('observatory');
    expect(WORLD_VIEWS).toHaveLength(15);
    expect(OBSERVATORY).toMatchObject({ x: -30, z: -50 });
    expect(OBSERVATORY.focusRadius).toBeGreaterThan(OBSERVATORY.clearingRadius);
    expect(CAMERA_VIEWS.observatory.look[0]).toBe(OBSERVATORY.x);
    expect(CAMERA_VIEWS.observatory.look[2]).toBe(OBSERVATORY.z);
    expect(CAMERA_VIEWS.observatory.span.every((value) => value > 0)).toBe(true);
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
