import { clearOfSouthwindTrail } from './southwindTrailPlacement';
import { WorldKit } from './WorldKit';
import { WorldSurfaceMaterial } from '../WorldSurfaceMaterial';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { renderedTerrainHeight } from '../terrain';
import { Sign } from '../primitives';
import { SOUTHWIND_MERE } from './merePlacement';
import { SOUTHWIND_SHORE } from './southwindTrailPlacement';
import { SensorMast } from './ColonyHardware';

// Existing basin terrain supplies the crater depression. The mineral layer
// follows that mesh rather than adding a floating water plane or blocking rim.
export function SouthwindMere() {
  const geometry = useMemo(() => {
    const { x, z } = SOUTHWIND_MERE;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const shade = new THREE.Color();
    const basalt = new THREE.Color('#603f3c');
    const salt = new THREE.Color('#d9b18a');
    for (let ring = 0; ring <= 24; ring++) {
      for (let segment = 0; segment <= 64; segment++) {
        const angle = (segment / 64) * Math.PI * 2;
        const radius =
          (ring / 24) *
          (10.6 +
            Math.sin(angle * 3) * 0.5 +
            Math.sin(angle * 13) * 0.22 +
            Math.cos(angle * 7) * 0.3);
        const px = x + Math.cos(angle) * radius;
        const pz = z + Math.sin(angle) * radius;
        positions.push(
          px,
          renderedTerrainHeight(px, pz) +
            0.035 +
            Math.exp(-Math.pow((ring / 24 - 0.86) / 0.12, 2)) * (0.25 + Math.sin(angle * 11) * 0.1),
          pz,
        );
        shade
          .copy(basalt)
          .lerp(salt, Math.pow(ring / 24, 1.4) * (0.55 + Math.sin(angle * 9 + ring * 0.9) * 0.16));
        colors.push(shade.r, shade.g, shade.b);
        if (ring && segment) {
          const a = (ring - 1) * 65 + segment - 1,
            b = ring * 65 + segment - 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    mesh.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    mesh.setIndex(indices);
    mesh.computeVertexNormals();
    return mesh;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const { x, z } = SOUTHWIND_SHORE;
  const ground = renderedTerrainHeight(x + 3, z);
  return (
    <group name="southwind-impact-basin">
      <mesh geometry={geometry} receiveShadow>
        <WorldSurfaceMaterial
          family="ironstone"
          vertexColors
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <CraterEjecta />
      <SensorMast x={x + 4} z={z - 3} height={3.2} />
      <group position={[x + 3, ground, z]}>
        <WorldKit module="sample-cabinet" />
        <Sign
          text="SOUTHWIND / CORE SAMPLES"
          pos={[0, 1.5, 0.72]}
          size={[3.2, 0.3]}
          background="#474451"
          color="#eee1cb"
        />
      </group>
    </group>
  );
}

function CraterEjecta() {
  const sites = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => {
        const angle = i * 2.399963,
          radius = 9.6 + (i % 5) * 0.62;
        return {
          x: SOUTHWIND_MERE.x + Math.cos(angle) * radius,
          z: SOUTHWIND_MERE.z + Math.sin(angle) * radius,
          size: 0.14 + (i % 6) * 0.065,
        };
      }).filter((s) => clearOfSouthwindTrail(s.x, s.z, s.size + 1)),
    [],
  );
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4(),
      rotation = new THREE.Quaternion();
    sites.forEach(({ x, z, size }, i) => {
      rotation.setFromEuler(new THREE.Euler(i, 0.7 * i, 0.3 * i));
      matrix.compose(
        new THREE.Vector3(x, renderedTerrainHeight(x, z) + size * 0.32, z),
        rotation,
        new THREE.Vector3(size * 1.5, size * 0.6, size),
      );
      mesh.current!.setMatrixAt(i, matrix);
      mesh.current!.setColorAt(i, new THREE.Color(i % 3 ? '#9a6c54' : '#c7a17c'));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [sites]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, sites.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <WorldSurfaceMaterial family="ironstone" flatShading />
    </instancedMesh>
  );
}
