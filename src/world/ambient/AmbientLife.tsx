import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { ambientStep } from '../ambient';
import {
  beaconPulse,
  DUST_BOX,
  DUST_COUNT,
  DUST_DEVILS,
  dustDevilState,
  WIND,
} from '../ambientLife';
import { useKitScene } from '../scenery/kitMaterials';
import { useDayness } from '../Sky';
import { renderedTerrainHeight } from '../terrain';

/** Blowing dust, dust devils and blinking beacons. All decorative, none at low quality. */
export function AmbientLife() {
  const low = useWorld((s) => s.quality === 'low');
  return (
    <group name="ambient-life">
      <KitBeacons />
      {!low && <DustField />}
      {!low && <DustDevils />}
    </group>
  );
}

/** Every kit navigation light shares one material, so one pulse drives them all. */
function KitBeacons() {
  const { scene } = useKitScene();
  const reduced = useWorld((s) => s.reducedMotion);
  const material = useMemo(() => {
    let found: THREE.MeshStandardMaterial | null = null;
    scene.traverse((o) => {
      if (found || !(o instanceof THREE.Mesh)) return;
      const m = o.material as THREE.MeshStandardMaterial;
      if (m.name === 'airlock navigation light') found = m;
    });
    return found as THREE.MeshStandardMaterial | null;
  }, [scene]);
  useFrame(({ clock }) => {
    if (material) material.emissiveIntensity = beaconPulse(clock.elapsedTime, reduced);
  });
  return null;
}

const DUST_VERTEX = /* glsl */ `
  uniform float time;
  uniform vec3 origin;
  uniform vec3 wind;
  uniform vec3 box;
  attribute float seed;
  varying float fade;
  void main() {
    vec3 drift = position + wind * time * (0.6 + seed * 0.8);
    drift.y += sin(time * (0.4 + seed) + seed * 20.0) * 0.6;
    vec3 local = mod(drift - origin + box * 0.5, box) - box * 0.5;
    vec4 view = modelViewMatrix * vec4(origin + local, 1.0);
    float edge = 1.0 - smoothstep(0.55, 1.0, length(local.xz) / (box.x * 0.5));
    float height = 1.0 - smoothstep(0.0, 1.0, (local.y + box.y * 0.5) / box.y);
    fade = edge * (0.35 + 0.65 * height) * (0.5 + seed * 0.5);
    gl_PointSize = (2.0 + seed * 4.0) * 60.0 / max(-view.z, 1.0);
    gl_Position = projectionMatrix * view;
  }
`;
const DUST_FRAGMENT = /* glsl */ `
  uniform vec3 tint;
  varying float fade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.05, length(c)) * fade * 0.11;
    if (a < 0.003) discard;
    gl_FragColor = vec4(tint, a);
  }
`;

/** A wrapping field of wind-blown dust around the camera focus. */
function DustField() {
  const reduced = useWorld((s) => s.reducedMotion);
  const dayness = useDayness();
  const points = useRef<THREE.Points>(null);
  const time = useRef(0);
  const palette = useMemo(
    () => ({ day: new THREE.Color('#c98d62'), night: new THREE.Color('#4f5068') }),
    [],
  );
  const { geometry, material } = useMemo(() => {
    const count = DUST_COUNT.high;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let s = 7;
    const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * DUST_BOX[0];
      positions[i * 3 + 1] = (random() - 0.5) * DUST_BOX[1];
      positions[i * 3 + 2] = (random() - 0.5) * DUST_BOX[2];
      seeds[i] = random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        origin: { value: new THREE.Vector3() },
        wind: { value: new THREE.Vector3(...WIND) },
        box: { value: new THREE.Vector3(...DUST_BOX) },
        tint: { value: new THREE.Color() },
      },
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    return { geometry, material };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame((state, delta) => {
    time.current += ambientStep(delta, reduced, false);
    const controls = state.controls as { target?: THREE.Vector3 } | null;
    const focus = controls?.target ?? state.camera.position;
    material.uniforms.time.value = time.current;
    material.uniforms.origin.value.set(focus.x, Math.max(focus.y, 0) + DUST_BOX[1] * 0.3, focus.z);
    material.uniforms.tint.value.copy(palette.night).lerp(palette.day, dayness.current);
  });
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

const DEVIL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const DEVIL_FRAGMENT = /* glsl */ `
  uniform float spin;
  uniform float presence;
  uniform vec3 tint;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float u = vUv.x + spin * 0.12 + vUv.y * 0.9;
    float streaks = noise(vec2(u * 9.0, vUv.y * 5.0 - spin * 0.35)) * 0.7 + noise(vec2(u * 23.0, vUv.y * 11.0 - spin * 0.6)) * 0.3;
    float column = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
    float a = streaks * column * presence * 0.42;
    if (a < 0.01) discard;
    gl_FragColor = vec4(tint, a);
  }
`;

/** Tapered, spinning dust columns that drift across the far plains. */
function DustDevils() {
  const reduced = useWorld((s) => s.reducedMotion);
  const dayness = useDayness();
  const group = useRef<THREE.Group>(null);
  const time = useRef(0);
  const palette = useMemo(
    () => ({ day: new THREE.Color('#d9a97f'), night: new THREE.Color('#5c5c74') }),
    [],
  );
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(3.2, 0.9, 1, 24, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const materials = useMemo(
    () =>
      DUST_DEVILS.map(
        () =>
          new THREE.ShaderMaterial({
            uniforms: {
              spin: { value: 0 },
              presence: { value: 0 },
              tint: { value: new THREE.Color() },
            },
            vertexShader: DEVIL_VERTEX,
            fragmentShader: DEVIL_FRAGMENT,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
      ),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
    [geometry, materials],
  );
  useFrame((_, delta) => {
    time.current += ambientStep(delta, reduced, false);
    const devils = group.current?.children ?? [];
    devils.forEach((devil, index) => {
      const state = dustDevilState(time.current, index);
      const material = materials[index];
      devil.visible = !reduced && state.presence > 0.01;
      if (!devil.visible) return;
      devil.position.set(state.x, renderedTerrainHeight(state.x, state.z) - 0.2, state.z);
      devil.rotation.y = state.spin * 0.4;
      material.uniforms.spin.value = state.spin;
      material.uniforms.presence.value = state.presence;
      material.uniforms.tint.value.copy(palette.night).lerp(palette.day, dayness.current);
    });
  });
  return (
    <group ref={group} name="dust-devils">
      {DUST_DEVILS.map((devil, index) => (
        <mesh
          key={index}
          geometry={geometry}
          material={materials[index]}
          scale={[1, devil.height, 1]}
          visible={false}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
