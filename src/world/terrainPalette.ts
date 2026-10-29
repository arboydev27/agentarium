import * as THREE from 'three';
import { biomeInfluence } from './biomes';

const regolith = new THREE.Color('#b96743');
const sand = new THREE.Color('#dda477');
const ridge = new THREE.Color('#814d45');
const basalt = new THREE.Color('#77433c');
const ironstone = new THREE.Color('#935f52');
const ochre = new THREE.Color('#e0a46c');
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
    .copy(regolith)
    .lerp(sand, fieldPatch * 0.42)
    .lerp(ridge, THREE.MathUtils.clamp((y - 2.5) / 12, 0, 0.85));
  const biome = biomeInfluence(x, z);
  const weight = biome.woodland + biome.highland + biome.amber;
  if (weight > 0) {
    biomeColor.setRGB(
      (basalt.r * biome.woodland + ironstone.r * biome.highland + ochre.r * biome.amber) / weight,
      (basalt.g * biome.woodland + ironstone.g * biome.highland + ochre.g * biome.amber) / weight,
      (basalt.b * biome.woodland + ironstone.b * biome.highland + ochre.b * biome.amber) / weight,
    );
    out.lerp(biomeColor, Math.min(0.87, weight * 0.82));
  }
  return out;
}
