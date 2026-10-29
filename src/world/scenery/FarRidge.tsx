import { WorldSurfaceMaterial } from '../WorldSurfaceMaterial';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { terrainHeight } from '../terrain';
import { Box } from '../primitives';
import { clearOfNorthstarTrail } from './northstarPlacement';

const ROWS = [-84, -95, -109] as const;
const SPAN = 204;
const SEGMENTS = 34;

function ridgeFold(x: number) {
  return Math.sin(x * 0.052) * 2.1 + Math.sin(x * 0.133 + 0.8) * 1.15 + Math.cos(x * 0.024) * 1.5;
}

function northstarPassWeight(x: number, z: number) {
  // Open a diagonal saddle where the connected Northstar trail crosses the ridge.
  const centerX = 28 + ((-z - 95) / 14) * 12;
  return THREE.MathUtils.smoothstep(Math.abs(x - centerX), 20, 38);
}

function ridgeRowHeight(x: number, row: number) {
  const z = ROWS[row];
  const rise = [0.14, 6.7, 12.7][row];
  const fold = ridgeFold(x) * [0, 0.62, 1.12][row];
  const passWeight = northstarPassWeight(x, z);
  // The scenic strip is coarser than Landscape; tuck its pass below that mesh.
  return terrainHeight(x, z) + (rise + fold) * passWeight - 2.0 * (1 - passWeight);
}

export function ridgeHeight(x: number, z: number) {
  const row = z >= ROWS[1] ? 0 : 1;
  const t = THREE.MathUtils.clamp((ROWS[row] - z) / (ROWS[row] - ROWS[row + 1]), 0, 1);
  return THREE.MathUtils.lerp(ridgeRowHeight(x, row), ridgeRowHeight(x, row + 1), t);
}

function RidgeFace() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const palette = ['#ba7959', '#79443c', '#a36550'].map((value) => new THREE.Color(value));
    ROWS.forEach((z, row) => {
      for (let i = 0; i <= SEGMENTS; i++) {
        const x = -SPAN / 2 + (i / SEGMENTS) * SPAN;
        positions.push(x, ridgeRowHeight(x, row), z);
        const shade = palette[row].clone().multiplyScalar(0.93 + ((i * 7) % 6) * 0.018);
        colors.push(shade.r, shade.g, shade.b);
        if (row > 0 && i > 0) {
          const near = (row - 1) * (SEGMENTS + 1) + i - 1;
          const far = row * (SEGMENTS + 1) + i - 1;
          indices.push(near, near + 1, far, near + 1, far + 1, far);
        }
      }
    });
    const landform = new THREE.BufferGeometry();
    landform.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    landform.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    landform.setIndex(indices);
    landform.computeVertexNormals();
    return landform;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="northern-scenic-ridge" geometry={geometry} receiveShadow>
      <WorldSurfaceMaterial
        family="ironstone"
        vertexColors
        roughness={1}
        flatShading
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function WeatheredArch() {
  const x = 73;
  const z = -99;
  return (
    <group name="distant-weathered-arch" position={[x, ridgeHeight(x, z), z]}>
      <Box
        finish="ironstone"
        pos={[-1.65, 2.35, 0]}
        size={[0.88, 4.7, 0.83]}
        color="#995b48"
        radius={0}
      />
      <Box
        finish="ironstone"
        pos={[1.65, 1.98, 0]}
        size={[0.82, 3.96, 0.78]}
        color="#af7158"
        radius={0}
      />
      <Box
        finish="ironstone"
        pos={[-0.07, 4.75, 0]}
        size={[4.3, 0.6, 0.9]}
        rotation={[0, 0, -0.08]}
        color="#cd9571"
        radius={0}
      />
    </group>
  );
}

function RidgeStones() {
  const stones = useRef<THREE.InstancedMesh>(null);
  const sites = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => {
        const x = -84 + index * 6.1;
        const z = -88 - ((index * 7) % 17);
        const size = 0.4 + ((index * 11) % 7) * 0.12;
        return { x, z, size, index };
      }).filter(({ x, z, size }) => clearOfNorthstarTrail(x, z, size + 0.7)),
    [],
  );
  useEffect(() => {
    if (!stones.current) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const shades = ['#bf8567', '#8d5345', '#d19e79'].map((value) => new THREE.Color(value));
    sites.forEach(({ x, z, size, index }, slot) => {
      matrix.compose(
        position.set(x, ridgeHeight(x, z) + size * 0.28, z),
        rotation,
        scale.set(size, size * 0.55, size * 0.85),
      );
      stones.current!.setMatrixAt(slot, matrix);
      stones.current!.setColorAt(slot, shades[index % shades.length]);
    });
    const mesh = stones.current;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return () => {
      mesh.dispose();
    };
  }, [sites]);
  return (
    <instancedMesh ref={stones} args={[undefined, undefined, sites.length]}>
      <dodecahedronGeometry args={[1, 0]} />
      <WorldSurfaceMaterial family="ironstone" roughness={1} flatShading />
    </instancedMesh>
  );
}

export function FarRidge() {
  const quality = useWorld((state) => state.quality);
  return (
    <group name="far-ridge-scenery">
      <RidgeFace />
      <WeatheredArch />
      {quality === 'high' && <RidgeStones />}
    </group>
  );
}
