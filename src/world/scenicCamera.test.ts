import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { measureScenicFrame } from './scenicCamera';
import { selectScenicRegions, SCENIC_REGIONS } from './scenicVisibility';

function overview(width = 1280, height = 720, zoom = 30) {
  const camera = new THREE.OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.1,
    360,
  );
  camera.zoom = zoom;
  camera.position.set(27, 26, 35);
  camera.lookAt(0, 2.8, 0);
  camera.updateProjectionMatrix();
  return camera;
}

describe('scenic camera asset coverage', () => {
  it('starts with nearby landmarks instead of requesting every distant asset', () => {
    const frame = measureScenicFrame(overview());
    const selected = selectScenicRegions({ mode: 'orthographic', ...frame });
    expect(Number.isFinite(frame.visibleGroundRadius)).toBe(true);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThan(SCENIC_REGIONS.length);
    const ids = selected.map((region) => region.id);
    expect(ids).not.toContain('amber');
    expect(ids).not.toContain('northstar');
  });

  it('expands asset coverage for a wider, zoomed-out view', () => {
    const ordinary = measureScenicFrame(overview());
    const broad = measureScenicFrame(overview(1920, 1080, 5));
    expect(broad.visibleGroundRadius).toBeGreaterThan(ordinary.visibleGroundRadius);
    expect(selectScenicRegions({ mode: 'orthographic', ...broad })).toHaveLength(
      SCENIC_REGIONS.length,
    );
  });

  it('keeps coverage conservative when a level camera cannot intersect the ground', () => {
    const camera = overview();
    camera.position.set(0, 12, 0);
    camera.lookAt(0, 12, -1);
    const frame = measureScenicFrame(camera);
    expect(frame.visibleGroundRadius).toBe(Infinity);
    expect(selectScenicRegions({ mode: 'orthographic', ...frame })).toHaveLength(
      SCENIC_REGIONS.length,
    );
  });
});
