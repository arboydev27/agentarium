import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applySurfaceDetails,
  SURFACE_BASE_COLORS,
  SURFACE_GLSL,
  SURFACE_SHADER_VERSION,
  surfaceFamilyDetails,
  surfaceGain,
  textureMeanColor,
} from './surfaceShader';

type Shader = Parameters<NonNullable<THREE.Material['onBeforeCompile']>>[0];

const VERTEX = 'void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}';
const FRAGMENT = [
  'varying vec3 vViewPosition;',
  'void main() {',
  'vec4 diffuseColor = vec4(1.0);',
  '#include <color_fragment>',
  '#include <roughnessmap_fragment>',
  '#include <normal_fragment_begin>',
  '#include <normal_fragment_maps>',
  '}',
].join('\n');

function compile(material: THREE.MeshStandardMaterial) {
  const shader = { uniforms: {}, vertexShader: VERTEX, fragmentShader: FRAGMENT } as Shader;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

function maps() {
  return [new THREE.Texture(), new THREE.Texture(), new THREE.Texture()] as const;
}

const braces = (source: string) =>
  (source.match(/{/g) ?? []).length - (source.match(/}/g) ?? []).length;

describe('triplanar surface shader', () => {
  it('binds the colour, normal and roughness maps and samples each one', () => {
    const textures = maps();
    const material = applySurfaceDetails(new THREE.MeshStandardMaterial(), textures, {
      metres: 1.6,
      ...surfaceFamilyDetails('ceramic-paint'),
    });
    const shader = compile(material);
    expect(shader.uniforms.surfaceColor.value).toBe(textures[0]);
    expect(shader.uniforms.surfaceNormal.value).toBe(textures[1]);
    expect(shader.uniforms.surfaceRoughness.value).toBe(textures[2]);
    expect(shader.uniforms.surfaceMetres.value).toBe(1.6);
    expect(shader.uniforms.surfaceNormalScale.value).toBeGreaterThan(0);
    // All three projections of every map are read: colour twice (grain and macro), normal and roughness once.
    for (const map of ['surfaceColor', 'surfaceRoughness'])
      expect(shader.fragmentShader).toContain(`surfaceSample(${map}, surfacePoint`);
    for (const plane of ['yz', 'xz', 'xy'])
      expect(shader.fragmentShader).toContain(
        `surfaceNormalAt(surfacePoint.${plane}, surfaceDx.${plane}, surfaceDy.${plane})`,
      );
    expect(shader.fragmentShader).toContain('textureGrad(surfaceNormal, uv, dx, dy)');
    // Projections under the blend threshold are skipped, so most pixels fetch one, not three.
    expect(shader.fragmentShader).toContain(
      'if (weights.x > 0.0) c += textureGrad(tex, p.yz, dx.yz, dy.yz)',
    );
    expect(shader.fragmentShader).toContain('step(vec3(0.02), w)');
    // The perturbed normal replaces `normal`, which the lighting chunks read next.
    expect(shader.fragmentShader).toContain('normal = normalize(surfacePerturbed);');
  });

  it('keeps every three.js include it wraps, so later chunks still find their anchors', () => {
    const shader = compile(
      applySurfaceDetails(new THREE.MeshStandardMaterial(), maps(), { metres: 2 }),
    );
    for (const include of ['color_fragment', 'roughnessmap_fragment', 'normal_fragment_maps'])
      expect(shader.fragmentShader).toContain(`#include <${include}>`);
    expect(shader.vertexShader).toContain('#include <project_vertex>');
    expect(shader.vertexShader).toContain('varying vec3 surfaceWorld;');
    expect(shader.vertexShader).toContain('instanceMatrix * surfacePoint');
    for (const snippet of Object.values(SURFACE_GLSL)) expect(braces(snippet)).toBe(0);
    expect(braces(shader.fragmentShader)).toBe(0);
    expect(braces(shader.vertexShader)).toBe(0);
  });

  it('projects in model space for local materials and world space otherwise', () => {
    const local = applySurfaceDetails(new THREE.MeshStandardMaterial(), maps(), {
      metres: 1,
      local: true,
    });
    const world = applySurfaceDetails(new THREE.MeshStandardMaterial(), maps(), { metres: 1 });
    expect(compile(local).vertexShader).toContain('vec4 surfacePoint = vec4(position, 1.0)');
    expect(compile(world).vertexShader).toContain('vec4 surfacePoint = vec4(transformed, 1.0)');
    expect(compile(world).vertexShader).toContain('modelMatrix * surfacePoint');
    expect(local.customProgramCacheKey()).not.toBe(world.customProgramCacheKey());
    expect(local.customProgramCacheKey()).toContain(SURFACE_SHADER_VERSION);
    expect(world.customProgramCacheKey()).toContain(SURFACE_SHADER_VERSION);
  });

  it('draws foundation joints only for cast foundation', () => {
    const plain = compile(
      applySurfaceDetails(new THREE.MeshStandardMaterial(), maps(), { metres: 1 }),
    );
    const concrete = compile(
      applySurfaceDetails(new THREE.MeshStandardMaterial(), maps(), {
        metres: 0.45,
        foundation: true,
      }),
    );
    expect(plain.uniforms.surfaceFoundation.value).toBe(0);
    expect(concrete.uniforms.surfaceFoundation.value).toBe(1);
  });

  it('reads each family as variation around its authored base at the previous mean brightness', () => {
    for (const family of Object.keys(SURFACE_BASE_COLORS) as (keyof typeof SURFACE_BASE_COLORS)[]) {
      const { base, normalScale } = surfaceFamilyDetails(family);
      const [r, g, b] = SURFACE_BASE_COLORS[family];
      // sRGB pixel values decode to darker linear values.
      expect(base.r).toBeLessThan(r);
      expect(base.g).toBeLessThan(g);
      expect(base.b).toBeLessThan(b);
      expect(base.r).toBeGreaterThan(0);
      expect(normalScale).toBeGreaterThan(0);
      expect(normalScale).toBeLessThanOrEqual(1);
      const shader = compile(
        applySurfaceDetails(new THREE.MeshStandardMaterial(), maps(), {
          metres: 1,
          base,
          normalScale,
        }),
      );
      expect(shader.uniforms.surfaceBase.value).toBe(base);
      expect(shader.uniforms.surfaceGain.value).toBeCloseTo(surfaceGain(base), 6);
    }
    // The old grain path brightened light families and darkened dark ones; the gain keeps that average.
    expect(surfaceGain(surfaceFamilyDetails('ceramic-paint').base)).toBeGreaterThan(1.1);
    expect(surfaceGain(surfaceFamilyDetails('dusty-alloy').base)).toBeLessThan(0.85);
    expect(surfaceGain(new THREE.Color(1, 1, 1))).toBeCloseTo(1.15, 6);
  });

  it('averages a data texture and decodes sRGB data to linear', () => {
    const data = new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
    ]);
    const linear = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
    linear.colorSpace = THREE.LinearSRGBColorSpace;
    const mean = textureMeanColor(linear);
    expect(mean.r).toBeCloseTo(0.5, 6);
    expect(mean.g).toBeCloseTo(0.5, 6);
    expect(mean.b).toBeCloseTo(0.5, 6);
    const srgb = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
    srgb.colorSpace = THREE.SRGBColorSpace;
    const decoded = textureMeanColor(srgb);
    expect(decoded.r).toBeCloseTo(0.214, 2);
    expect(decoded.r).toBeLessThan(mean.r);
  });
});
