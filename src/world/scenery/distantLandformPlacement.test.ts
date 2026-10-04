import { describe, expect, it } from 'vitest';
import { meadowTrailPoint, renderedTerrainHeight } from '../terrain';
import { DAWNLIGHT_GLASSHOUSE, EAST_TRAIL_XZ } from './dawnlightPlacement';
import { SOUTHWIND_TRAIL_XZ } from './southwindTrailPlacement';
import { WOODLAND_TRAIL_XZ } from './woodlandPlacement';
import { NORTHSTAR_TRAIL_XZ } from './northstarPlacement';
import { WINDWARD_TRAIL_XZ } from './windwardPlacement';
import {
  DISTANT_LANDFORMS,
  LANDFORM_SKIRT_DROP,
  LANDFORM_SKIRT_RADIUS,
  landformRingPoint,
} from './distantLandformPlacement';

const travelled = [
  ...EAST_TRAIL_XZ,
  ...SOUTHWIND_TRAIL_XZ,
  ...WOODLAND_TRAIL_XZ,
  ...NORTHSTAR_TRAIL_XZ,
  ...WINDWARD_TRAIL_XZ,
  ...Array.from({ length: 35 }, (_, index) => {
    const [x, , z] = meadowTrailPoint(index);
    return [x, z] as const;
  }),
  [DAWNLIGHT_GLASSHOUSE.x, DAWNLIGHT_GLASSHOUSE.z] as const,
];

describe('distant rolling landform placement', () => {
  it('creates overlapping skyline bands beyond camera travel without approaching the mesh edge', () => {
    expect(DISTANT_LANDFORMS.length).toBeGreaterThanOrEqual(16);
    expect(DISTANT_LANDFORMS.some((form) => form.x < -250)).toBe(true);
    expect(DISTANT_LANDFORMS.some((form) => form.x > 250)).toBe(true);
    expect(DISTANT_LANDFORMS.some((form) => form.z > 250)).toBe(true);
    expect(DISTANT_LANDFORMS.some((form) => form.z < -250)).toBe(true);
    for (const form of DISTANT_LANDFORMS) {
      expect(Math.abs(form.x) + form.radiusX * LANDFORM_SKIRT_RADIUS).toBeLessThan(380);
      expect(Math.abs(form.z) + form.radiusZ * LANDFORM_SKIRT_RADIUS).toBeLessThan(380);
      expect(form.rise).toBeGreaterThan(0);
    }
    expect(LANDFORM_SKIRT_DROP).toBeGreaterThan(0.5);
  });

  it('embeds the entire high- and low-quality polygon perimeter below the sampled terrain', () => {
    for (const form of DISTANT_LANDFORMS)
      for (const sides of [12, 24])
        for (let section = 0; section < sides; section++) {
          const a = landformRingPoint(form, LANDFORM_SKIRT_RADIUS, section, sides);
          const b = landformRingPoint(form, LANDFORM_SKIRT_RADIUS, (section + 1) % sides, sides);
          const ay = renderedTerrainHeight(a.x, a.z) - LANDFORM_SKIRT_DROP;
          const by = renderedTerrainHeight(b.x, b.z) - LANDFORM_SKIRT_DROP;
          for (let step = 0; step <= 10; step++) {
            const t = step / 10;
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            const surface = ay + (by - ay) * t;
            expect(surface - renderedTerrainHeight(x, z)).toBeLessThan(-0.1);
          }
        }
  });

  it('keeps the full skirt outside connected walking paths', () => {
    for (const form of DISTANT_LANDFORMS)
      for (const [x, z] of travelled) {
        const normalized = Math.hypot(
          (x - form.x) / (form.radiusX * LANDFORM_SKIRT_RADIUS),
          (z - form.z) / (form.radiusZ * LANDFORM_SKIRT_RADIUS),
        );
        expect(normalized, `${form.x},${form.z} near ${x},${z}`).toBeGreaterThan(1.08);
      }
  });
});
