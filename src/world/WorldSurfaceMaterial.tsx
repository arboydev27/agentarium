import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useSurfaceTextures, type SurfaceFamily } from './surfaceTextures';

/** Physical-scale surface detail for authored meshes without useful UVs, including instances. */
export function WorldSurfaceMaterial({
  family = 'ironstone',
  color = '#ffffff',
  roughness = 1,
  metalness = 0,
  vertexColors = false,
  flatShading = false,
  side = THREE.FrontSide,
  metres = 2,
}: {
  family?: SurfaceFamily;
  color?: string;
  roughness?: number;
  metalness?: number;
  vertexColors?: boolean;
  flatShading?: boolean;
  side?: THREE.Side;
  metres?: number;
}) {
  const maps = useSurfaceTextures(family);
  const material = useMemo(() => {
    const result = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      vertexColors,
      flatShading,
      side,
    });
    applySurfaceDetails(
      result,
      maps,
      family === 'cast-foundation' ? 0.45 : metres,
      false,
      family === 'cast-foundation',
    );
    return result;
  }, [maps, color, roughness, metalness, vertexColors, flatShading, side, metres, family]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}

/** Local coordinates keep surface grain attached to moving resident body parts. */
export function applySurfaceDetails(
  result: THREE.MeshStandardMaterial,
  maps: THREE.Texture[],
  metres: number,
  local = false,
  foundation = false,
) {
  result.onBeforeCompile = (shader) => {
    shader.uniforms.surfaceColor = { value: maps[0] };
    shader.uniforms.surfaceRoughness = { value: maps[2] };
    shader.uniforms.surfaceMetres = { value: metres };
    shader.uniforms.surfaceFoundation = { value: foundation ? 1 : 0 };
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
    shader.fragmentShader =
      `
        varying vec3 surfaceWorld;
        uniform sampler2D surfaceColor;
        uniform sampler2D surfaceRoughness;
        uniform float surfaceMetres;
        uniform float surfaceFoundation;
        vec4 surfaceSample(sampler2D tex, vec3 p, vec3 weights) {
          return texture2D(tex, p.yz) * weights.x
               + texture2D(tex, p.xz) * weights.y
               + texture2D(tex, p.xy) * weights.z;
        }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
        #include <color_fragment>
        vec3 surfaceWeights = pow(abs(normalize(cross(dFdx(surfaceWorld), dFdy(surfaceWorld)))), vec3(4.0));
        surfaceWeights /= max(dot(surfaceWeights, vec3(1.0)), 0.0001);
        vec3 surfacePoint = surfaceWorld / surfaceMetres;
        float surfaceGrain = surfaceSample(surfaceColor, surfacePoint, surfaceWeights).r;
        diffuseColor.rgb *= mix(0.78, 1.15, clamp(surfaceGrain * 2.0, 0.0, 1.0));
        vec2 jointCell = abs(fract(surfaceWorld.xz / 1.8 + 0.5) - 0.5) * 1.8;
        float joint = 1.0 - smoothstep(0.008, 0.022, min(jointCell.x, jointCell.y));
        diffuseColor.rgb *= 1.0 - joint * surfaceFoundation * surfaceWeights.y * 0.23;
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
        #include <roughnessmap_fragment>
        roughnessFactor *= surfaceSample(surfaceRoughness, surfacePoint, surfaceWeights).g;
        roughnessFactor = max(roughnessFactor, 0.28);
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `
        #include <normal_fragment_maps>
        vec3 surfaceDx = dFdx(-vViewPosition), surfaceDy = dFdy(-vViewPosition);
        vec3 surfaceR1 = cross(surfaceDy, normal), surfaceR2 = cross(normal, surfaceDx);
        float surfaceDet = dot(surfaceDx, surfaceR1);
        normal = normalize(max(abs(surfaceDet), 1e-8) * normal - sign(surfaceDet) * 0.025 *
          (dFdx(surfaceGrain) * surfaceR1 + dFdy(surfaceGrain) * surfaceR2));
      `,
    );
  };
  result.customProgramCacheKey = () => `triplanar-surface-v2-${local ? 'local' : 'world'}`;
}
