import { RockMaterial } from './RockMaterial';
import { clearOfReferenceHabitat } from './scenery/referenceHabitatPlacement';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { renderedTerrainHeight } from './terrain';
import { clearOfMeadowRoutes } from './scenery/meadowPlacement';
import { hashUnit } from './noise';
import { createRockVariants, ROCK_BASE_DEPTH, ROCK_VARIANT_COUNT } from './rocks';

type RockSite = { x: number; z: number; size: number; yaw: number; tilt: number; tall: boolean };

// A permanent, inexpensive silhouette layer: detail streaming never removes these
// formations. Route exclusions also protect authored destinations and approaches.
// Three size classes scatter by a golden-angle spiral; every body is a noise-
// displaced rock variant sunk into the regolith rather than a floating polyhedron.
export function DesertGeology() {
  const variants = useMemo(() => createRockVariants(2), []);
  useEffect(() => () => variants.forEach((geometry) => geometry.dispose()), [variants]);
  const groups = useMemo(() => {
    const sites: RockSite[][] = Array.from({ length: ROCK_VARIANT_COUNT }, () => []);
    for (let i = 0; i < 720; i++) {
      const angle = i * 2.399963;
      const radius = 25 + Math.sqrt(i / 720) * 340;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const roll = hashUnit(i, 3, 41);
      // Mostly cobbles, some boulders, a few large outcrops.
      const size =
        roll < 0.6
          ? 0.55 + roll * 0.9
          : roll < 0.9
            ? 1.1 + (roll - 0.6) * 4
            : 2.3 + (roll - 0.9) * 14;
      if (!clearOfMeadowRoutes(x, z, size * 1.4) || !clearOfReferenceHabitat(x, z, size)) continue;
      sites[i % ROCK_VARIANT_COUNT].push({
        x,
        z,
        size,
        yaw: hashUnit(i, 5, 43) * Math.PI * 2,
        tilt: (hashUnit(i, 7, 47) - 0.5) * 0.3,
        tall: i % 23 === 0,
      });
    }
    return sites;
  }, []);
  return (
    <group name="permanent-desert-formations">
      {groups.map((sites, variant) => (
        <RockGroup key={variant} sites={sites} geometry={variants[variant]} />
      ))}
    </group>
  );
}

function RockGroup({ sites, geometry }: { sites: RockSite[]; geometry: THREE.BufferGeometry }) {
  const rocks = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = rocks.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const palette = ['#6e4a40', '#8a5a48', '#9c6a52', '#5c3d36'].map(
      (color) => new THREE.Color(color),
    );
    sites.forEach(({ x, z, size, yaw, tilt, tall }, i) => {
      const height = size * (tall ? 2.4 : 0.78);
      rotation.setFromEuler(new THREE.Euler(tilt, yaw, tilt * 0.6));
      // Rest the flattened underside just below the rendered ground.
      const sink = height * ROCK_BASE_DEPTH - size * 0.08;
      matrix.compose(
        new THREE.Vector3(x, renderedTerrainHeight(x, z) + sink, z),
        rotation,
        new THREE.Vector3(size, height, size * 0.88),
      );
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, palette[i % palette.length]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return () => {
      mesh.dispose();
    };
  }, [sites]);
  if (!sites.length) return null;
  return (
    <instancedMesh
      ref={rocks}
      args={[geometry, undefined, sites.length]}
      castShadow
      receiveShadow
      dispose={null}
    >
      <RockMaterial />
    </instancedMesh>
  );
}
