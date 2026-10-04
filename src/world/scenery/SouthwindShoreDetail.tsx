import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { renderedTerrainHeight } from '../terrain';
import { SOUTHWIND_SHORE, clearOfSouthwindTrail } from './southwindTrailPlacement';
import { SOUTHWIND_MERE, waterRadiusAt } from './merePlacement';

const REED_BEDS = [
  { x: -45.5, z: 51.5 },
  { x: -45.2, z: 35.7 },
] as const;

function onDryBank(x: number, z: number) {
  const dx = x - SOUTHWIND_MERE.x;
  const dz = z - SOUTHWIND_MERE.z;
  const angle = Math.atan2(dz, dx);
  return (
    Math.hypot(dx, dz) > waterRadiusAt(angle) + 1.25 &&
    Math.hypot(x - SOUTHWIND_SHORE.x, z - SOUTHWIND_SHORE.z) > 4.25 &&
    clearOfSouthwindTrail(x, z, 0.55)
  );
}

export function SouthwindShoreDetail() {
  const quality = useWorld((state) => state.quality);
  const reeds = useRef<THREE.InstancedMesh>(null);
  const driftwood = useRef<THREE.InstancedMesh>(null);
  const sites = useMemo(() => {
    const stalks: { x: number; z: number; height: number }[] = [];
    const count = quality === 'high' ? 36 : 15;
    for (let index = 0; index < count; index++) {
      const bed = REED_BEDS[index % REED_BEDS.length];
      const angle = index * 2.399963;
      const radius = 0.45 + ((index * 11) % 16) * 0.12;
      const x = bed.x + Math.cos(angle) * radius;
      const z = bed.z + Math.sin(angle) * radius;
      if (onDryBank(x, z)) stalks.push({ x, z, height: 0.7 + ((index * 7) % 9) * 0.09 });
    }
    const logs = [
      { x: -47.2, z: 50.5, angle: 0.45 },
      { x: -44.5, z: 53.1, angle: -0.28 },
      { x: -46.5, z: 34.2, angle: 0.85 },
    ].filter(({ x, z }) => onDryBank(x, z));
    return { stalks, logs: quality === 'high' ? logs : logs.slice(0, 1) };
  }, [quality]);
  useEffect(() => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    if (reeds.current) {
      const shades = ['#768b68', '#94a074', '#b3ad78'].map((color) => new THREE.Color(color));
      sites.stalks.forEach(({ x, z, height }, index) => {
        matrix.compose(
          position.set(x, renderedTerrainHeight(x, z) + height * 0.47, z),
          rotation,
          scale.set(0.085, height, 0.085),
        );
        reeds.current!.setMatrixAt(index, matrix);
        reeds.current!.setColorAt(index, shades[index % shades.length]);
      });
      reeds.current.instanceMatrix.needsUpdate = true;
      if (reeds.current.instanceColor) reeds.current.instanceColor.needsUpdate = true;
      reeds.current.computeBoundingSphere();
    }
    if (driftwood.current) {
      sites.logs.forEach(({ x, z, angle }, index) => {
        rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        matrix.compose(
          position.set(x, renderedTerrainHeight(x, z) + 0.09, z),
          rotation,
          scale.set(index % 2 ? 1.15 : 1.55, 0.16, 0.22),
        );
        driftwood.current!.setMatrixAt(index, matrix);
      });
      driftwood.current.instanceMatrix.needsUpdate = true;
      driftwood.current.computeBoundingSphere();
    }
    const instances = [reeds.current, driftwood.current].filter(
      (mesh): mesh is THREE.InstancedMesh => mesh !== null,
    );
    return () => instances.forEach((mesh) => mesh.dispose());
  }, [sites]);
  return (
    <group key={quality} name="southwind-dry-bank-detail">
      <instancedMesh ref={reeds} args={[undefined, undefined, sites.stalks.length]}>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={driftwood} args={[undefined, undefined, sites.logs.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#9a8062" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
