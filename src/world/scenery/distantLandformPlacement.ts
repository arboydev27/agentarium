export type LandformBiome = 'woodland' | 'highland' | 'amber' | 'meadow';
export type DistantLandform = Readonly<{
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  rise: number;
  phase: number;
  biome: LandformBiome;
}>;

// These broad, shallow forms sit beyond every resident destination and route.
// Neighboring western, eastern, and southern forms overlap so outward camera
// travel sees a rolling skyline rather than isolated hills or a vertical wall.
export const DISTANT_LANDFORMS: readonly DistantLandform[] = [
  { x: -38, z: -122, radiusX: 34, radiusZ: 30, rise: 15, phase: 0.3, biome: 'highland' },
  { x: 98, z: -159, radiusX: 40, radiusZ: 32, rise: 10, phase: 1.4, biome: 'highland' },
  { x: -153, z: -127, radiusX: 39, radiusZ: 35, rise: 9, phase: 2.2, biome: 'highland' },
  { x: -195, z: -51, radiusX: 45, radiusZ: 42, rise: 8, phase: 0.8, biome: 'woodland' },
  { x: -207, z: 29, radiusX: 47, radiusZ: 44, rise: 10, phase: 1.8, biome: 'woodland' },
  { x: -192, z: 111, radiusX: 45, radiusZ: 42, rise: 9, phase: 2.6, biome: 'amber' },
  { x: -78, z: 211, radiusX: 53, radiusZ: 43, rise: 8, phase: 0.9, biome: 'amber' },
  { x: 28, z: 224, radiusX: 55, radiusZ: 43, rise: 7, phase: 2.0, biome: 'meadow' },
  { x: 124, z: 206, radiusX: 51, radiusZ: 42, rise: 8, phase: 1.2, biome: 'meadow' },
  { x: 209, z: 109, radiusX: 45, radiusZ: 42, rise: 8, phase: 2.7, biome: 'meadow' },
  { x: 221, z: 21, radiusX: 50, radiusZ: 48, rise: 9, phase: 0.6, biome: 'meadow' },
  { x: 211, z: -69, radiusX: 47, radiusZ: 45, rise: 10, phase: 1.7, biome: 'highland' },
  // A second, lower-frequency layer stays visible beyond the ±210 travel area.
  { x: -278, z: -7, radiusX: 62, radiusZ: 76, rise: 14, phase: 0.4, biome: 'woodland' },
  { x: -272, z: 150, radiusX: 60, radiusZ: 64, rise: 12, phase: 2.4, biome: 'amber' },
  { x: 286, z: 4, radiusX: 64, radiusZ: 77, rise: 13, phase: 1.1, biome: 'meadow' },
  { x: 269, z: 158, radiusX: 61, radiusZ: 65, rise: 11, phase: 2.6, biome: 'meadow' },
  { x: 8, z: 291, radiusX: 83, radiusZ: 60, rise: 12, phase: 0.7, biome: 'meadow' },
  { x: -6, z: -277, radiusX: 82, radiusZ: 61, rise: 12, phase: 1.9, biome: 'highland' },
];

// The outer skirt is embedded, so it cannot expose a polygon edge above the
// sampled Landscape mesh even where the two meshes use different tessellation.
export const LANDFORM_SKIRT_RADIUS = 1.12;
export const LANDFORM_SKIRT_DROP = 3.5;

export function landformRingPoint(
  landform: DistantLandform,
  radius: number,
  section: number,
  sides: number,
) {
  const angle = (section / sides) * Math.PI * 2;
  const edge =
    1 + Math.sin(angle * 3 + landform.phase) * 0.07 + Math.cos(angle * 5 - landform.phase) * 0.045;
  return {
    x: landform.x + Math.cos(angle) * landform.radiusX * radius * edge,
    z: landform.z + Math.sin(angle) * landform.radiusZ * radius * edge,
  };
}
