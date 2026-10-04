import { clearOfMeadowRoutes } from './meadowPlacement';
import { clearOfNorthstarStructure, clearOfNorthstarTrail } from './northstarPlacement';

type FringeBiome = 'woodland' | 'amber' | 'highland' | 'meadow';
export type FringeTree = Readonly<{
  x: number;
  z: number;
  height: number;
  crown: number;
  biome: FringeBiome;
  pine: boolean;
}>;
export type FringeRock = Readonly<{ x: number; z: number; size: number; biome: FringeBiome }>;
export type FringePlacements = Readonly<{
  trees: readonly FringeTree[];
  rocks: readonly FringeRock[];
}>;

type Cluster = Readonly<{
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  count: number;
  biome: FringeBiome;
  phase: number;
}>;

// Broad sparse belts provide a recognizable skyline from camera-reachable
// terrain without putting props in the home district or the authored places.
const CLUSTERS: readonly Cluster[] = [
  { x: -130, z: -32, radiusX: 29, radiusZ: 24, count: 32, biome: 'woodland', phase: 0.3 },
  { x: -118, z: 20, radiusX: 25, radiusZ: 19, count: 22, biome: 'woodland', phase: 1.7 },
  { x: -145, z: 107, radiusX: 27, radiusZ: 22, count: 24, biome: 'amber', phase: 0.8 },
  { x: -73, z: 131, radiusX: 29, radiusZ: 18, count: 18, biome: 'amber', phase: 2.1 },
  { x: 104, z: 94, radiusX: 27, radiusZ: 25, count: 20, biome: 'meadow', phase: 0.2 },
  { x: 125, z: -38, radiusX: 29, radiusZ: 29, count: 21, biome: 'meadow', phase: 1.3 },
  { x: 4, z: -145, radiusX: 25, radiusZ: 21, count: 22, biome: 'highland', phase: 2.8 },
  { x: 84, z: -143, radiusX: 27, radiusZ: 24, count: 24, biome: 'highland', phase: 0.6 },
  { x: -136, z: -132, radiusX: 27, radiusZ: 20, count: 20, biome: 'highland', phase: 1.9 },
];

function clearOfWork(x: number, z: number, radius: number, biome: FringeBiome) {
  if (Math.max(Math.abs(x), Math.abs(z)) > 190 || Math.hypot(x, z) < 53) return false;
  // The meadow groundcover policy intentionally excludes the entire far-north
  // strip. Here a narrower check allows scenery *behind* Northstar, while
  // preserving the exact walkable spur, tower, and arrival clearing.
  if (biome === 'highland' && z < -116)
    return (
      clearOfNorthstarTrail(x, z, radius + 2.7) && clearOfNorthstarStructure(x, z, radius + 2.7)
    );
  return clearOfMeadowRoutes(x, z, radius + 1.8);
}

function candidate(cluster: Cluster, index: number) {
  const fraction = Math.sqrt((index + 0.5) / cluster.count);
  const angle = index * 2.3999632297 + cluster.phase;
  const ripple = 0.88 + ((index * 17 + Math.round(cluster.x)) % 7) * 0.035;
  return {
    x: cluster.x + Math.cos(angle) * cluster.radiusX * fraction * ripple,
    z: cluster.z + Math.sin(angle) * cluster.radiusZ * fraction * ripple,
  };
}

export function buildOuterLandscape(quality: 'high' | 'low'): FringePlacements {
  const trees: FringeTree[] = [];
  const rocks: FringeRock[] = [];
  const max = Math.max(...CLUSTERS.map((cluster) => cluster.count));
  for (let index = 0; index < max; index++) {
    for (const cluster of CLUSTERS) {
      if (index >= cluster.count || (quality === 'low' && index % 2 === 1)) continue;
      const point = candidate(cluster, index);
      const pine = cluster.biome === 'highland' || (cluster.biome === 'meadow' && index % 3 !== 0);
      const height = (pine ? 3.7 : 3.1) + ((index * 7 + cluster.count) % 7) * 0.46;
      const crown = pine ? height * 0.36 : height * 0.45;
      if (clearOfWork(point.x, point.z, crown, cluster.biome))
        trees.push({ ...point, height, crown, biome: cluster.biome, pine });
      if (index % 3 !== 0) continue;
      const rock = candidate(cluster, (index + 5) % cluster.count);
      const size = 0.9 + ((index * 11 + cluster.count) % 5) * 0.29;
      if (clearOfWork(rock.x + 2.8, rock.z - 2.1, size, cluster.biome))
        rocks.push({ x: rock.x + 2.8, z: rock.z - 2.1, size, biome: cluster.biome });
    }
  }
  return { trees, rocks };
}
