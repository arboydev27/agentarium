import { WorldSurfaceMaterial } from './WorldSurfaceMaterial';
import { clearOfReferenceHabitat } from './scenery/referenceHabitatPlacement';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { renderedTerrainHeight } from './terrain';
import { clearOfMeadowRoutes } from './scenery/meadowPlacement';

// A permanent, inexpensive silhouette layer: detail streaming never removes these
// formations. Route exclusions also protect authored destinations and approaches.
export function DesertGeology() {
  const rocks = useRef<THREE.InstancedMesh>(null);
  const sites = useMemo(
    () =>
      Array.from({ length: 560 }, (_, i) => {
        const angle = i * 2.399963;
        const radius = 25 + Math.sqrt(i / 560) * 340;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const size = 0.8 + ((i * 17) % 13) * 0.23;
        return { x, z, size, angle, tall: i % 9 === 0 };
      }).filter(
        ({ x, z, size }) =>
          clearOfMeadowRoutes(x, z, size * 1.4) && clearOfReferenceHabitat(x, z, size),
      ),
    [],
  );
  useLayoutEffect(() => {
    const mesh = rocks.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const palette = ['#73493f', '#a66b50', '#bf8059', '#6e4540'].map(
      (color) => new THREE.Color(color),
    );
    sites.forEach(({ x, z, size, angle, tall }, i) => {
      const height = size * (tall ? 3.4 : 0.8);
      rotation.setFromEuler(new THREE.Euler(0.12, angle, tall ? 0.08 : 0.23));
      matrix.compose(
        new THREE.Vector3(x, renderedTerrainHeight(x, z) + height * 0.46, z),
        rotation,
        new THREE.Vector3(size, height, size * 0.8),
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
  return (
    <instancedMesh
      name="permanent-desert-formations"
      ref={rocks}
      args={[undefined, undefined, sites.length]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[1, 0]} />
      <WorldSurfaceMaterial family="ironstone" roughness={1} flatShading />
    </instancedMesh>
  );
}
