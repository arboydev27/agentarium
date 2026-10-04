import { describe, expect, it } from 'vitest';
import { CAMERA_VIEWS } from './layout';
import { WINDWARD_MILL } from './scenery/windwardPlacement';
import { AMBER_BLUFF } from './scenery/amberPlacement';
import { WOODLAND_HOLLOW } from './scenery/woodlandPlacement';
import {
  SCENIC_ENTER_PADDING,
  SCENIC_EXIT_PADDING,
  SCENIC_REGIONS,
  selectScenicRegions,
  type ScenicRegionId,
  type ScenicVisibilityInput,
} from './scenicVisibility';

const away = { x: 250, z: 250 };
const frame = (
  focus: { x: number; z: number },
  visibleGroundRadius = 10,
): ScenicVisibilityInput => ({
  mode: 'orthographic',
  focus,
  camera: away,
  visibleGroundRadius,
});
const ids = (input: ScenicVisibilityInput, previousIds?: ReadonlySet<ScenicRegionId>) =>
  selectScenicRegions(input, previousIds).map((region) => region.id);
const preset = (name: keyof typeof CAMERA_VIEWS) => ({
  focus: { x: CAMERA_VIEWS[name].look[0], z: CAMERA_VIEWS[name].look[2] },
  camera: { x: CAMERA_VIEWS[name].pos[0], z: CAMERA_VIEWS[name].pos[2] },
  visibleGroundRadius: 25,
});

describe('fixed scenic-region visibility', () => {
  it('has stable authored identities and keeps every region in Horizon', () => {
    const expected = [
      'lookout',
      'orchard',
      'observatory',
      'dawnlight',
      'slate',
      'windward',
      'amber',
      'woodland',
    ];
    expect(SCENIC_REGIONS.map((region) => region.id)).toEqual(expected);
    const horizon: ScenicVisibilityInput = { ...frame(away), mode: 'horizon' };
    expect(ids(horizon)).toEqual(expected);
    expect(ids({ ...frame(away), visibleGroundRadius: Number.NaN })).toEqual(expected);
    expect(ids({ ...frame(away), visibleGroundRadius: Infinity })).toEqual(expected);
    const first = selectScenicRegions(frame({ x: 36, z: -70 }));
    selectScenicRegions(frame(away)); // unmount between views
    const remounted = selectScenicRegions(frame({ x: 36, z: -70 }));
    expect(remounted.find((region) => region.id === 'orchard')).toBe(
      first.find((region) => region.id === 'orchard'),
    );
  });

  it('includes each landmark before its bounded orthographic view sees it', () => {
    for (const [view, region] of [
      ['lookout', 'lookout'],
      ['orchard', 'orchard'],
      ['observatory', 'observatory'],
      ['dawnlight', 'dawnlight'],
      ['windward', 'windward'],
      ['amber', 'amber'],
      ['hollow', 'woodland'],
    ] as const)
      expect(ids({ mode: 'orthographic', ...preset(view) }), view).toContain(region);
    expect(ids({ mode: 'orthographic', ...preset('observatory') })).toContain('slate');
    const mill = SCENIC_REGIONS.find((region) => region.id === 'windward')!;
    expect(mill.bounds.minX).toBeLessThan(WINDWARD_MILL.centerX);
    expect(mill.bounds.maxX).toBeGreaterThan(WINDWARD_MILL.x);
    expect(mill.bounds.maxZ).toBeGreaterThan(WINDWARD_MILL.z);
    const bluff = SCENIC_REGIONS.find((region) => region.id === 'amber')!;
    expect(bluff.bounds.minX).toBeLessThan(AMBER_BLUFF.x - AMBER_BLUFF.footprintRadius);
    expect(bluff.bounds.maxZ).toBeGreaterThan(AMBER_BLUFF.z + AMBER_BLUFF.footprintRadius);
    const hollow = SCENIC_REGIONS.find((region) => region.id === 'woodland')!;
    expect(hollow.bounds.minX).toBeLessThan(WOODLAND_HOLLOW.x - WOODLAND_HOLLOW.clearingRadius);
    expect(hollow.bounds.maxZ).toBeGreaterThan(WOODLAND_HOLLOW.z + WOODLAND_HOLLOW.clearingRadius);
  });

  it('prefetches ahead of the frustum and keeps a selected region through the exit band', () => {
    const lookout = SCENIC_REGIONS.find((region) => region.id === 'lookout')!;
    const x = lookout.bounds.maxX;
    const z = (lookout.bounds.minZ + lookout.bounds.maxZ) / 2;
    const radius = 10;
    const selected = frame({ x: x + radius + SCENIC_ENTER_PADDING - 0.1, z }, radius);
    const justOutside = frame({ x: x + radius + SCENIC_ENTER_PADDING + 0.1, z }, radius);
    expect(ids(selected)).toContain('lookout');
    expect(ids(justOutside)).not.toContain('lookout');
    expect(ids(justOutside, new Set(['lookout']))).toContain('lookout');
    expect(
      ids(frame({ x: x + radius + SCENIC_EXIT_PADDING + 0.1, z }, radius), new Set(['lookout'])),
    ).not.toContain('lookout');
    // Any landmark already inside the measured viewport must remain selected.
    expect(ids(frame({ x: x + radius - 0.1, z }, radius))).toContain('lookout');
    expect(
      ids({
        ...frame(away, 0),
        camera: {
          x: (lookout.bounds.minX + lookout.bounds.maxX) / 2,
          z,
        },
      }),
    ).toContain('lookout');
  });

  it('loads a distant preset immediately and survives rapid target changes during travel', () => {
    const orchard = preset('orchard');
    const dawnlight = preset('dawnlight');
    const observatory = preset('observatory');
    const movingToOrchard: ScenicVisibilityInput = {
      mode: 'orthographic',
      ...preset('overview'),
      target: orchard,
    };
    expect(ids(movingToOrchard)).toContain('orchard');
    expect(ids({ mode: 'orthographic', ...preset('overview'), target: preset('amber') })).toContain(
      'amber',
    );
    expect(
      ids({ mode: 'orthographic', ...preset('overview'), target: preset('windward') }),
    ).toContain('windward');
    const nearOrchard: ScenicVisibilityInput = {
      mode: 'orthographic',
      ...orchard,
      target: dawnlight,
    };
    const mounted = new Set(ids(nearOrchard));
    expect(mounted).toContain('orchard');
    expect(mounted).toContain('dawnlight');
    const switched: ScenicVisibilityInput = {
      ...nearOrchard,
      target: observatory,
    };
    expect(ids(switched, mounted)).toEqual(expect.arrayContaining(['orchard', 'observatory']));
    expect(ids({ mode: 'orthographic', ...observatory })).toContain('observatory');
  });
});
