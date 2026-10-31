import * as THREE from 'three';
import type { SurfaceFamily } from './surfaceTextures';

// Triplanar surface detail for authored meshes without useful UVs. Three maps
// (colour, tangent-space normal, roughness) are projected along the three
// axes of the mesh's world or local space and blended by the face normal, so
// one 512 px family serves every module, primitive, rock and suit at a fixed
// physical scale. This file is pure: no React, no loaders.

export const SURFACE_SHADER_VERSION = 'triplanar-surface-v3';

/** Macro lookup: the colour map again at this multiple of the grain scale, to break the repeat. */
export const SURFACE_MACRO_SCALE = 7.3;

/**
 * Authored base colour of each family, as `assets/blender/build_habitat.py`
 * writes it into the colour map (sRGB pixel values). The shader reads the map
 * as variation around this base, so a mesh's own colour stays in charge and
 * the family contributes grain, chips and pores rather than a tint.
 */
export const SURFACE_BASE_COLORS: Record<SurfaceFamily, readonly [number, number, number]> = {
  'ceramic-paint': [0.72, 0.69, 0.59],
  'dusty-alloy': [0.24, 0.28, 0.3],
  'cast-foundation': [0.38, 0.34, 0.29],
  ironstone: [0.36, 0.19, 0.12],
  regolith: [0.62, 0.31, 0.16],
};

/** Normal-map strength per family: paint and alloy are smooth finishes, stone and sand are not. */
export const SURFACE_NORMAL_SCALE: Record<SurfaceFamily, number> = {
  'ceramic-paint': 0.55,
  'dusty-alloy': 0.5,
  'cast-foundation': 0.35,
  ironstone: 0.6,
  regolith: 0.5,
};

/**
 * How much of the colour map's deviation from its base shows. The generator
 * writes the stone and sand families with far stronger contrast than the paint
 * and alloy finishes, and at full strength cast foundation reads as planks.
 */
export const SURFACE_CONTRAST: Record<SurfaceFamily, number> = {
  'ceramic-paint': 1,
  'dusty-alloy': 1,
  'cast-foundation': 0.4,
  ironstone: 0.45,
  regolith: 0.6,
};

export type SurfaceDetailOptions = {
  /** Texture repeat in metres (world) or model units (local). */
  metres: number;
  /** Project in object or instance space so the grain follows an animated or instanced mesh. */
  local?: boolean;
  /** Draw cast-foundation's 1.8 m joint lines. */
  foundation?: boolean;
  /** Mean colour of the colour map, linear. Defaults to white (the map is used as is). */
  base?: THREE.Color;
  /** Tangent-space normal strength. */
  normalScale?: number;
  /** Fraction of the colour map's deviation from `base` that is applied. */
  contrast?: number;
};

/**
 * Brightness the previous grain path applied on average for a map with this
 * mean colour. Keeping it means authored colours look the same on average and
 * the maps only add variation on top.
 */
export function surfaceGain(base: THREE.Color) {
  return THREE.MathUtils.lerp(0.78, 1.15, THREE.MathUtils.clamp(base.r * 2, 0, 1));
}

/** Base colour (linear) and normal strength for one authored family. */
export function surfaceFamilyDetails(family: SurfaceFamily) {
  const [r, g, b] = SURFACE_BASE_COLORS[family];
  return {
    base: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace),
    normalScale: SURFACE_NORMAL_SCALE[family],
    contrast: SURFACE_CONTRAST[family],
  };
}

/** Mean colour of an 8-bit RGBA data texture, converted to linear when the texture is sRGB. */
export function textureMeanColor(texture: THREE.DataTexture) {
  const image = texture.image as { data: ArrayLike<number>; width: number; height: number };
  const data = image.data;
  const pixels = image.width * image.height;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < pixels; i++) {
    r += data[i * 4];
    g += data[i * 4 + 1];
    b += data[i * 4 + 2];
  }
  const scale = pixels ? 1 / (pixels * 255) : 0;
  return new THREE.Color().setRGB(
    r * scale,
    g * scale,
    b * scale,
    texture.colorSpace === THREE.SRGBColorSpace ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace,
  );
}

const FRAGMENT_PRELUDE = /* glsl */ `
  varying vec3 surfaceWorld;
  uniform sampler2D surfaceColor;
  uniform sampler2D surfaceNormal;
  uniform sampler2D surfaceRoughness;
  uniform float surfaceMetres;
  uniform float surfaceFoundation;
  uniform float surfaceNormalScale;
  uniform float surfaceGain;
  uniform float surfaceContrast;
  uniform vec3 surfaceBase;
  // Blend weights from the face normal, with projections under 2% dropped and
  // the rest renormalised, so most pixels fetch one projection, not three.
  vec3 surfaceBlendWeights(vec3 faceNormal) {
    vec3 w = pow(abs(faceNormal), vec3(4.0));
    w /= max(dot(w, vec3(1.0)), 0.0001);
    w *= step(vec3(0.02), w);
    return w / max(dot(w, vec3(1.0)), 0.0001);
  }
  // Explicit gradients keep mip selection right inside the weight branches.
  vec4 surfaceSample(sampler2D tex, vec3 p, vec3 weights, vec3 dx, vec3 dy) {
    vec4 c = vec4(0.0);
    if (weights.x > 0.0) c += textureGrad(tex, p.yz, dx.yz, dy.yz) * weights.x;
    if (weights.y > 0.0) c += textureGrad(tex, p.xz, dx.xz, dy.xz) * weights.y;
    if (weights.z > 0.0) c += textureGrad(tex, p.xy, dx.xy, dy.xy) * weights.z;
    return c;
  }
  // Perturb the view-space normal by one projection's tangent-space sample. The
  // tangent frame comes from screen-space derivatives of the eye position and
  // of that projection's coordinates, so no tangent attribute is needed and the
  // frame is right in world, local and instance space alike.
  vec3 surfacePerturb(vec3 n, vec3 mapN, vec3 q0, vec3 q1, vec2 st0, vec2 st1) {
    vec3 q1perp = cross(q1, n);
    vec3 q0perp = cross(n, q0);
    vec3 t = q1perp * st0.x + q0perp * st1.x;
    vec3 b = q1perp * st0.y + q0perp * st1.y;
    float det = max(dot(t, t), dot(b, b));
    if (det == 0.0) return n;
    float s = inversesqrt(det);
    return normalize(t * s * mapN.x + b * s * mapN.y + n * mapN.z);
  }
  vec3 surfaceNormalAt(vec2 uv, vec2 dx, vec2 dy) {
    vec3 mapN = textureGrad(surfaceNormal, uv, dx, dy).xyz * 2.0 - 1.0;
    mapN.xy *= surfaceNormalScale;
    return normalize(mapN);
  }
`;

const COLOR_FRAGMENT = /* glsl */ `
  #include <color_fragment>
  vec3 surfaceDx = dFdx(surfaceWorld) / surfaceMetres;
  vec3 surfaceDy = dFdy(surfaceWorld) / surfaceMetres;
  vec3 surfaceWeights = surfaceBlendWeights(normalize(cross(surfaceDx, surfaceDy)));
  vec3 surfacePoint = surfaceWorld / surfaceMetres;
  vec3 surfaceBaseSafe = max(surfaceBase, vec3(0.01));
  // Fine grain: the map's colour relative to its authored base, so chips, pores
  // and scratches show as deviations and the mesh's own colour stays in charge.
  vec3 surfaceGrain = surfaceSample(surfaceColor, surfacePoint, surfaceWeights, surfaceDx, surfaceDy).rgb / surfaceBaseSafe;
  // Macro grain: the same map at a much larger scale breaks the repeat and
  // varies the tone from metre to metre.
  vec3 surfaceMacro = surfaceSample(surfaceColor, surfacePoint / ${SURFACE_MACRO_SCALE.toFixed(2)} + vec3(0.37, 0.11, 0.73), surfaceWeights, surfaceDx / ${SURFACE_MACRO_SCALE.toFixed(2)}, surfaceDy / ${SURFACE_MACRO_SCALE.toFixed(2)}).rgb / surfaceBaseSafe;
  surfaceGrain = 1.0 + (clamp(surfaceGrain, 0.5, 1.5) - 1.0) * surfaceContrast;
  surfaceMacro = 1.0 + (clamp(surfaceMacro, 0.6, 1.4) - 1.0) * surfaceContrast * 0.45;
  diffuseColor.rgb *= surfaceGain * surfaceGrain * surfaceMacro;
  vec2 jointCell = abs(fract(surfaceWorld.xz / 1.8 + 0.5) - 0.5) * 1.8;
  float joint = 1.0 - smoothstep(0.008, 0.022, min(jointCell.x, jointCell.y));
  diffuseColor.rgb *= 1.0 - joint * surfaceFoundation * surfaceWeights.y * 0.23;
`;

const ROUGHNESS_FRAGMENT = /* glsl */ `
  #include <roughnessmap_fragment>
  roughnessFactor *= surfaceSample(surfaceRoughness, surfacePoint, surfaceWeights, surfaceDx, surfaceDy).g;
  roughnessFactor = max(roughnessFactor, 0.28);
`;

const NORMAL_FRAGMENT = /* glsl */ `
  #include <normal_fragment_maps>
  {
    vec3 surfaceEye = -vViewPosition;
    vec3 surfaceQ0 = dFdx(surfaceEye);
    vec3 surfaceQ1 = dFdy(surfaceEye);
    vec3 surfacePerturbed = vec3(0.0);
    if (surfaceWeights.x > 0.0)
      surfacePerturbed += surfacePerturb(normal, surfaceNormalAt(surfacePoint.yz, surfaceDx.yz, surfaceDy.yz), surfaceQ0, surfaceQ1, surfaceDx.yz, surfaceDy.yz) * surfaceWeights.x;
    if (surfaceWeights.y > 0.0)
      surfacePerturbed += surfacePerturb(normal, surfaceNormalAt(surfacePoint.xz, surfaceDx.xz, surfaceDy.xz), surfaceQ0, surfaceQ1, surfaceDx.xz, surfaceDy.xz) * surfaceWeights.y;
    if (surfaceWeights.z > 0.0)
      surfacePerturbed += surfacePerturb(normal, surfaceNormalAt(surfacePoint.xy, surfaceDx.xy, surfaceDy.xy), surfaceQ0, surfaceQ1, surfaceDx.xy, surfaceDy.xy) * surfaceWeights.z;
    normal = normalize(surfacePerturbed);
  }
`;

export const SURFACE_GLSL = {
  prelude: FRAGMENT_PRELUDE,
  color: COLOR_FRAGMENT,
  roughness: ROUGHNESS_FRAGMENT,
  normal: NORMAL_FRAGMENT,
} as const;

/**
 * Give a standard material triplanar colour, roughness and normal detail from
 * `maps` (colour, normal, roughness). Local coordinates keep the grain attached
 * to moving resident body parts and to instanced kit tiles.
 */
export function applySurfaceDetails(
  result: THREE.MeshStandardMaterial,
  maps: readonly THREE.Texture[],
  options: SurfaceDetailOptions,
) {
  const { metres, local = false, foundation = false, normalScale = 1, contrast = 1 } = options;
  const base = options.base ?? new THREE.Color(1, 1, 1);
  result.onBeforeCompile = (shader) => {
    shader.uniforms.surfaceColor = { value: maps[0] };
    shader.uniforms.surfaceNormal = { value: maps[1] };
    shader.uniforms.surfaceRoughness = { value: maps[2] };
    shader.uniforms.surfaceMetres = { value: metres };
    shader.uniforms.surfaceFoundation = { value: foundation ? 1 : 0 };
    shader.uniforms.surfaceNormalScale = { value: normalScale };
    shader.uniforms.surfaceGain = { value: surfaceGain(base) };
    shader.uniforms.surfaceContrast = { value: contrast };
    shader.uniforms.surfaceBase = { value: base };
    shader.vertexShader = 'varying vec3 surfaceWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
        vec4 surfacePoint = vec4(${local ? 'position' : 'transformed'}, 1.0);
        #ifdef USE_INSTANCING
          surfacePoint = instanceMatrix * surfacePoint;
        #endif
        surfaceWorld = ${local ? 'surfacePoint.xyz' : '(modelMatrix * surfacePoint).xyz'};
        #include <project_vertex>
      `,
    );
    shader.fragmentShader = FRAGMENT_PRELUDE + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', COLOR_FRAGMENT)
      .replace('#include <roughnessmap_fragment>', ROUGHNESS_FRAGMENT)
      .replace('#include <normal_fragment_maps>', NORMAL_FRAGMENT);
  };
  result.customProgramCacheKey = () => `${SURFACE_SHADER_VERSION}-${local ? 'local' : 'world'}`;
  return result;
}
