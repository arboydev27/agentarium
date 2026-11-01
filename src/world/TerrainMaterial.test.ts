import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createTerrainMaterial, layerGain, TERRAIN_SHADER_VERSION } from './TerrainMaterial';
import { GROUND_DETAIL_METRES, GROUND_LAYER_BASE } from './groundSets';
import { TERRAIN_LAYERS, type TerrainLayer } from './terrainBake';
import type { TerrainMaps, TerrainTextureSet } from './terrainTextures';

type Shader = Parameters<NonNullable<THREE.Material['onBeforeCompile']>>[0];

const VERTEX = 'void main() {\n#include <begin_vertex>\n#include <worldpos_vertex>\n}';
const FRAGMENT = [
  'varying vec3 vViewPosition;',
  'void main() {',
  'vec4 diffuseColor = vec4(1.0);',
  '#include <map_fragment>',
  '#include <color_fragment>',
  '#include <roughnessmap_fragment>',
  '#include <normal_fragment_begin>',
  '#include <normal_fragment_maps>',
  '}',
].join('\n');

const braces = (source: string) =>
  (source.match(/{/g) ?? []).length - (source.match(/}/g) ?? []).length;

function layer(
  name: TerrainLayer,
  overrides: Partial<Omit<TerrainMaps, 'color' | 'normal' | 'roughness'>> = {},
): TerrainMaps {
  return {
    color: new THREE.Texture(),
    normal: new THREE.Texture(),
    roughness: new THREE.Texture(),
    metres: { sand: 2.3, gravel: 3.1, basalt: 4.6 }[name],
    normalScale: { sand: 0.7, gravel: 1, basalt: 1.25 }[name],
    contrast: 1,
    ao: 0,
    aoMean: 1,
    base: new THREE.Color().setRGB(...GROUND_LAYER_BASE[name], THREE.SRGBColorSpace),
    mean: new THREE.Color().setRGB(...GROUND_LAYER_BASE[name], THREE.SRGBColorSpace),
    ...overrides,
  };
}

function bakedSet(): TerrainTextureSet {
  return { sand: layer('sand'), gravel: layer('gravel'), basalt: layer('basalt') };
}

function compile(material: THREE.MeshStandardMaterial) {
  const shader = { uniforms: {}, vertexShader: VERTEX, fragmentShader: FRAGMENT } as Shader;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('splat-mapped ground material', () => {
  it('binds every layer map and its per-layer scale, strength, gain and occlusion', () => {
    const maps = bakedSet();
    const shader = compile(createTerrainMaterial(maps, 'high'));
    for (const name of TERRAIN_LAYERS) {
      expect(shader.uniforms[`${name}Color`].value).toBe(maps[name].color);
      expect(shader.uniforms[`${name}Normal`].value).toBe(maps[name].normal);
      expect(shader.uniforms[`${name}Roughness`].value).toBe(maps[name].roughness);
    }
    expect(shader.uniforms.terrainMetres.value.toArray()).toEqual([2.3, 3.1, 4.6]);
    expect(shader.uniforms.terrainNormalScales.value.toArray()).toEqual([0.7, 1, 1.25]);
    expect(shader.uniforms.terrainAo.value.toArray()).toEqual([0, 0, 0]);
    expect(shader.uniforms.terrainContrast.value.toArray()).toEqual([1, 1, 1]);
    expect(shader.uniforms.terrainDetailMetres.value).toBe(GROUND_DETAIL_METRES);
    // A baked layer is already its own base, so its gain is exactly one.
    for (const name of TERRAIN_LAYERS) {
      expect(shader.uniforms[`${name}Gain`].value.toArray()).toEqual([1, 1, 1]);
      expect(shader.uniforms[`${name}Base`].value).toBe(maps[name].base);
    }
    const fragment = shader.fragmentShader;
    for (const [name, axis] of [
      ['sand', 'x'],
      ['gravel', 'y'],
      ['basalt', 'z'],
    ] as const) {
      expect(fragment).toContain(
        `terrainLayer(${name}Color, terrainUv, terrainMetres.${axis}, terrainBreak, terrainRot).rgb * ${name}Gain`,
      );
      expect(fragment).toContain(
        `terrainLayerNormal(${name}Normal, terrainUv, terrainMetres.${axis}, terrainBreak, terrainRot)`,
      );
      expect(fragment).toContain(`${name}Albedo *= mix(1.0, ${name}Arm.r, terrainAo.${axis})`);
      expect(fragment).toContain(`${name}Arm.g * `);
    }
    // No literal tile size survives; the roughness block reuses the occlusion fetch.
    expect(fragment).not.toMatch(/terrainUv, [0-9.]+, terrainBreak/);
    expect(fragment.match(/terrainLayer\(\w+Roughness/g)).toHaveLength(3);
    expect(fragment).toContain('texture2D(sandNormal, terrainUv / terrainDetailMetres)');
    expect(fragment).not.toContain('#include <color_fragment>');
    expect(braces(fragment)).toBe(0);
    expect(shader.vertexShader).toContain(
      'vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz',
    );
    expect(shader.defines?.TERRAIN_LOW).toBeUndefined();
  });

  it('re-bases a scanned layer onto the authored palette and keys the program per quality', () => {
    // A grey scan that is darker than the sand base gets a warm gain above one.
    const scanned = layer('sand', {
      mean: new THREE.Color().setRGB(0.45, 0.45, 0.45, THREE.SRGBColorSpace),
      contrast: 1.5,
      ao: 0.6,
      aoMean: 0.8,
      metres: 2.53,
    });
    const gain = layerGain(scanned);
    expect(gain.x).toBeGreaterThan(gain.y);
    expect(gain.y).toBeGreaterThan(gain.z);
    expect(gain.x).toBeGreaterThan(1);
    // The scan's mean, darkened by its average occlusion at that strength, lands on the base.
    const occluded = 1 + (0.8 - 1) * 0.6;
    expect(gain.x * scanned.mean.r * occluded).toBeCloseTo(scanned.base.r, 6);
    const maps: TerrainTextureSet = { ...bakedSet(), sand: scanned };
    const low = createTerrainMaterial(maps, 'low');
    const shader = compile(low);
    expect(shader.uniforms.terrainMetres.value.x).toBe(2.53);
    expect(shader.uniforms.terrainAo.value.x).toBe(0.6);
    expect(shader.uniforms.terrainContrast.value.toArray()).toEqual([1.5, 1, 1]);
    expect(shader.uniforms.sandGain.value.toArray()).toEqual(gain.toArray());
    expect(shader.uniforms.sandBase.value).toBe(scanned.base);
    expect(shader.defines?.TERRAIN_LOW).toBe(1);
    expect(low.customProgramCacheKey()).toBe(`${TERRAIN_SHADER_VERSION}-low`);
    expect(createTerrainMaterial(maps, 'high').customProgramCacheKey()).toBe(
      `${TERRAIN_SHADER_VERSION}-high`,
    );
  });
});
