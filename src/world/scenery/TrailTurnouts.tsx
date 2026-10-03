import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Box, Cylinder } from '../primitives';
import { meadowTrailPoint, walkwayHeight } from '../terrain';
import { TRAIL_TURNOUTS, turnoutPoint } from './turnoutPlacement';

function TurnoutSurface({ trailIndex, side }: { trailIndex: number; side: number }) {
  const geometry = useMemo(() => {
    const [trailX, , trailZ] = meadowTrailPoint(trailIndex);
    const [centerX, , centerZ] = turnoutPoint(trailIndex, side, 4.8);
    const positions: number[] = [];
    const indices: number[] = [];
    for (let step = 0; step <= 8; step++) {
      const t = step / 8;
      const x = THREE.MathUtils.lerp(trailX, centerX, t);
      const z = THREE.MathUtils.lerp(trailZ, centerZ, t);
      const lift = 0.055 + t * 0.035;
      for (const edge of [-0.8, 0.8]) {
        const edgeZ = z + edge;
        positions.push(x, walkwayHeight(x, edgeZ, lift), edgeZ);
      }
      if (step) {
        const a = (step - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const hub = positions.length / 3;
    positions.push(centerX, walkwayHeight(centerX, centerZ, 0.09), centerZ);
    const ring = hub + 1;
    for (let step = 0; step <= 28; step++) {
      const angle = (step / 28) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * 2.3;
      const z = centerZ + Math.sin(angle) * 2.3;
      positions.push(x, walkwayHeight(x, z, 0.09), z);
      if (step) indices.push(hub, ring + step - 1, ring + step);
    }
    const surface = new THREE.BufferGeometry();
    surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    surface.setIndex(indices);
    surface.computeVertexNormals();
    return surface;
  }, [trailIndex, side]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} name={`trail-turnout-surface-${trailIndex}`} receiveShadow>
      <meshStandardMaterial color="#c8bd99" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function TurnoutFurniture({ trailIndex, side }: { trailIndex: number; side: number }) {
  const [centerX, , centerZ] = turnoutPoint(trailIndex, side, 4.8);
  if (side < 0) {
    const x = centerX - 1.42;
    const z = centerZ + 1.12;
    return (
      <group name="western-trail-bench" position={[x, walkwayHeight(x, z, 0.1), z]}>
        <Box pos={[0, 0.48, 0]} size={[1.9, 0.13, 0.55]} color="#a8805d" radius={0} />
        <Box pos={[0, 0.88, -0.23]} size={[1.9, 0.65, 0.12]} color="#6f7e65" radius={0} />
        {[-0.73, 0.73].map((px) => (
          <Box key={px} pos={[px, 0.25, 0]} size={[0.13, 0.48, 0.45]} color="#765f4b" radius={0} />
        ))}
      </group>
    );
  }
  const x = centerX + 1.48;
  const z = centerZ - 1.15;
  return (
    <group name="eastern-trail-wayfinder" position={[x, walkwayHeight(x, z, 0.1), z]}>
      <Cylinder pos={[0, 0.91, 0]} r={0.08} h={1.82} color="#6b6551" />
      <Box
        pos={[0, 1.7, 0]}
        size={[0.78, 0.56, 0.12]}
        rotation={[0, 0, -0.16]}
        color="#b1a97e"
        radius={0}
      />
    </group>
  );
}

export function TrailTurnouts() {
  return (
    <group name="meadow-trail-turnouts">
      {TRAIL_TURNOUTS.map(({ id, trailIndex, side }) => (
        <group key={id} name={id}>
          <TurnoutSurface trailIndex={trailIndex} side={side} />
          <TurnoutFurniture trailIndex={trailIndex} side={side} />
        </group>
      ))}
    </group>
  );
}
