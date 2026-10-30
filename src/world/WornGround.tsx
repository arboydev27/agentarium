import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useTerrainTextures } from './terrainTextures';

// Worn-ground surface for authored routes: compacted sand that fades into the
// surrounding regolith instead of a hard-edged grey ribbon. Geometry may carry
// an `across` attribute in [-1, 1] (centre to edge); without it the surface is
// fully opaque, which suits pads and fans. Vehicle routes add twin ruts.

export type WornGroundTone = 'walk' | 'vehicle' | 'pad';

const TONES: Record<WornGroundTone, { tint: THREE.Color; ruts: number; scuff: number }> = {
  walk: { tint: new THREE.Color('#b57a57'), ruts: 0, scuff: 0.55 },
  vehicle: { tint: new THREE.Color('#a86f50'), ruts: 1, scuff: 0.35 },
  pad: { tint: new THREE.Color('#bf8b67'), ruts: 0, scuff: 0.3 },
};

export function createWornGroundMaterial(
  sand: { color: THREE.Texture; roughness: THREE.Texture },
  tone: WornGroundTone,
  vertexColors: boolean,
) {
  const { tint, ruts, scuff } = TONES[tone];
  const material = new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 1,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
    vertexColors,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.wornColor = { value: sand.color };
    shader.uniforms.wornRoughness = { value: sand.roughness };
    shader.uniforms.wornRuts = { value: ruts };
    shader.uniforms.wornScuff = { value: scuff };
    shader.vertexShader =
      'attribute float across;\nvarying float vAcross;\nvarying vec3 vWornWorld;\n' +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vAcross = across;
        vWornWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `,
      );
    shader.fragmentShader =
      `
      varying float vAcross;
      varying vec3 vWornWorld;
      uniform sampler2D wornColor;
      uniform sampler2D wornRoughness;
      uniform float wornRuts;
      uniform float wornScuff;
      float wornHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float wornNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(wornHash(i), wornHash(i + vec2(1.0, 0.0)), f.x),
                   mix(wornHash(i + vec2(0.0, 1.0)), wornHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      vec2 wornUv = vWornWorld.xz;
      vec3 grain = texture2D(wornColor, wornUv / 1.7).rgb;
      vec3 grainB = texture2D(wornColor, vec2(wornUv.x * 0.8 - wornUv.y * 0.6, wornUv.x * 0.6 + wornUv.y * 0.8) / 1.1).rgb;
      grain = mix(grain, grainB, 0.5);
      // Compacted sand reads flatter and slightly lighter than loose grain.
      vec3 compact = mix(grain, vec3(dot(grain, vec3(0.3, 0.59, 0.11))), 0.35) * 1.1;
      float edgeNoise = wornNoise(wornUv * 1.3) * 0.5 + wornNoise(wornUv * 4.1) * 0.25;
      float edge = abs(vAcross) + (edgeNoise - 0.375) * 0.45;
      float cover = 1.0 - smoothstep(0.45, 1.0, edge);
      float scuffs = 1.0 - wornScuff * smoothstep(0.55, 0.9, wornNoise(wornUv * 2.7));
      float rutMask = wornRuts * (1.0 - smoothstep(0.05, 0.14, abs(abs(vAcross) - 0.42)));
      compact *= 1.0 - rutMask * 0.22;
      diffuseColor.rgb *= compact / vec3(0.73, 0.47, 0.31);
      diffuseColor.a *= cover * (0.7 + 0.3 * scuffs);
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness * mix(0.85, 1.0, texture2D(wornRoughness, wornUv / 1.7).g);
      `,
    );
  };
  material.customProgramCacheKey = () => `worn-ground-v1-${tone}-${vertexColors ? 'vc' : 'flat'}`;
  return material;
}

export function WornGroundMaterial({
  tone = 'walk',
  vertexColors = false,
}: {
  tone?: WornGroundTone;
  vertexColors?: boolean;
}) {
  const textures = useTerrainTextures();
  const material = useMemo(
    () => createWornGroundMaterial(textures.sand, tone, vertexColors),
    [textures, tone, vertexColors],
  );
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}

/** Adds the centre-to-edge attribute from a per-vertex list of offsets in [-1, 1]. */
export function withAcross(geometry: THREE.BufferGeometry, across: readonly number[]) {
  geometry.setAttribute('across', new THREE.Float32BufferAttribute([...across], 1));
  return geometry;
}
