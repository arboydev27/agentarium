import * as THREE from 'three';
import type { TerrainTextureSet } from './terrainTextures';

// Splat-mapped Mars ground. Three baked layers (sand on flats, gravel on
// gentle ground, basalt on steep slopes) blend by slope and noise; every layer
// is sampled at two scales with a rotated second lookup to break tiling, a
// 170 m macro tint and a 23 m mid tint vary the colour, and a close detail
// normal fades in within ten metres of the camera. Vertex colours carry the
// authored biome tint rather than the whole albedo.

const NOISE_GLSL = /* glsl */ `
  float terrainHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float terrainNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(terrainHash(i), terrainHash(i + vec2(1.0, 0.0)), f.x),
      mix(terrainHash(i + vec2(0.0, 1.0)), terrainHash(i + vec2(1.0, 1.0)), f.x),
      f.y) * 2.0 - 1.0;
  }
  vec4 terrainLayer(sampler2D tex, vec2 uv, float scale, float blend, vec2 rot) {
    vec4 a = texture2D(tex, uv / scale);
    #ifdef TERRAIN_LOW
      return a;
    #else
      vec2 uvB = vec2(uv.x * rot.x - uv.y * rot.y, uv.x * rot.y + uv.y * rot.x) / (scale * 0.63);
      return mix(a, texture2D(tex, uvB), blend);
    #endif
  }
  vec3 terrainLayerNormal(sampler2D tex, vec2 uv, float scale, float blend, vec2 rot) {
    vec3 a = texture2D(tex, uv / scale).xyz * 2.0 - 1.0;
    #ifdef TERRAIN_LOW
      return a;
    #else
      vec2 uvB = vec2(uv.x * rot.x - uv.y * rot.y, uv.x * rot.y + uv.y * rot.x) / (scale * 0.63);
      vec3 b = texture2D(tex, uvB).xyz * 2.0 - 1.0;
      b.xy = vec2(b.x * rot.x + b.y * rot.y, -b.x * rot.y + b.y * rot.x);
      return mix(a, b, blend);
    #endif
  }
`;

const WEIGHTS_GLSL = /* glsl */ `
  vec2 terrainUv = vTerrainWorld.xz;
  float terrainSlope = 1.0 - clamp(normalize(vTerrainNormal).y, 0.0, 1.0);
  float terrainMacro = terrainNoise(terrainUv / 170.0) * 0.7 + terrainNoise(terrainUv / 61.0) * 0.3;
  float terrainMid = terrainNoise(terrainUv / 23.0);
  float terrainBreak = smoothstep(-0.35, 0.35, terrainNoise(terrainUv / 9.0 + 3.7));
  vec2 terrainRot = vec2(0.7986, 0.6018);
  float rockWeight = smoothstep(0.09, 0.24, terrainSlope + terrainMid * 0.03);
  float sandWeight = (1.0 - smoothstep(0.012, 0.05, terrainSlope)) *
    smoothstep(-0.25, 0.4, terrainMid * 0.6 + terrainMacro * 0.7) * (1.0 - rockWeight);
  float gravelWeight = max(0.0, 1.0 - sandWeight - rockWeight);
`;

export function createTerrainMaterial(maps: TerrainTextureSet, quality: 'high' | 'low') {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: maps.gravel.color,
    normalMap: maps.gravel.normal,
    roughnessMap: maps.gravel.roughness,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.sandColor = { value: maps.sand.color };
    shader.uniforms.sandNormal = { value: maps.sand.normal };
    shader.uniforms.sandRoughness = { value: maps.sand.roughness };
    shader.uniforms.gravelColor = { value: maps.gravel.color };
    shader.uniforms.gravelNormal = { value: maps.gravel.normal };
    shader.uniforms.gravelRoughness = { value: maps.gravel.roughness };
    shader.uniforms.basaltColor = { value: maps.basalt.color };
    shader.uniforms.basaltNormal = { value: maps.basalt.normal };
    shader.uniforms.basaltRoughness = { value: maps.basalt.roughness };
    if (quality === 'low') shader.defines = { ...shader.defines, TERRAIN_LOW: 1 };

    shader.vertexShader =
      'varying vec3 vTerrainWorld;\nvarying vec3 vTerrainNormal;\n' +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);
        `,
      );

    shader.fragmentShader =
      `
      varying vec3 vTerrainWorld;
      varying vec3 vTerrainNormal;
      uniform sampler2D sandColor;
      uniform sampler2D sandNormal;
      uniform sampler2D sandRoughness;
      uniform sampler2D gravelColor;
      uniform sampler2D gravelNormal;
      uniform sampler2D gravelRoughness;
      uniform sampler2D basaltColor;
      uniform sampler2D basaltNormal;
      uniform sampler2D basaltRoughness;
      ${NOISE_GLSL}
      ` + shader.fragmentShader;

    // Albedo: layered colour, macro and mid variation, authored biome tint.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      ${WEIGHTS_GLSL}
      vec3 sandAlbedo = terrainLayer(sandColor, terrainUv, 2.3, terrainBreak, terrainRot).rgb;
      vec3 gravelAlbedo = terrainLayer(gravelColor, terrainUv, 3.1, terrainBreak, terrainRot).rgb;
      vec3 basaltAlbedo = terrainLayer(basaltColor, terrainUv, 4.6, terrainBreak, terrainRot).rgb;
      vec3 terrainAlbedo = sandAlbedo * sandWeight + gravelAlbedo * gravelWeight + basaltAlbedo * rockWeight;
      vec3 warmTint = vec3(1.08, 0.98, 0.88);
      vec3 coolTint = vec3(0.86, 0.9, 1.0);
      terrainAlbedo *= mix(coolTint, warmTint, terrainMacro * 0.5 + 0.5);
      terrainAlbedo *= 1.0 + terrainMid * 0.07 + terrainMacro * 0.06;
      // Dust settles darker in dips of the mid-scale pattern.
      terrainAlbedo *= 1.0 - 0.1 * smoothstep(0.2, 0.75, -terrainMid);
      #ifdef USE_COLOR
        // Biome tint relative to the regolith base colour of the vertex palette.
        vec3 biomeTint = clamp(vColor / vec3(0.725, 0.404, 0.263), 0.5, 1.9);
        terrainAlbedo *= mix(vec3(1.0), biomeTint, 0.55);
      #endif
      diffuseColor.rgb *= terrainAlbedo;
      `,
    );
    // Vertex colour is folded into the albedo above, not multiplied twice.
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '');

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      float sandRough = terrainLayer(sandRoughness, terrainUv, 2.3, terrainBreak, terrainRot).g;
      float gravelRough = terrainLayer(gravelRoughness, terrainUv, 3.1, terrainBreak, terrainRot).g;
      float basaltRough = terrainLayer(basaltRoughness, terrainUv, 4.6, terrainBreak, terrainRot).g;
      roughnessFactor *= sandRough * sandWeight + gravelRough * gravelWeight + basaltRough * rockWeight;
      roughnessFactor = clamp(roughnessFactor, 0.55, 1.0);
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `
      vec3 sandN = terrainLayerNormal(sandNormal, terrainUv, 2.3, terrainBreak, terrainRot);
      vec3 gravelN = terrainLayerNormal(gravelNormal, terrainUv, 3.1, terrainBreak, terrainRot);
      vec3 basaltN = terrainLayerNormal(basaltNormal, terrainUv, 4.6, terrainBreak, terrainRot);
      sandN.xy *= 0.7;
      gravelN.xy *= 1.0;
      basaltN.xy *= 1.25;
      vec3 mapN = normalize(sandN * sandWeight + gravelN * gravelWeight + basaltN * rockWeight);
      #ifndef TERRAIN_LOW
        // Close detail: fine sand grain within ten metres of the camera.
        float detailFade = 1.0 - smoothstep(5.0, 13.0, length(vViewPosition));
        vec3 detailN = texture2D(sandNormal, terrainUv / 0.42).xyz * 2.0 - 1.0;
        mapN = normalize(vec3(mapN.xy + detailN.xy * 0.45 * detailFade, mapN.z));
      #endif
      mapN.xy *= normalScale;
      normal = normalize(tbn * mapN);
      `,
    );
  };
  material.customProgramCacheKey = () => `mars-ground-splat-v1-${quality}`;
  return material;
}
