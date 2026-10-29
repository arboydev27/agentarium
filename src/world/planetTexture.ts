import * as THREE from 'three';

function hash(x: number, y: number, z: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return value - Math.floor(value);
}
function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const smooth = (value: number) => value * value * (3 - 2 * value);
  const tx = smooth(x - ix),
    ty = smooth(y - iy),
    tz = smooth(z - iz);
  const mix = THREE.MathUtils.lerp;
  const plane = (layer: number) =>
    mix(
      mix(hash(ix, iy, layer), hash(ix + 1, iy, layer), tx),
      mix(hash(ix, iy + 1, layer), hash(ix + 1, iy + 1, layer), tx),
      ty,
    );
  return mix(plane(iz), plane(iz + 1), tz);
}

// Sample a continuous 3D mineral field on the unit sphere: no longitude seam.
export function planetMineral(x: number, y: number, z: number) {
  return (
    noise(x * 4, y * 4, z * 4) * 0.6 +
    noise(x * 13, y * 13, z * 13) * 0.28 +
    noise(x * 37, y * 37, z * 37) * 0.12
  );
}

export type PlanetSurface = 'colony' | 'cratered' | 'ochre' | 'banded';

// Crater bowls and raised rims are sampled in sphere space, including at the UV seam.
function craterRelief(x: number, y: number, z: number) {
  let relief = 0;
  for (let i = 0; i < 18; i++) {
    const latitude = Math.acos(1 - (2 * (i + 0.5)) / 18);
    const longitude = i * 2.39996323;
    const cx = Math.sin(latitude) * Math.cos(longitude);
    const cy = Math.cos(latitude);
    const cz = Math.sin(latitude) * Math.sin(longitude);
    const distance = Math.hypot(x - cx, y - cy, z - cz) / (0.08 + hash(i, 2, 7) * 0.15);
    if (distance < 1.25) {
      relief -= 0.18 * Math.max(0, 1 - distance * distance);
      relief += 0.09 * Math.exp(-Math.pow((distance - 1) / 0.12, 2));
    }
  }
  return relief;
}

export function createPlanetTexture(kind: PlanetSurface = 'colony', reliefMap = false) {
  const width = 1024,
    height = 512;
  const pixels = new Uint8Array(width * height * 4);
  const palette = {
    colony: ['#a2674e', '#e2b08a'],
    cratered: ['#494851', '#c0b7a8'],
    ochre: ['#805a39', '#e8ce91'],
    banded: ['#79594e', '#e3c8a4'],
  }[kind];
  const low = new THREE.Color(palette[0]);
  const high = new THREE.Color(palette[1]);
  const cap = new THREE.Color('#ead6bc');
  const shade = new THREE.Color();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const longitude = (x / (width - 1)) * Math.PI * 2;
      const latitude = (y / (height - 1)) * Math.PI;
      const nx = Math.sin(latitude) * Math.cos(longitude);
      const nz = Math.sin(latitude) * Math.sin(longitude);
      const ny = Math.cos(latitude);
      const mineral = planetMineral(nx, ny, nz);
      const craters = craterRelief(nx, ny, nz);
      const field =
        kind === 'banded'
          ? 0.5 + Math.sin(ny * 34 + mineral * 5) * 0.18 + (mineral - 0.5) * 0.3
          : mineral + craters * (kind === 'cratered' ? 1.8 : 0.8);
      shade.copy(low).lerp(high, THREE.MathUtils.smoothstep(field, 0.22, 0.78));
      if (kind === 'colony')
        shade.lerp(cap, THREE.MathUtils.smoothstep(Math.abs(ny) + field * 0.035, 0.985, 1.025));
      if (reliefMap) shade.setRGB(field, field, field);
      const offset = (y * width + x) * 4;
      pixels[offset] = shade.r * 255;
      pixels[offset + 1] = shade.g * 255;
      pixels[offset + 2] = shade.b * 255;
      pixels[offset + 3] = 255;
    }
  const map = new THREE.DataTexture(pixels, width, height);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}
