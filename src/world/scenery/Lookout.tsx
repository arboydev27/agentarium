import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { LOOKOUT } from '../layout';
import { terrainHeight } from '../terrain';
import { Box, Cylinder, Sphere, Sign } from '../primitives';

function LookoutCanopy() {
  const geometry = useMemo(() => {
    // The southeast face is open toward the lookout camera and the arriving
    // resident. The raised rear roof still reads as a landmark from the meadow.
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (3 * Math.PI) / 4 + (i / 6) * Math.PI;
      positions.push(Math.cos(angle) * 3.6, 3.03, Math.sin(angle) * 3.6);
      positions.push(Math.cos(angle) * 0.95, 3.62, Math.sin(angle) * 0.95);
      if (i) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const roof = new THREE.BufferGeometry();
    roof.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roof.setIndex(indices);
    roof.computeVertexNormals();
    return roof;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#3f6c58" roughness={0.85} flatShading side={THREE.DoubleSide} />
    </mesh>
  );
}

export function MeadowLookout() {
  const ground = terrainHeight(LOOKOUT.x, LOOKOUT.z);
  return (
    <group name="meadow-lookout" position={[LOOKOUT.x, ground, LOOKOUT.z]}>
      {[-2.35, 2.35].flatMap((x) =>
        [-2.2, 2.2].map((z) => (
          <group key={`${x},${z}`}>
            <Cylinder pos={[x, 1.4, z]} r={0.105} h={2.6} color="#82674c" />
            <Cylinder pos={[x, 0.17, z]} r={0.24} h={0.14} color="#d4c7a4" />
          </group>
        )),
      )}
      {[-2.2, 2.2].map((z) => (
        <Box key={z} pos={[0, 2.69, z]} size={[5.15, 0.15, 0.17]} color="#82674c" />
      ))}
      <LookoutCanopy />
      <Sign
        text="MEADOW LOOKOUT"
        pos={[0, 2.44, 2.33]}
        size={[2.9, 0.34]}
        color="#eee5ce"
        background="#476c58"
      />
      <Box pos={[2.7, 0.62, 0]} size={[0.12, 0.62, 2.15]} color="#8c7456" />
      <Box pos={[0, 0.62, -2.55]} size={[2.4, 0.62, 0.12]} color="#8c7456" />
      {[
        [4.4, -1.9],
        [4.7, 1.6],
        [1.5, -4.7],
        [-1.6, -4.6],
        [1.2, 4.6],
      ].map(([x, z], i) => (
        <group key={i}>
          <Sphere
            pos={[x, terrainHeight(LOOKOUT.x + x, LOOKOUT.z + z) - ground + 0.18, z]}
            scale={[0.66, 0.31, 0.6]}
            color={i % 2 ? '#74905f' : '#8ca573'}
          />
          <Sphere
            pos={[x + 0.32, terrainHeight(LOOKOUT.x + x, LOOKOUT.z + z) - ground + 0.39, z]}
            scale={[0.17, 0.13, 0.17]}
            color={i % 2 ? '#e5c890' : '#d3988a'}
          />
        </group>
      ))}
    </group>
  );
}
