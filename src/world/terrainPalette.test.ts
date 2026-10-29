import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LANDSCAPE_SEGMENTS, LANDSCAPE_SIZE, terrainHeight } from './terrain';
import { landscapeVertexColor } from './terrainPalette';

function maxDifference(a: THREE.Color, b: THREE.Color) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

function sample(x: number, z: number) {
  return landscapeVertexColor(x, z, terrainHeight(x, z), new THREE.Color());
}

describe('landscape vertex palette', () => {
  it('uses warm mineral colors across the landscape, including biome transitions', () => {
    for (let x = -600; x <= 600; x += 37) {
      for (let z = -600; z <= 600; z += 41) {
        const color = sample(x, z);
        expect(color.r).toBeGreaterThan(color.g);
        expect(color.r).toBeGreaterThan(color.b);
        expect(color.toArray().every((channel) => channel >= 0 && channel <= 1)).toBe(true);
      }
    }
  });

  it('returns the supplied color without retaining or depending on its prior contents', () => {
    const out = new THREE.Color('#ff0088');
    expect(landscapeVertexColor(-83, -20, 1, out)).toBe(out);
    const saved = out.clone();
    const other = new THREE.Color('#0011ff');
    landscapeVertexColor(-104, 88, 3, other);
    expect(out.equals(saved)).toBe(true);
    landscapeVertexColor(-83, -20, 1, other);
    expect(other.equals(out)).toBe(true);
    landscapeVertexColor(0, 0, 0.39, other);
    expect(other.equals(sample(0, 0))).toBe(true);
    expect(out.equals(saved)).toBe(true);
  });

  it('has no color jump across shared grid boundaries throughout the landscape', () => {
    const half = LANDSCAPE_SIZE / 2;
    const step = LANDSCAPE_SIZE / LANDSCAPE_SEGMENTS;
    const epsilon = 0.00001;
    // Traverse boundaries at intervals of 16 existing cells, including the
    // truncated final interval. Heights follow the continuous terrain field.
    const boundaries = Array.from({ length: Math.ceil(LANDSCAPE_SEGMENTS / 16) }, (_, i) => i * 16);
    boundaries.push(LANDSCAPE_SEGMENTS);
    for (const boundary of boundaries) {
      const edge = Math.fround(boundary * step - half);
      for (let index = 0; index <= LANDSCAPE_SEGMENTS; index += 7) {
        const along = Math.fround(index * step - half);
        const verticalEdge = maxDifference(
          sample(edge - epsilon, along),
          sample(edge + epsilon, along),
        );
        const horizontalEdge = maxDifference(
          sample(along, edge - epsilon),
          sample(along, edge + epsilon),
        );
        expect(verticalEdge).toBeLessThan(0.000001);
        expect(horizontalEdge).toBeLessThan(0.000001);
      }
    }
  });

  it('blends continuously at biome support and core boundaries', () => {
    const epsilon = 0.00001;
    for (const [x, z] of [
      [-83 + 56 * 1.2, -20],
      [-83 + 56 * 0.35, -20],
      [-83, -20 + 72 * 1.2],
      [-104 + 70 * 1.2, 88],
      [-104, 88 - 55 * 0.3],
      [0, -58],
      [0, -85],
      [-83, -74],
    ]) {
      expect(maxDifference(sample(x - epsilon, z), sample(x + epsilon, z))).toBeLessThan(0.000001);
      expect(maxDifference(sample(x, z - epsilon), sample(x, z + epsilon))).toBeLessThan(0.000001);
    }
  });

  it('keeps the ridge tint continuous and bounded at both height clamps', () => {
    const out = new THREE.Color();
    for (const [x, z] of [
      [250, 200],
      [-83, -74],
    ]) {
      const lower = landscapeVertexColor(x, z, 2.5, out).clone();
      expect(landscapeVertexColor(x, z, -100, out).equals(lower)).toBe(true);
      const upper = landscapeVertexColor(x, z, 12.7, out).clone();
      expect(maxDifference(landscapeVertexColor(x, z, 100, out), upper)).toBeLessThan(1e-15);
      for (const height of [2.5, 12.7]) {
        const below = landscapeVertexColor(x, z, height - 0.00001, out).clone();
        const above = landscapeVertexColor(x, z, height + 0.00001, out);
        expect(maxDifference(below, above)).toBeLessThan(0.000001);
      }
    }
  });
});
