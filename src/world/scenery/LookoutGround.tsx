import * as THREE from 'three';
import { LOOKOUT } from '../layout';
import { terrainHeight } from '../terrain';
import { Cylinder } from '../primitives';

export function MeadowLookoutGround() {
  const ground = terrainHeight(LOOKOUT.x, LOOKOUT.z);
  return (
    <group name="meadow-lookout-pad" position={[LOOKOUT.x, ground, LOOKOUT.z]}>
      <Cylinder pos={[0, 0, 0]} r={LOOKOUT.clearingRadius} h={0.2} color="#bfb391" />
      <mesh position={[0, 0.112, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.9, 3.12, 32]} />
        <meshStandardMaterial color="#d8cca7" roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
