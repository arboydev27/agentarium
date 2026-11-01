import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  BAKED_LAYER,
  GROUND_LAYER_BASE,
  GROUND_SETS,
  groundTextureUrls,
  scannedGroundAvailable,
  TEXTURE_PAYLOAD_CEILING,
} from './groundSets';
import { surfaceTextureUrls, type SurfaceFamily } from './surfaceTextures';
import { bakeTerrainLayer, TERRAIN_LAYERS } from './terrainBake';

const KTX2_MAGIC = Buffer.from([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const publicFile = (url: string) => new URL(`../../public${url}`, import.meta.url);

describe('ground layer manifest', () => {
  it('records each baked layer’s mean colour, tile size and normal strength', () => {
    for (const layer of TERRAIN_LAYERS) {
      const size = 128;
      const baked = bakeTerrainLayer(layer, size);
      const sum = [0, 0, 0];
      for (let i = 0; i < size * size; i++)
        for (let c = 0; c < 3; c++) sum[c] += baked.color[i * 4 + c];
      sum.forEach((value, c) => {
        const mean = value / (size * size * 255);
        expect(Math.abs(mean - GROUND_LAYER_BASE[layer][c]), `${layer} channel ${c}`).toBeLessThan(
          0.01,
        );
      });
      expect(BAKED_LAYER[layer].metres).toBeGreaterThan(1);
      expect(BAKED_LAYER[layer].normalScale).toBeGreaterThan(0);
    }
  });

  it('names a colour, normal and ARM map per layer under the ground directory', () => {
    for (const layer of TERRAIN_LAYERS) {
      expect(groundTextureUrls(layer)).toEqual([
        `/textures/ground/${layer}-color.ktx2`,
        `/textures/ground/${layer}-normal.ktx2`,
        `/textures/ground/${layer}-arm.ktx2`,
      ]);
    }
    // A partial manifest never switches the ground over: every layer or none.
    const layers = TERRAIN_LAYERS.filter((layer) => GROUND_SETS[layer]);
    expect(scannedGroundAvailable()).toBe(layers.length === TERRAIN_LAYERS.length);
  });

  it('ships every scanned set as 1K KTX2 inside the payload ceiling, with its licence on record', async () => {
    expect(scannedGroundAvailable()).toBe(true);
    const licence = await readFile(publicFile('/textures/LICENSE.md'), 'utf8');
    let total = 0;
    for (const layer of TERRAIN_LAYERS) {
      const set = GROUND_SETS[layer]!;
      expect(set.licence).toBe('CC0 1.0');
      expect(set.metres).toBeGreaterThan(0.5);
      expect(set.metres).toBeLessThan(8);
      set.mean.forEach((channel) => {
        expect(channel).toBeGreaterThan(0.05);
        expect(channel).toBeLessThan(0.95);
      });
      expect(licence, `${set.id} recorded`).toContain(set.id);
      expect(licence, `${set.id} page`).toContain(set.page);
      expect(licence, `${set.id} authors`).toContain(set.authors);
      for (const url of groundTextureUrls(layer)) {
        const bytes = await readFile(publicFile(url));
        expect(bytes.subarray(0, 12).equals(KTX2_MAGIC), url).toBe(true);
        expect(bytes.readUInt32LE(20), url).toBe(1024);
        expect(bytes.readUInt32LE(24), url).toBe(1024);
        expect(bytes.readUInt32LE(40), url).toBeGreaterThan(5);
        total += bytes.length;
      }
    }
    const families: SurfaceFamily[] = [
      'ceramic-paint',
      'dusty-alloy',
      'cast-foundation',
      'ironstone',
      'regolith',
    ];
    for (const family of families)
      for (const url of surfaceTextureUrls(family)) total += (await stat(publicFile(url))).size;
    expect(total).toBeLessThan(TEXTURE_PAYLOAD_CEILING);
  });
});
