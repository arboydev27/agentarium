import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { EDGES, NODES } from '../navigation';
import { REFERENCE_HABITAT as SITE } from './referenceHabitatPlacement';
import { renderedTerrainHeight } from '../terrain';

const asset = new URL('../../../public/models/habitat/expedition-habitat.glb', import.meta.url);

// Decode actual PNG pixels to catch the Blender colorspace-reset regression.
function pngPixels(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  expect(bytes[24]).toBe(8);
  const channels = bytes[25] === 6 ? 4 : bytes[25] === 2 ? 3 : 1;
  const chunks: Buffer[] = [];
  for (let p = 8; p < bytes.length;) {
    const length = bytes.readUInt32BE(p);
    if (bytes.toString('ascii', p + 4, p + 8) === 'IDAT')
      chunks.push(bytes.subarray(p + 8, p + 8 + length));
    p += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(width * height * channels);
  const stride = width * channels;
  let offset = 0;
  for (let row = 0; row < height; row++) {
    const filter = raw[offset++];
    for (let col = 0; col < stride; col++) {
      const i = row * stride + col;
      const a = col >= channels ? pixels[i - channels] : 0;
      const b = row > 0 ? pixels[i - stride] : 0;
      const c = row > 0 && col >= channels ? pixels[i - stride - channels] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const predictor =
        filter === 1
          ? a
          : filter === 2
            ? b
            : filter === 3
              ? Math.floor((a + b) / 2)
              : filter === 4
                ? pa <= pb && pa <= pc
                  ? a
                  : pb <= pc
                    ? b
                    : c
                : 0;
      pixels[i] = (raw[offset++] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}

describe('Blender habitat export contract', () => {
  it('ships textured PBR materials and a bounded optimized runtime asset', async () => {
    const bytes = await readFile(asset);
    expect(bytes.byteLength).toBeLessThan(8 * 1024 * 1024);
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    expect(json.meshes.length).toBeLessThanOrEqual(10);
    for (const name of [
      'ceramic-paint',
      'dusty-alloy',
      'cast-foundation',
      'ironstone',
      'regolith',
    ]) {
      const material = json.materials.find((m: { name: string }) => m.name === name);
      expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      expect(material.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
      expect(material.normalTexture).toBeDefined();
      const png = pngPixels(
        await readFile(
          new URL(`../../../public/textures/habitat/${name}-color.png`, import.meta.url),
        ),
      );
      expect(png.width).toBe(512);
      expect(png.height).toBe(512);
      let min = 255,
        max = 0,
        sum = 0;
      for (let i = 0; i < png.pixels.length; i += png.channels) {
        const value = png.pixels[i];
        min = Math.min(min, value);
        max = Math.max(max, value);
        sum += value;
      }
      expect(max - min).toBeGreaterThan(8);
      expect(sum / (png.width * png.height)).toBeGreaterThan(15);
    }
  });

  it('keeps the exported geometry clear of every resident route', async () => {
    const bytes = await readFile(asset);
    const loader = new GLTFLoader();
    // Geometry-only validation; actual images are validated above and in the browser.
    loader.register(() => ({
      name: 'geometry-test-textures',
      loadTexture: () => Promise.resolve(new THREE.Texture()),
    }));
    const { scene } = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const base =
      Math.max(
        ...[-3.4, 3.4].flatMap((x) =>
          [-2.2, 2.2].map((z) => renderedTerrainHeight(SITE.x + x, SITE.z + z)),
        ),
      ) + 0.08;
    scene.position.set(SITE.x, base, SITE.z);
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    expect(bounds.getSize(new THREE.Vector3()).x).toBeLessThan(15);
    const body = new THREE.Sphere(new THREE.Vector3(), 0.55);
    for (const [from, to] of EDGES) {
      const a = new THREE.Vector3(...NODES[from]),
        b = new THREE.Vector3(...NODES[to]);
      const steps = Math.ceil(a.distanceTo(b) / 0.2);
      for (let i = 0; i <= steps; i++) {
        body.center.lerpVectors(a, b, i / steps);
        body.center.y += 1;
        expect(bounds.intersectsSphere(body), `${from} → ${to}`).toBe(false);
      }
    }
  });
});
