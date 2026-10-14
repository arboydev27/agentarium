import * as THREE from 'three';
import { biomeInfluence } from './biomes';

const meadow = new THREE.Color('#82a171');
const field = new THREE.Color('#acb78d');
const ridge = new THREE.Color('#90a397');
const woodland = new THREE.Color('#557a56');
const highland = new THREE.Color('#85999c');
const amber = new THREE.Color('#bf9b61');
const biomeColor = new THREE.Color();

// Sample in world coordinates so independently built tiles share the same
// palette at their edges. Lighting supplies the day/night color adjustment.
// Only `out` is returned and mutated; the palette and scratch color stay private.
export function landscapeVertexColor(
  x: number,
  z: number,
  y: number,
  out: THREE.Color,
): THREE.Color {
  const fieldPatch =
    (Math.sin(x * 0.082 + Math.sin(z * 0.04)) * Math.cos(z * 0.11 - x * 0.025) + 1) * 0.5;
  out
    .copy(meadow)
    .lerp(field, fieldPatch * 0.42)
    .lerp(ridge, THREE.MathUtils.clamp((y - 2.5) / 12, 0, 0.85));
  const biome = biomeInfluence(x, z);
  const weight = biome.woodland + biome.highland + biome.amber;
  if (weight > 0) {
    biomeColor.setRGB(
      (woodland.r * biome.woodland + highland.r * biome.highland + amber.r * biome.amber) / weight,
      (woodland.g * biome.woodland + highland.g * biome.highland + amber.g * biome.amber) / weight,
      (woodland.b * biome.woodland + highland.b * biome.highland + amber.b * biome.amber) / weight,
    );
    out.lerp(biomeColor, Math.min(0.87, weight * 0.82));
  }
  return out;
}
