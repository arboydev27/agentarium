import { WorldSurfaceMaterial } from '../WorldSurfaceMaterial';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { renderedTerrainHeight } from '../terrain';
import { AMBER_BLUFF } from './amberPlacement';

// Local +Z faces the authored southeast camera. This is a scenic-only rock
// formation: none of its surfaces create a resident destination or route.
const FACING = Math.atan2(15, 24);
const C = Math.cos(FACING);
const S = Math.sin(FACING);
const ANCHOR_X = [-8.9, -6.2, -3.5, -0.6, 2.2, 5.5, 8.7];
const ANCHOR_H = [0.15, 4.15, 5.6, 7.15, 6.65, 4.55, 0.2];
const X = Array.from({ length: 49 }, (_, i) => -8.9 + (i * 17.6) / 48);
const CREST = X.map((x) => {
  const next = ANCHOR_X.findIndex((v) => v > x);
  const segment = next < 0 ? 5 : Math.max(0, next - 1);
  const t = THREE.MathUtils.clamp(
    (x - ANCHOR_X[segment]) / (ANCHOR_X[segment + 1] - ANCHOR_X[segment]),
    0,
    1,
  );
  return (
    THREE.MathUtils.lerp(ANCHOR_H[segment], ANCHOR_H[segment + 1], t) +
    Math.sin(x * 2.3) * 0.28 -
    Math.pow(Math.max(0, Math.sin(x * 5.1)), 6) * 0.42
  );
});

function localToWorld(x: number, z: number): [number, number] {
  return [AMBER_BLUFF.x + C * x + S * z, AMBER_BLUFF.z - S * x + C * z];
}

function StrataFace() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const bands = ['#a87554', '#b7815d', '#b48a67', '#ab805f', '#c39771'].map(
      (shade) => new THREE.Color(shade),
    );
    const top = new THREE.Color('#bc9d70');
    const back = new THREE.Color('#9f8868');
    const addQuad = (a: number[], b: number[], c: number[], d: number[], shade: THREE.Color) => {
      const first = positions.length / 3;
      for (const vertex of [a, b, c, d]) {
        positions.push(...vertex);
        colors.push(shade.r, shade.g, shade.b);
      }
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    };
    const frontZ = (x: number, level: number) =>
      3.45 +
      Math.sin(x * 0.63) * 0.25 -
      level * 1.55 +
      Math.sin(x * 2.7 + level * 1.3) * 0.24 +
      Math.sin(level * 44 + x * 0.5) * 0.27 -
      Math.pow(Math.max(0, Math.sin(x * 1.2 + level * 18)), 3) * 0.4;
    for (let segment = 0; segment < X.length - 1; segment++) {
      const ax = X[segment];
      const bx = X[segment + 1];
      const ah = CREST[segment];
      const bh = CREST[segment + 1];
      for (let band = 0; band < 12; band++) {
        const bedding = (level: number, x: number) =>
          level / 12 + Math.sin(level * 1.8 + x * 0.35) * Math.sin((level / 12) * Math.PI) * 0.035;
        const al = bedding(band, ax),
          bl = bedding(band, bx),
          ahigh = bedding(band + 1, ax),
          bhigh = bedding(band + 1, bx);
        const color = bands[band % bands.length]
          .clone()
          .multiplyScalar(0.97 + Math.sin(ax * 0.6 + band) * 0.035);
        addQuad(
          [ax, -0.55 + (ah + 0.55) * al, frontZ(ax, al)],
          [bx, -0.55 + (bh + 0.55) * bl, frontZ(bx, bl)],
          [bx, -0.55 + (bh + 0.55) * bhigh, frontZ(bx, bhigh)],
          [ax, -0.55 + (ah + 0.55) * ahigh, frontZ(ax, ahigh)],
          color,
        );
      }
      // Irregular cap shelves carry erosion through the full volume.
      const capPoint = (x: number, h: number, t: number) => [
        x + Math.sin(t * Math.PI) * Math.sin(x * 1.7 + t * 6) * 0.22,
        h -
          0.25 * t +
          Math.sin(x * 2) * 0.35 * t +
          Math.sin(t * Math.PI) * Math.sin(x * 1.7 + t * 8) * 0.32,
        THREE.MathUtils.lerp(frontZ(x, 1), -3.35 + Math.sin(x * 0.8) * 0.5, t),
      ];
      for (let row = 0; row < 5; row++) {
        const t = row / 5,
          u = (row + 1) / 5;
        addQuad(
          capPoint(ax, ah, t),
          capPoint(bx, bh, t),
          capPoint(bx, bh, u),
          capPoint(ax, ah, u),
          top.clone().multiplyScalar(0.95 + Math.sin(row * 2 + ax) * 0.04),
        );
      }
      const rearPoint = (x: number, h: number, t: number) => {
        const steps = t === 1 ? 1 : (Math.floor(t * 4) + Math.min(1, ((t * 4) % 1) * 4)) / 4;
        const ridge = (h - 0.25 + Math.sin(x * 2) * 0.35 + 0.55) * (1 - steps) - 0.55;
        return [
          x * (1 + t * 0.1) + Math.sin(t * Math.PI) * Math.sin(x * 1.3 + t * 9) * 0.35,
          ridge + Math.sin(t * Math.PI) * (Math.sin(x * 2.7 + t * 8) * 0.2),
          -3.35 -
            5.35 * t +
            Math.sin(x * 0.8) * 0.5 * (1 - t) +
            Math.sin(t * Math.PI) * Math.sin(x * 0.9 + t * 12) * 0.45,
        ];
      };
      for (let row = 0; row < 16; row++) {
        const t = row / 16,
          u = (row + 1) / 16;
        addQuad(
          rearPoint(ax, ah, t),
          rearPoint(bx, bh, t),
          rearPoint(bx, bh, u),
          rearPoint(ax, ah, u),
          back.clone().multiplyScalar(0.94 + Math.sin(row * 1.3 + ax * 0.6) * 0.06),
        );
      }
    }
    // Low broken ends taper into talus rather than exposing a cut stone slab.
    for (const index of [0, X.length - 1]) {
      const x = X[index],
        h = CREST[index];
      addQuad(
        [x, -0.55, frontZ(x, 0)],
        [x, h, frontZ(x, 1)],
        [x, h - 0.25 + Math.sin(x * 2) * 0.35, -3.35 + Math.sin(x * 0.8) * 0.5],
        [x * 1.1, -0.55, -8.7],
        back,
      );
    }
    const rock = new THREE.BufferGeometry();
    rock.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rock.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    rock.setIndex(indices);
    rock.computeVertexNormals();
    return rock;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="amber-bluff-stratified-face" geometry={geometry} castShadow receiveShadow>
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

const PINE_SITES = [
  { x: -5.3, z: -2.1, crest: 4.55, height: 4.1 },
  { x: 5.1, z: -2.5, crest: 4.85, height: 3.6 },
  { x: -11.3, z: -6.1, crest: 0, height: 4.7 },
  { x: 11.1, z: -6.9, crest: 0, height: 4.3 },
  { x: -12.2, z: 1.2, crest: 0, height: 3.35 },
] as const;

function BluffPines({ baseY }: { baseY: number }) {
  const quality = useWorld((state) => state.quality);
  const sites = PINE_SITES.slice(0, quality === 'high' ? PINE_SITES.length : 3);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!trunks.current || !crowns.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const greens = ['#4b6558', '#5a7361', '#6d7f66'].map((shade) => new THREE.Color(shade));
    sites.forEach((site, index) => {
      const [wx, wz] = localToWorld(site.x, site.z);
      const root = site.crest ? site.crest : renderedTerrainHeight(wx, wz) - baseY;
      matrix.compose(
        position.set(site.x, root + site.height * 0.34, site.z),
        rotation,
        scale.set(1, site.height * 0.68, 1),
      );
      trunks.current!.setMatrixAt(index, matrix);
      matrix.compose(
        position.set(site.x, root + site.height * 0.77, site.z),
        rotation,
        scale.set(site.height * 0.29, site.height * 0.56, site.height * 0.29),
      );
      crowns.current!.setMatrixAt(index, matrix);
      crowns.current!.setColorAt(index, greens[index % greens.length]);
    });
    for (const mesh of [trunks.current, crowns.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    const owned = [trunks.current, crowns.current];
    return () => {
      owned.forEach((mesh) => mesh.dispose());
    };
  }, [baseY, sites]);
  return (
    <group key={quality} name="amber-bluff-sparse-pines">
      <instancedMesh ref={trunks} args={[undefined, undefined, sites.length]} castShadow>
        <cylinderGeometry args={[0.08, 0.18, 1, 5]} />
        <WorldSurfaceMaterial family="ironstone" color="#665b47" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, sites.length]} castShadow>
        <coneGeometry args={[1, 1, 7]} />
        <WorldSurfaceMaterial family="ironstone" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

function LookoutStone() {
  return (
    <group name="amber-bluff-scenic-stone" position={[0.45, 7.15, 0.9]}>
      <mesh position={[0, 0.9, 0]} rotation={[0.05, 0, -0.1]} castShadow>
        <dodecahedronGeometry args={[0.98, 0]} />
        <WorldSurfaceMaterial family="ironstone" color="#d8c497" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.12, 1.32, 0.83]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.6, 0.1, 0.05]} />
        <WorldSurfaceMaterial family="ironstone" color="#a27b50" roughness={1} />
      </mesh>
    </group>
  );
}

function BluffDetails({ baseY }: { baseY: number }) {
  const quality = useWorld((state) => state.quality);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const plants = useRef<THREE.InstancedMesh>(null);
  const blooms = useRef<THREE.InstancedMesh>(null);
  const rockSites = useMemo(() => {
    const entries = [
      [-10, 5],
      [-7, 8.2],
      [8.1, 7],
      [10.5, 1.5],
      [3, -9.8],
      [-3.5, 9.5],
      [6.5, 9.1],
      [-10.2, -8.1],
    ] as const;
    return entries.slice(0, quality === 'high' ? 8 : 5);
  }, [quality]);
  const plantSites = useMemo(() => {
    const count = quality === 'high' ? 34 : 13;
    return Array.from({ length: count }, (_, index) => {
      const angle = index * 2.399963;
      const radius = 8.1 + ((index * 7) % 13) * 0.31;
      return {
        x: Math.cos(angle) * radius,
        z: 5.8 + Math.abs(Math.sin(angle)) * 5.1,
        size: 0.34 + (index % 5) * 0.07,
      };
    });
  }, [quality]);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const ochres = ['#a68560', '#d1b17a', '#937b61'].map((shade) => new THREE.Color(shade));
    if (rocks.current) {
      rockSites.forEach(([x, z], index) => {
        const [wx, wz] = localToWorld(x, z);
        const size = 0.58 + (index % 4) * 0.2;
        matrix.compose(
          position.set(x, renderedTerrainHeight(wx, wz) - baseY + size * 0.23, z),
          rotation,
          scale.set(size, size * 0.5, size * 0.85),
        );
        rocks.current!.setMatrixAt(index, matrix);
        rocks.current!.setColorAt(index, ochres[index % ochres.length]);
      });
    }
    if (plants.current && blooms.current) {
      plantSites.forEach(({ x, z, size }, index) => {
        const [wx, wz] = localToWorld(x, z);
        const root = renderedTerrainHeight(wx, wz) - baseY;
        matrix.compose(
          position.set(x, root + size * 0.5, z),
          rotation,
          scale.set(size, size, size),
        );
        plants.current!.setMatrixAt(index, matrix);
        matrix.compose(
          position.set(x, root + size + 0.07, z),
          rotation,
          scale.setScalar(size * 0.27),
        );
        blooms.current!.setMatrixAt(index, matrix);
        blooms.current!.setColorAt(index, ochres[(index + 1) % ochres.length]);
      });
    }
    const owned = [rocks.current, plants.current, blooms.current].filter(
      (mesh): mesh is THREE.InstancedMesh => Boolean(mesh),
    );
    for (const mesh of owned) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return () => {
      owned.forEach((mesh) => mesh.dispose());
    };
  }, [baseY, rockSites, plantSites]);
  return (
    <group key={quality} name="amber-bluff-biome-detail">
      <instancedMesh ref={rocks} args={[undefined, undefined, rockSites.length]} receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <WorldSurfaceMaterial family="ironstone" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={plants} args={[undefined, undefined, plantSites.length]}>
        <coneGeometry args={[0.32, 1, 5]} />
        <WorldSurfaceMaterial family="ironstone" color="#71815c" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={blooms} args={[undefined, undefined, plantSites.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <WorldSurfaceMaterial family="ironstone" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

function ErodedTalus({ baseY }: { baseY: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4(),
      rotation = new THREE.Quaternion();
    for (let i = 0; i < 44; i++) {
      const x = -9.8 + (i % 16) * 1.26 + Math.sin(i * 7) * 0.4,
        z = 3.2 + Math.floor(i / 16) * 1.35 + Math.sin(i * 3) * 0.6;
      const [wx, wz] = localToWorld(x, z),
        size = 0.22 + (Math.sin(i * 9) + 1) * 0.22;
      rotation.setFromEuler(new THREE.Euler(i * 0.7, i * 2.4, i * 0.4));
      matrix.compose(
        new THREE.Vector3(x, renderedTerrainHeight(wx, wz) - baseY + size * 0.35, z),
        rotation,
        new THREE.Vector3(size * 1.4, size * 0.7, size),
      );
      mesh.current.setMatrixAt(i, matrix);
      mesh.current.setColorAt(i, new THREE.Color(i % 3 ? '#a47b5b' : '#c29a72'));
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [baseY]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 44]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <WorldSurfaceMaterial family="ironstone" flatShading />
    </instancedMesh>
  );
}

export function AmberBluff() {
  const baseY = renderedTerrainHeight(AMBER_BLUFF.x, AMBER_BLUFF.z);
  return (
    <group
      name="amber-bluff-scenic-only"
      position={[AMBER_BLUFF.x, baseY, AMBER_BLUFF.z]}
      rotation={[0, FACING, 0]}
    >
      <StrataFace />
      <ErodedTalus baseY={baseY} />
      <LookoutStone />
    </group>
  );
}
