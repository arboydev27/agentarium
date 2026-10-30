import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../state';

/**
 * Stylized Mars sky: butterscotch zenith, pale dusty horizon, a blue halo
 * around a low sun by day; deep violet with stars by night. One shader feeds
 * both the visible dome and the environment map so reflections match the sky.
 */
export const SKY = {
  day: {
    zenith: '#b86f3c',
    horizon: '#e7b08a',
    halo: '#9fb8d6',
    sun: '#fff3dc',
    sunDirection: new THREE.Vector3(-0.72, 0.5, -0.46).normalize(),
    sunColor: '#ffd9a6',
    sunIntensity: 3.4,
  },
  night: {
    zenith: '#07070f',
    horizon: '#2a1d2c',
    halo: '#000000',
    sun: '#000000',
    sunDirection: new THREE.Vector3(0.38, 0.42, -0.52).normalize(),
    sunColor: '#8fa3d8',
    sunIntensity: 0.45,
  },
  ground: '#3f2419',
} as const;

export function skyHorizonColor(night: boolean) {
  return night ? SKY.night.horizon : SKY.day.horizon;
}

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 zenithDay;
  uniform vec3 horizonDay;
  uniform vec3 haloColor;
  uniform vec3 sunColor;
  uniform vec3 zenithNight;
  uniform vec3 horizonNight;
  uniform vec3 groundColor;
  uniform vec3 sunDirection;
  uniform vec3 moonDirection;
  uniform float dayness;
  varying vec3 vDirection;

  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float stars(vec3 dir) {
    vec3 p = dir * 140.0;
    vec3 cell = floor(p);
    float seed = hash(cell);
    if (seed < 0.965) return 0.0;
    vec3 center = cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) - 0.5) * 0.7;
    float d = length(p - center);
    float size = mix(0.08, 0.2, hash(cell + 7.9));
    float glow = smoothstep(size, 0.0, d);
    return glow * mix(0.35, 1.4, hash(cell + 9.1));
  }

  void main() {
    vec3 dir = normalize(vDirection);
    float h = dir.y;
    float up = clamp(h, 0.0, 1.0);
    float t = pow(up, 0.42);
    vec3 day = mix(horizonDay, zenithDay, t);
    vec3 night = mix(horizonNight, zenithNight, t);
    vec3 sky = mix(night, day, dayness);

    // Dust haze thickens toward the horizon.
    float haze = 1.0 - smoothstep(0.0, 0.16, up);
    sky = mix(sky, mix(horizonNight, horizonDay, dayness), haze * 0.55);

    // Blue scattering halo around the sun, and the sun disc itself (HDR for bloom).
    float sunAmount = max(dot(dir, sunDirection), 0.0);
    sky += haloColor * pow(sunAmount, 10.0) * 0.42 * dayness;
    sky += haloColor * pow(sunAmount, 2.5) * 0.08 * dayness;
    sky += sunColor * smoothstep(0.9985, 0.9993, sunAmount) * 4.0 * dayness;

    // Night: stars above the horizon and a small, cool moon.
    float starField = stars(dir) * smoothstep(-0.02, 0.12, h);
    sky += vec3(0.85, 0.9, 1.0) * starField * (1.0 - dayness);
    float moonAmount = max(dot(dir, moonDirection), 0.0);
    sky += vec3(0.75, 0.8, 0.95) * smoothstep(0.9975, 0.9988, moonAmount) * 1.6 * (1.0 - dayness);
    sky += vec3(0.4, 0.45, 0.6) * pow(moonAmount, 40.0) * 0.12 * (1.0 - dayness);

    // Below the horizon only the environment map ever looks; keep it dark.
    sky = mix(sky, groundColor, smoothstep(0.0, -0.1, h));

    gl_FragColor = vec4(sky, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSkyMaterial(dayness: number) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenithDay: { value: new THREE.Color(SKY.day.zenith) },
      horizonDay: { value: new THREE.Color(SKY.day.horizon) },
      haloColor: { value: new THREE.Color(SKY.day.halo) },
      sunColor: { value: new THREE.Color(SKY.day.sun) },
      zenithNight: { value: new THREE.Color(SKY.night.zenith) },
      horizonNight: { value: new THREE.Color(SKY.night.horizon) },
      groundColor: { value: new THREE.Color(SKY.ground) },
      sunDirection: { value: SKY.day.sunDirection.clone() },
      moonDirection: { value: SKY.night.sunDirection.clone() },
      dayness: { value: dayness },
    },
  });
}

/** Shared day/night progress so the dome, environment, and lights agree. */
export function useDayness() {
  const night = useWorld((state) => state.night);
  const reduced = useWorld((state) => state.reducedMotion);
  const dayness = useRef(night ? 0 : 1);
  useFrame((_, delta) => {
    const target = night ? 0 : 1;
    if (reduced) dayness.current = target;
    else dayness.current = THREE.MathUtils.damp(dayness.current, target, 2.2, delta);
    if (Math.abs(dayness.current - target) < 0.002) dayness.current = target;
  }, -2);
  return dayness;
}

/** The visible dome. It follows the camera so the horizon never recedes. */
export function SkyDome({ dayness }: { dayness: React.RefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => createSkyMaterial(dayness.current), [dayness]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => {
    if (!mesh.current) return;
    mesh.current.position.copy(camera.position);
    material.uniforms.dayness.value = dayness.current;
  }, -1);
  return (
    <mesh ref={mesh} name="sky-dome" material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[400, 48, 24]} />
    </mesh>
  );
}

/**
 * Image-based lighting generated from the same sky. Regenerated when the
 * day/night transition settles, so reflections and ambient follow the sky.
 */
export function SkyEnvironment({ dayness }: { dayness: React.RefObject<number> }) {
  const { gl, scene } = useThree();
  const quality = useWorld((state) => state.quality);
  const generated = useRef<{ dayness: number; target: THREE.WebGLRenderTarget } | null>(null);
  const envScene = useMemo(() => {
    const result = new THREE.Scene();
    const material = createSkyMaterial(1);
    result.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), material));
    return { scene: result, material };
  }, []);
  useEffect(() => {
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      generated.current?.target.dispose();
      generated.current = null;
      envScene.material.dispose();
    };
  }, [scene, envScene]);
  useFrame(() => {
    const current = dayness.current;
    const settled = current === 0 || current === 1;
    if (!settled && generated.current) return;
    if (generated.current && generated.current.dayness === current) return;
    envScene.material.uniforms.dayness.value = current;
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(envScene.scene, 0.035);
    generator.dispose();
    generated.current?.target.dispose();
    generated.current = { dayness: current, target };
    scene.environment = target.texture;
    scene.environmentIntensity = quality === 'low' ? 0.5 : 0.6;
  }, -1);
  return null;
}
