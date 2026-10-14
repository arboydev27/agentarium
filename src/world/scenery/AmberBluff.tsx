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
const X = [-8.9, -6.2, -3.5, -0.6, 2.2, 5.5, 8.7] as const;
const CREST = [2.2, 4.15, 5.6, 7.15, 6.65, 4.55, 2.45] as const;

function localToWorld(x: number, z: number): [number, number] {
  return [AMBER_BLUFF.x + C * x + S * z, AMBER_BLUFF.z - S * x + C * z];
}

function StrataFace() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const bands = ['#8f765e', '#b48b5f', '#d1ad77', '#a98860', '#d9b983'].map(
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
    const frontZ = (x: number, level: number) => 3.45 + Math.sin(x * 0.63) * 0.25 - level * 1.55;
    for (let segment = 0; segment < X.length - 1; segment++) {
      const ax = X[segment];
      const bx = X[segment + 1];
      const ah = CREST[segment];
      const bh = CREST[segment + 1];
      for (let band = 0; band < 5; band++) {
        const low = band / 5;
        const high = (band + 1) / 5;
        const color = bands[(band + (segment % 2)) % bands.length];
        addQuad(
          [ax, -0.55 + (ah + 0.55) * low, frontZ(ax, low)],
          [bx, -0.55 + (bh + 0.55) * low, frontZ(bx, low)],
          [bx, -0.55 + (bh + 0.55) * high, frontZ(bx, high)],
          [ax, -0.55 + (ah + 0.55) * high, frontZ(ax, high)],
          color,
        );
      }
      // A broad shelf and tapering back make the landmark volumetric from
      // moving cameras without requiring a dense terrain mesh.
      addQuad(
        [ax, ah, frontZ(ax, 1)],
        [bx, bh, frontZ(bx, 1)],
        [bx, bh - 0.25, -3.35],
        [ax, ah - 0.25, -3.35],
        top,
      );
      addQuad(
        [ax, ah - 0.25, -3.35],
        [bx, bh - 0.25, -3.35],
        [bx * 1.1, -0.55, -8.7],
        [ax * 1.1, -0.55, -8.7],
        back,
      );
    }
    // Close the two exposed ends so an oblique camera sees solid stone.
    for (const index of [0, X.length - 1]) {
      const x = X[index];
      const h = CREST[index];
      addQuad(
        [x, -0.55, frontZ(x, 0)],
        [x, h, frontZ(x, 1)],
        [x, h - 0.25, -3.35],
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
      <meshStandardMaterial vertexColors roughness={1} flatShading side={THREE.DoubleSide} />
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
        <meshStandardMaterial color="#665b47" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, sites.length]} castShadow>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

function LookoutStone() {
  return (
    <group name="amber-bluff-scenic-stone" position={[0.45, 7.15, 0.9]}>
      <mesh position={[0, 0.9, 0]} rotation={[0.05, 0, -0.1]} castShadow>
        <dodecahedronGeometry args={[0.98, 0]} />
        <meshStandardMaterial color="#d8c497" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.12, 1.32, 0.83]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.6, 0.1, 0.05]} />
        <meshStandardMaterial color="#a27b50" roughness={1} />
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
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={plants} args={[undefined, undefined, plantSites.length]}>
        <coneGeometry args={[0.32, 1, 5]} />
        <meshStandardMaterial color="#71815c" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={blooms} args={[undefined, undefined, plantSites.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
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
      <BluffPines baseY={baseY} />
      <LookoutStone />
      <BluffDetails baseY={baseY} />
    </group>
  );
}
