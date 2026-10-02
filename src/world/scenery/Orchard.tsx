import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { ORCHARD } from '../layout';
import { meadowTrailPoint, terrainHeight, walkwayHeight } from '../terrain';
import { Box, Cylinder, Sign } from '../primitives';
import { ORCHARD_BRANCH, ORCHARD_PAVILION } from './orchardPlacement';

function OrchardPath() {
  const geometry = useMemo(() => {
    const [startX, , startZ] = meadowTrailPoint(22);
    const controls: [number, number][] = [[startX, startZ], ...ORCHARD_BRANCH];
    const samples: [number, number][] = [];
    for (let segment = 1; segment < controls.length; segment++) {
      const [ax, az] = controls[segment - 1];
      const [bx, bz] = controls[segment];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.6);
      for (let step = segment === 1 ? 0 : 1; step <= steps; step++) {
        const t = step / steps;
        samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
      }
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const edgeColor = new THREE.Color('#ae986f');
    const centerColor = new THREE.Color('#dccba5');
    samples.forEach(([x, z], i) => {
      const [px, pz] = samples[Math.max(0, i - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, i + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const normalX = -(nz - pz) / length;
      const normalZ = (nx - px) / length;
      const progress = i / (samples.length - 1);
      const lift = 0.09 + 0.03 * THREE.MathUtils.smoothstep(progress, 0.85, 1);
      for (const side of [-1, 0, 1]) {
        const edgeX = x + normalX * side * 1.05;
        const edgeZ = z + normalZ * side * 1.05;
        positions.push(edgeX, walkwayHeight(edgeX, edgeZ, lift), edgeZ);
        const color = side === 0 ? centerColor : edgeColor;
        colors.push(color.r, color.g, color.b);
      }
      if (i) {
        const a = (i - 1) * 3;
        indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
        indices.push(a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
      }
    });
    const path = new THREE.BufferGeometry();
    path.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    path.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    path.setIndex(indices);
    path.computeVertexNormals();
    return path;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="orchard-branch-path" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

const TREE_SITES: [number, number][] = [
  [18, -55],
  [25, -55],
  [32, -55],
  [40, -56],
  [48, -59],
  [20, -80],
  [27, -82],
  [35, -83],
  [43, -84],
  [50, -82],
  [53, -69],
  [52, -76],
  [15, -85],
  [31, -89],
  [45, -91],
  [54, -60],
  [22, -50],
  [38, -50],
  [55, -88],
  [24, -89],
];

function OrchardTrees() {
  const quality = useWorld((state) => state.quality);
  const sites = useMemo(() => TREE_SITES.slice(0, quality === 'high' ? 20 : 12), [quality]);
  const mulch = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const lobes = useRef<THREE.InstancedMesh>(null);
  const fruit = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (
      !mulch.current ||
      !trunks.current ||
      !crowns.current ||
      !lobes.current ||
      (quality === 'high' && !fruit.current)
    )
      return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const foliage = ['#789460', '#91a66c', '#62865e', '#a8ad70'].map((c) => new THREE.Color(c));
    const apples = ['#d99067', '#e2b373', '#bd7864'].map((c) => new THREE.Color(c));
    const soils = ['#9b8668', '#aa9371', '#897b61'].map((c) => new THREE.Color(c));
    sites.forEach(([x, z], i) => {
      const y = terrainHeight(x, z);
      const treeScale = 0.88 + (i % 5) * 0.105;
      matrix.compose(
        position.set(x, y + 0.045, z),
        rotation,
        scale.set(treeScale, 1, treeScale * 0.84),
      );
      mulch.current!.setMatrixAt(i, matrix);
      mulch.current!.setColorAt(i, soils[i % soils.length]);
      matrix.compose(
        position.set(x, y + 1.55 * treeScale, z),
        rotation,
        scale.setScalar(treeScale),
      );
      trunks.current!.setMatrixAt(i, matrix);
      matrix.compose(
        position.set(x, y + 3.45 * treeScale, z),
        rotation,
        scale.set(2.35 * treeScale, 1.4 * treeScale, 2.1 * treeScale),
      );
      crowns.current!.setMatrixAt(i, matrix);
      crowns.current!.setColorAt(i, foliage[i % foliage.length]);
      for (let lobe = 0; lobe < 2; lobe++) {
        const angle = i * 1.7 + lobe * Math.PI;
        matrix.compose(
          position.set(
            x + Math.cos(angle) * 1.25 * treeScale,
            y + 3.65 * treeScale,
            z + Math.sin(angle) * 1.05 * treeScale,
          ),
          rotation,
          scale.set(1.25 * treeScale, 0.88 * treeScale, 1.15 * treeScale),
        );
        lobes.current!.setMatrixAt(i * 2 + lobe, matrix);
        lobes.current!.setColorAt(i * 2 + lobe, foliage[(i + lobe + 1) % foliage.length]);
      }
      if (fruit.current) {
        for (let berry = 0; berry < 5; berry++) {
          const angle = i * 1.43 + berry * 2.399963;
          const radius = (0.8 + (berry % 2) * 0.58) * treeScale;
          matrix.compose(
            position.set(
              x + Math.cos(angle) * radius,
              y + (2.65 + (berry % 3) * 0.38) * treeScale,
              z + Math.sin(angle) * radius,
            ),
            rotation,
            scale.setScalar(0.18 * treeScale),
          );
          fruit.current.setMatrixAt(i * 5 + berry, matrix);
          fruit.current.setColorAt(i * 5 + berry, apples[(i + berry) % apples.length]);
        }
      }
    });
    for (const mesh of [
      mulch.current,
      trunks.current,
      crowns.current,
      lobes.current,
      fruit.current,
    ]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [sites, quality]);
  return (
    <group name="orchard-tree-rows">
      <instancedMesh ref={mulch} args={[undefined, undefined, sites.length]} receiveShadow>
        <cylinderGeometry args={[1.62, 1.62, 0.08, 10]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={trunks}
        args={[undefined, undefined, sites.length]}
        castShadow={quality === 'high'}
      >
        <cylinderGeometry args={[0.16, 0.29, 3.1, 6]} />
        <meshStandardMaterial color="#765a43" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={crowns}
        args={[undefined, undefined, sites.length]}
        castShadow={quality === 'high'}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={lobes} args={[undefined, undefined, sites.length * 2]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      {quality === 'high' && (
        <instancedMesh ref={fruit} args={[undefined, undefined, sites.length * 5]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial roughness={0.88} flatShading />
        </instancedMesh>
      )}
    </group>
  );
}

function CommonsPavilion() {
  const { x, z } = ORCHARD_PAVILION;
  const posts = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!posts.current) return;
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1, 1, 1);
    const rotation = new THREE.Quaternion();
    [-2.55, 2.55].forEach((px, i) =>
      [-1.7, 1.7].forEach((pz, j) => {
        matrix.compose(new THREE.Vector3(px, 2.27, pz), rotation, scale);
        posts.current!.setMatrixAt(i * 2 + j, matrix);
      }),
    );
    posts.current.instanceMatrix.needsUpdate = true;
    posts.current.computeBoundingSphere();
  }, []);
  return (
    <group name="harvest-pavilion" position={[x, terrainHeight(x, z), z]}>
      <Box pos={[0, 0.13, 0]} size={[6.3, 0.25, 4.65]} color="#bba77f" radius={0.05} />
      <instancedMesh ref={posts} args={[undefined, undefined, 4]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 4.25, 6]} />
        <meshStandardMaterial color="#785b45" roughness={1} />
      </instancedMesh>
      <Box pos={[-1.45, 4.58, 0]} size={[3.3, 0.17, 5.2]} rotation={[0, 0, 0.27]} color="#b56f50" />
      <Box pos={[1.45, 4.58, 0]} size={[3.3, 0.17, 5.2]} rotation={[0, 0, -0.27]} color="#b56f50" />
      <Box pos={[0, 5.06, 0]} size={[0.34, 0.19, 5.25]} color="#dfac73" radius={0} />
      <Cylinder pos={[0, 5.59, 0]} r={0.045} h={0.9} color="#785b45" />
      <Box pos={[0, 5.95, 0]} size={[0.72, 0.08, 0.12]} color="#dfb47d" radius={0} />
      <Box pos={[0, 1.1, 0]} size={[3.6, 0.14, 1.15]} color="#d4b080" />
      {[-1.4, 1.4].map((px) => (
        <Box key={px} pos={[px, 0.59, 0]} size={[0.13, 1.05, 0.86]} color="#785b45" />
      ))}
      {[-1.15, 1.15].map((pz) => (
        <Box key={pz} pos={[0, 0.53, pz]} size={[3.3, 0.13, 0.4]} color="#8b684c" />
      ))}
      <Sign text="ORCHARD COMMONS" pos={[0, 3.96, 2.36]} size={[3.7, 0.39]} background="#ad7650" />
    </group>
  );
}

const PLANT_SITES: [number, number][] = [
  [32, -65],
  [35, -64.5],
  [39, -65],
  [41.5, -67.2],
  [42, -72.2],
  [39.5, -75.5],
  [35.8, -76],
  [31.8, -75],
  [28, -75],
  [30, -63],
  [44.8, -69],
  [46.5, -72],
];
const CRATE_SITES: [number, number, number][] = [
  [40.8, -78.2, 0],
  [42, -79, 0],
  [47, -78.5, 0],
  [47, -78.5, 0.8],
];

function HarvestDetails() {
  const quality = useWorld((state) => state.quality);
  const plantSites = useMemo(() => PLANT_SITES.slice(0, quality === 'high' ? 12 : 8), [quality]);
  const plants = useRef<THREE.InstancedMesh>(null);
  const crates = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!plants.current || !crates.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const greens = ['#7a9565', '#a3ad73', '#8e9e62', '#b2aa72'].map((c) => new THREE.Color(c));
    const woods = ['#a87551', '#bd8960', '#966e50'].map((c) => new THREE.Color(c));
    plantSites.forEach(([x, z], i) => {
      matrix.compose(
        position.set(x, terrainHeight(x, z) + 0.3, z),
        rotation,
        scale.set(0.7 + (i % 3) * 0.12, 0.4, 0.65),
      );
      plants.current!.setMatrixAt(i, matrix);
      plants.current!.setColorAt(i, greens[i % greens.length]);
    });
    CRATE_SITES.forEach(([x, z, stack], i) => {
      matrix.compose(
        position.set(x, terrainHeight(x, z) + 0.4 + stack, z),
        rotation,
        scale.set(1, 1, 1),
      );
      crates.current!.setMatrixAt(i, matrix);
      crates.current!.setColorAt(i, woods[i % woods.length]);
    });
    for (const mesh of [plants.current, crates.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [plantSites]);
  return (
    <group name="commons-harvest-planting">
      <instancedMesh ref={plants} args={[undefined, undefined, plantSites.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={crates} args={[undefined, undefined, CRATE_SITES.length]} castShadow>
        <boxGeometry args={[0.95, 0.8, 0.8]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}

function ArrivalCircle() {
  const ground = terrainHeight(ORCHARD.x, ORCHARD.z);
  return (
    <group name="orchard-arrival" position={[ORCHARD.x, ground, ORCHARD.z]}>
      <Cylinder pos={[0, 0.04, 0]} r={2.85} h={0.16} color="#c8b18b" />
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.45, 2.77, 28]} />
        <meshStandardMaterial color="#e0cd9d" roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function OrchardCommons() {
  return (
    <group name="orchard-commons">
      <OrchardPath />
      <ArrivalCircle />
      <OrchardTrees />
      <CommonsPavilion />
      <HarvestDetails />
    </group>
  );
}
