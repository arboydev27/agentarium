import { describe, expect, it } from 'vitest';
import { ambientStep, leafPose, frameSummary } from './ambient';

describe('ambient movement boundaries', () => {
  it('stops for reduced motion and low quality, and clamps resumed frames', () => {
    expect(ambientStep(1 / 60, true, false)).toBe(0);
    expect(ambientStep(1 / 60, false, true)).toBe(0);
    expect(ambientStep(10, false, false)).toBe(0.05);
    expect(ambientStep(-1, false, false)).toBe(0);
  });
  it('keeps every leaf in a perimeter strip above the ground over repeated cycles', () => {
    for (let time = 0; time < 100; time += 0.13) {
      for (let i = 0; i < 12; i++) {
        const p = leafPose(time, i);
        expect(Math.abs(p.x)).toBeGreaterThanOrEqual(12.35);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(13.05);
        expect(p.y).toBeGreaterThanOrEqual(0.5);
        expect(p.y).toBeLessThanOrEqual(3.7);
        expect(p.scale).toBeGreaterThanOrEqual(0);
        expect(p.scale).toBeLessThanOrEqual(0.13);
      }
    }
  });
  it('hides leaves at the cycle boundary so recycling does not visibly teleport them', () => {
    expect(leafPose(0, 0).scale).toBe(0);
    expect(leafPose(1 / 0.075 - 0.00001, 0).scale).toBeLessThan(0.00001);
  });
});
it('reports average interval FPS and the 95th percentile without modifying samples', () => {
  const samples = [40, ...Array<number>(19).fill(10)];
  expect(frameSummary(samples)).toEqual({ fps: 1000 / 11.5, p95: 10 });
  expect(samples[0]).toBe(40);
  expect(frameSummary([])).toEqual({ fps: 0, p95: 0 });
});
