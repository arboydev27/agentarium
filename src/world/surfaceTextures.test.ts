import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { BASIS_TRANSCODER_PATH, surfaceTextureUrls, type SurfaceFamily } from './surfaceTextures';

const FAMILIES: SurfaceFamily[] = [
  'ceramic-paint',
  'dusty-alloy',
  'cast-foundation',
  'ironstone',
  'regolith',
];
const KTX2_MAGIC = Buffer.from([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const publicFile = (url: string) => new URL(`../../public${url}`, import.meta.url);

describe('surface texture assets', () => {
  it('ships every family as three KTX2 maps encoded from its authored PNGs', async () => {
    let total = 0;
    for (const family of FAMILIES) {
      const urls = surfaceTextureUrls(family);
      expect(urls.map((url) => url.split('-').at(-1))).toEqual([
        'color.ktx2',
        'normal.ktx2',
        'roughness.ktx2',
      ]);
      for (const url of urls) {
        const bytes = await readFile(publicFile(url));
        expect(bytes.subarray(0, 12).equals(KTX2_MAGIC), url).toBe(true);
        // KTX2 header: pixelWidth and pixelHeight at bytes 20 and 24, levelCount at 40.
        expect(bytes.readUInt32LE(20), url).toBe(512);
        expect(bytes.readUInt32LE(24), url).toBe(512);
        expect(bytes.readUInt32LE(40), url).toBeGreaterThan(5);
        total += bytes.length;
        const source = await stat(publicFile(url.replace('.ktx2', '.png')));
        expect(source.size, `${url} keeps its authored PNG`).toBeGreaterThan(0);
      }
    }
    // Fifteen compressed maps stay well under the 5.3 MB of PNG they replace.
    expect(total).toBeLessThan(2 * 1024 * 1024);
  });

  it('self-hosts the Basis transcoder the KTX2 loader needs', async () => {
    expect(BASIS_TRANSCODER_PATH).toBe('/basis/');
    for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
      const size = (await stat(publicFile(`${BASIS_TRANSCODER_PATH}${file}`))).size;
      expect(size, file).toBeGreaterThan(10_000);
    }
  });
});
