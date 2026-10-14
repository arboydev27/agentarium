import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LANDSCAPE_SEGMENTS, LANDSCAPE_SIZE, terrainHeight } from './terrain';
import { landscapeVertexColor } from './terrainPalette';

// Linear RGB captured from Landscape's original vertex-color loop. The samples
// cover meadow, each authored biome, overlapping biomes, and both height clamps.
const legacySamples = [
  { x: 0, z: 0, y: 0.39, rgb: [0.262984035101316, 0.3809977280560244, 0.18638911065459796] },
  { x: 34, z: 12, y: -1, rgb: [0.2591568119444966, 0.37862977709094525, 0.18434275783777454] },
  { x: -83, z: -20, y: 1, rgb: [0.11511162364024106, 0.22401112057654987, 0.10626761278989443] },
  { x: -30, z: -32, y: 4, rgb: [0.23000510183626233, 0.3453821317847697, 0.18061039421017014] },
  { x: -104, z: 88, y: 3, rgb: [0.4713622298173079, 0.3351987374015683, 0.13072453009574458] },
  { x: -56, z: 45, y: 2, rgb: [0.2802287246238395, 0.36976444715075624, 0.18144343797774543] },
  { x: -83, z: -74, y: 10, rgb: [0.18073598809817976, 0.2750555766538695, 0.2268919658121457] },
  { x: 15, z: -71.5, y: 8, rgb: [0.25173177346576514, 0.34899442530966085, 0.2774739101484704] },
  { x: 15, z: -90, y: 14, rgb: [0.2413982737701938, 0.3270960021654885, 0.3246147757782871] },
  { x: 250, z: 200, y: 2.5, rgb: [0.24387841655084821, 0.3691768422515471, 0.17617365293605858] },
  { x: 250, z: 200, y: 12.7, rgb: [0.27364188642872433, 0.3666912325878148, 0.2894746323261401] },
  { x: -600, z: -600, y: 30, rgb: [0.24283653944933636, 0.3279858751787455, 0.32538379260935685] },
  { x: 600, z: 600, y: -2, rgb: [0.23581104146839776, 0.36418545611350467, 0.1718601611306675] },
];

function maxDifference(a: THREE.Color, b: THREE.Color) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

function sample(x: number, z: number) {
  return landscapeVertexColor(x, z, terrainHeight(x, z), new THREE.Color());
}

describe('landscape vertex palette', () => {
  it.each(legacySamples)('preserves the legacy color at ($x, $z, $y)', ({ x, z, y, rgb }) => {
    const color = landscapeVertexColor(x, z, y, new THREE.Color());
    color.toArray().forEach((channel, index) => expect(channel).toBeCloseTo(rgb[index], 12));
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
    expect(other.toArray()).toEqual(legacySamples[0].rgb);
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
