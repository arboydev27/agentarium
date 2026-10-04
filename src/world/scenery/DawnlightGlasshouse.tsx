import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { Sign } from '../primitives';
import { renderedTerrainHeight, walkwayHeight } from '../terrain';
import { DAWNLIGHT_GLASSHOUSE, EAST_TRAIL_XZ } from './dawnlightPlacement';

// Local +Z follows the path through the conservatory. Its center aisle remains
// open from the western trail to the forecourt and resident destination.
const HEADING = Math.atan2(12, 9);
const COS = Math.cos(HEADING);
const SIN = Math.sin(HEADING);
const HALF_WIDTH = 4.8;
const HALF_LENGTH = 3.3;
const BED_SITES = [
  [-4, -1.65],
  [4, -1.65],
  [-4, 1.65],
  [4, 1.65],
] as const;

function localToWorld(x: number, z: number): [number, number] {
  return [
    DAWNLIGHT_GLASSHOUSE.centerX + COS * x + SIN * z,
    DAWNLIGHT_GLASSHOUSE.centerZ - SIN * x + COS * z,
  ];
}

function roofLevels() {
  let highestGround = -Infinity;
  for (const localX of [-HALF_WIDTH, HALF_WIDTH]) {
    for (const localZ of [-HALF_LENGTH, 0, HALF_LENGTH]) {
      const [x, z] = localToWorld(localX, localZ);
      highestGround = Math.max(highestGround, walkwayHeight(x, z, 0.08));
    }
  }
  return { eave: highestGround + 3.35, ridge: highestGround + 5.05 };
}

function EastTrail() {
  const geometry = useMemo(() => {
    const samples: [number, number][] = [];
    for (let index = 1; index < EAST_TRAIL_XZ.length; index++) {
      const [ax, az] = EAST_TRAIL_XZ[index - 1];
      const [bx, bz] = EAST_TRAIL_XZ[index];
      const sections = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.7));
      for (let step = index === 1 ? 0 : 1; step <= sections; step++) {
        const t = step / sections;
        samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
      }
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const edge = new THREE.Color('#a89c77');
    const middle = new THREE.Color('#d3c7a2');
    samples.forEach(([x, z], index) => {
      const [px, pz] = samples[Math.max(0, index - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const normalX = -(nz - pz) / length;
      const normalZ = (nx - px) / length;
      for (const [side, color] of [
        [-1, edge],
        [0, middle],
        [1, edge],
      ] as const) {
        const sx = x + normalX * side;
        const sz = z + normalZ * side;
        positions.push(sx, walkwayHeight(sx, sz, 0.08), sz);
        colors.push(color.r, color.g, color.b);
      }
      if (index > 0) {
        const a = (index - 1) * 3;
        const b = index * 3;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
        indices.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
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
    <mesh name="dawnlight-east-trail" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Forecourt() {
  const geometry = useMemo(() => {
    const { x: centerX, z: centerZ } = DAWNLIGHT_GLASSHOUSE;
    const positions = [centerX, walkwayHeight(centerX, centerZ, 0.09), centerZ];
    const indices: number[] = [];
    const segments = 32;
    for (let index = 0; index <= segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const radius = 3.25 + 0.08 * Math.sin(angle * 6);
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      positions.push(x, walkwayHeight(x, z, 0.09), z);
      if (index > 0) indices.push(0, index, index + 1);
    }
    const pad = new THREE.BufferGeometry();
    pad.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pad.setIndex(indices);
    pad.computeVertexNormals();
    return pad;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="dawnlight-arrival-forecourt" geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#c6b995" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

type FramePiece = {
  x: number;
  y: number;
  z: number;
  length: number;
  height: number;
  depth: number;
  angle?: number;
};

function ConservatoryFrame() {
  const frame = useRef<THREE.InstancedMesh>(null);
  const levels = useMemo(roofLevels, []);
  const pieces = useMemo(() => {
    const { eave, ridge } = levels;
    const result: FramePiece[] = [];
    for (const localX of [-HALF_WIDTH, HALF_WIDTH]) {
      for (const localZ of [-HALF_LENGTH, 0, HALF_LENGTH]) {
        const [x, z] = localToWorld(localX, localZ);
        const ground = walkwayHeight(x, z, 0.08);
        result.push({
          x: localX,
          y: (ground + eave) / 2,
          z: localZ,
          length: 0.18,
          height: eave - ground,
          depth: 0.18,
        });
      }
      result.push({
        x: localX,
        y: eave,
        z: 0,
        length: 0.15,
        height: 0.15,
        depth: HALF_LENGTH * 2 + 0.35,
      });
    }
    result.push({
      x: 0,
      y: ridge,
      z: 0,
      length: 0.15,
      height: 0.15,
      depth: HALF_LENGTH * 2 + 0.35,
    });
    const rise = ridge - eave;
    const rafterLength = Math.hypot(HALF_WIDTH, rise);
    const slope = Math.atan2(rise, HALF_WIDTH);
    for (const localZ of [-HALF_LENGTH, 0, HALF_LENGTH]) {
      for (const side of [-1, 1])
        result.push({
          x: side * HALF_WIDTH * 0.5,
          y: (eave + ridge) / 2,
          z: localZ,
          length: rafterLength,
          height: 0.14,
          depth: 0.14,
          angle: side === -1 ? slope : -slope,
        });
    }
    return result;
  }, [levels]);
  useEffect(() => {
    const mesh = frame.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    pieces.forEach((piece, index) => {
      rotation.setFromEuler(new THREE.Euler(0, 0, piece.angle ?? 0));
      matrix.compose(
        position.set(piece.x, piece.y, piece.z),
        rotation,
        scale.set(piece.length, piece.height, piece.depth),
      );
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return () => {
      mesh.dispose();
    };
  }, [pieces]);
  return (
    <group
      name="dawnlight-conservatory-frame"
      position={[DAWNLIGHT_GLASSHOUSE.centerX, 0, DAWNLIGHT_GLASSHOUSE.centerZ]}
      rotation={[0, HEADING, 0]}
    >
      <instancedMesh ref={frame} args={[undefined, undefined, pieces.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#476d5e" roughness={0.88} />
      </instancedMesh>
      <ConservatoryFloor />
      <GlassPanels eave={levels.eave} ridge={levels.ridge} />
      <HangingLanterns eave={levels.eave} ridge={levels.ridge} />
      <Sign
        text="DAWNLIGHT"
        pos={[0, levels.eave - 0.7, HALF_LENGTH + 0.08]}
        size={[2.5, 0.48]}
        background="#436759"
        color="#f1e9d1"
      />
    </group>
  );
}

function ConservatoryFloor() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const columns = 12;
    const rows = 10;
    for (let row = 0; row <= rows; row++) {
      const localZ = -HALF_LENGTH + (row / rows) * HALF_LENGTH * 2;
      for (let column = 0; column <= columns; column++) {
        const localX = -HALF_WIDTH + (column / columns) * HALF_WIDTH * 2;
        const [x, z] = localToWorld(localX, localZ);
        positions.push(localX, walkwayHeight(x, z, 0.045), localZ);
        if (row && column) {
          const a = (row - 1) * (columns + 1) + column - 1;
          const b = a + columns + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    const floor = new THREE.BufferGeometry();
    floor.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    floor.setIndex(indices);
    floor.computeVertexNormals();
    return floor;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="dawnlight-conservatory-floor" geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#c8c2a2" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function HangingLanterns({ eave, ridge }: { eave: number; ridge: number }) {
  const quality = useWorld((state) => state.quality);
  const cords = useRef<THREE.InstancedMesh>(null);
  const globes = useRef<THREE.InstancedMesh>(null);
  const sites = quality === 'high' ? [-1.8, 0, 1.8] : [0];
  useEffect(() => {
    if (!cords.current || !globes.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    sites.forEach((z, index) => {
      const globeY = eave - 0.48 - (index % 2) * 0.16;
      const cordLength = ridge - globeY - 0.25;
      matrix.compose(
        position.set(0, ridge - cordLength * 0.5, z),
        rotation,
        scale.set(0.035, cordLength, 0.035),
      );
      cords.current!.setMatrixAt(index, matrix);
      matrix.compose(
        position.set(0, globeY, z),
        rotation,
        scale.setScalar(index === 1 ? 0.43 : 0.34),
      );
      globes.current!.setMatrixAt(index, matrix);
    });
    const instances = [cords.current, globes.current];
    for (const mesh of instances) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return () => instances.forEach((mesh) => mesh.dispose());
  }, [eave, ridge, sites.length]);
  return (
    <group key={quality} name="dawnlight-hanging-lanterns">
      <instancedMesh ref={cords} args={[undefined, undefined, sites.length]}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshStandardMaterial color="#8f795b" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={globes} args={[undefined, undefined, sites.length]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#edd39b"
          emissive="#c39a52"
          emissiveIntensity={0.45}
          roughness={0.5}
        />
      </instancedMesh>
    </group>
  );
}

function GlassPanels({ eave, ridge }: { eave: number; ridge: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    function quad(
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
      d: [number, number, number],
    ) {
      const base = positions.length / 3;
      positions.push(...a, ...b, ...c, ...d);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    // The camera-facing half stays open so the plants and central aisle remain visible.
    for (const side of [-1, 1]) {
      quad(
        [side * HALF_WIDTH, eave, -HALF_LENGTH],
        [0, ridge, -HALF_LENGTH],
        [0, ridge, 0.4],
        [side * HALF_WIDTH, eave, 0.4],
      );
      quad(
        [side * HALF_WIDTH, eave - 2.35, -HALF_LENGTH],
        [side * HALF_WIDTH, eave, -HALF_LENGTH],
        [side * HALF_WIDTH, eave, HALF_LENGTH],
        [side * HALF_WIDTH, eave - 2.35, HALF_LENGTH],
      );
      const nearRidgeX = side * 2.2;
      const nearRidgeY = eave + ((ridge - eave) * (HALF_WIDTH - 2.2)) / HALF_WIDTH;
      quad(
        [side * HALF_WIDTH, eave, 0.4],
        [nearRidgeX, nearRidgeY, 0.4],
        [nearRidgeX, nearRidgeY, HALF_LENGTH],
        [side * HALF_WIDTH, eave, HALF_LENGTH],
      );
    }
    const panes = new THREE.BufferGeometry();
    panes.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    panes.setIndex(indices);
    panes.computeVertexNormals();
    return panes;
  }, [eave, ridge]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshStandardMaterial
        color="#80b7ad"
        transparent
        opacity={0.82}
        depthWrite={false}
        metalness={0.05}
        roughness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function PlantBeds() {
  const quality = useWorld((state) => state.quality);
  const beds = useRef<THREE.InstancedMesh>(null);
  const foliage = useRef<THREE.InstancedMesh>(null);
  const blossoms = useRef<THREE.InstancedMesh>(null);
  const leavesPerBed = quality === 'high' ? 4 : 2;
  useEffect(() => {
    if (!beds.current || !foliage.current || (quality === 'high' && !blossoms.current)) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const greens = ['#719665', '#89a875', '#5f8b69', '#a3ae79'].map(
      (color) => new THREE.Color(color),
    );
    BED_SITES.forEach(([localX, localZ], bedIndex) => {
      const [x, z] = localToWorld(localX, localZ);
      const ground = walkwayHeight(x, z, 0.1);
      matrix.compose(
        position.set(localX, ground + 0.23, localZ),
        rotation,
        scale.set(0.92, 0.44, 1.85),
      );
      beds.current!.setMatrixAt(bedIndex, matrix);
      for (let leaf = 0; leaf < leavesPerBed; leaf++) {
        const item = bedIndex * leavesPerBed + leaf;
        const offsetZ = (leaf - (leavesPerBed - 1) / 2) * 0.38;
        matrix.compose(
          position.set(
            localX + (leaf % 2 ? 0.1 : -0.1),
            ground + 0.91 + (leaf % 2) * 0.16,
            localZ + offsetZ,
          ),
          rotation,
          scale.set(0.56, 0.69 + (leaf % 2) * 0.16, 0.56),
        );
        foliage.current!.setMatrixAt(item, matrix);
        foliage.current!.setColorAt(item, greens[(item + bedIndex) % greens.length]);
        if (blossoms.current) {
          matrix.compose(
            position.set(localX, ground + 1.57, localZ + offsetZ),
            rotation,
            scale.setScalar(0.19),
          );
          blossoms.current.setMatrixAt(item, matrix);
          blossoms.current.setColorAt(item, new THREE.Color(item % 3 ? '#e5c798' : '#d9a98f'));
        }
      }
    });
    const instances = [beds.current, foliage.current, blossoms.current].filter(
      (mesh): mesh is THREE.InstancedMesh => mesh !== null,
    );
    for (const mesh of instances) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return () => instances.forEach((mesh) => mesh.dispose());
  }, [quality, leavesPerBed]);
  return (
    <group
      key={quality}
      name="dawnlight-plant-beds"
      position={[DAWNLIGHT_GLASSHOUSE.centerX, 0, DAWNLIGHT_GLASSHOUSE.centerZ]}
      rotation={[0, HEADING, 0]}
    >
      <instancedMesh ref={beds} args={[undefined, undefined, BED_SITES.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#947458" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={foliage} args={[undefined, undefined, BED_SITES.length * leavesPerBed]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      {quality === 'high' && (
        <instancedMesh
          ref={blossoms}
          args={[undefined, undefined, BED_SITES.length * leavesPerBed]}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial roughness={1} flatShading />
        </instancedMesh>
      )}
    </group>
  );
}

function distanceToEastTrail(x: number, z: number) {
  let nearest = Infinity;
  for (let index = 1; index < EAST_TRAIL_XZ.length; index++) {
    const [ax, az] = EAST_TRAIL_XZ[index - 1];
    const [bx, bz] = EAST_TRAIL_XZ[index];
    const dx = bx - ax;
    const dz = bz - az;
    const length = dx * dx + dz * dz;
    const t = length ? THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / length, 0, 1) : 0;
    nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return nearest;
}

function ForecourtGarden() {
  const quality = useWorld((state) => state.quality);
  const soils = useRef<THREE.InstancedMesh>(null);
  const hedges = useRef<THREE.InstancedMesh>(null);
  const blooms = useRef<THREE.InstancedMesh>(null);
  const sites = useMemo(() => {
    const clear = Array.from({ length: 16 }, (_, index) => {
      const angle = (index / 16) * Math.PI * 2 + 0.15;
      const radius = 4.8 + (index % 3) * 0.55;
      return {
        x: DAWNLIGHT_GLASSHOUSE.x + Math.cos(angle) * radius,
        z: DAWNLIGHT_GLASSHOUSE.z + Math.sin(angle) * radius,
        size: 0.65 + (index % 4) * 0.11,
        shade: index % 4,
      };
    }).filter(({ x, z }) => {
      const localX =
        COS * (x - DAWNLIGHT_GLASSHOUSE.centerX) - SIN * (z - DAWNLIGHT_GLASSHOUSE.centerZ);
      const localZ =
        SIN * (x - DAWNLIGHT_GLASSHOUSE.centerX) + COS * (z - DAWNLIGHT_GLASSHOUSE.centerZ);
      return distanceToEastTrail(x, z) > 3.7 && !(Math.abs(localX) < 5.5 && Math.abs(localZ) < 4.1);
    });
    return quality === 'high' ? clear : clear.filter((_, index) => index % 2 === 0);
  }, [quality]);
  useEffect(() => {
    if (!soils.current || !hedges.current || !blooms.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const greens = ['#799363', '#8fa36d', '#658a66', '#a1ad77'].map(
      (color) => new THREE.Color(color),
    );
    const flowers = ['#e8bf8e', '#e4d3a5', '#dfa897', '#f0dba9'].map(
      (color) => new THREE.Color(color),
    );
    sites.forEach(({ x, z, size, shade }, index) => {
      const ground = renderedTerrainHeight(x, z);
      matrix.compose(
        position.set(x, ground + 0.06, z),
        rotation,
        scale.set(size * 1.25, 0.12, size),
      );
      soils.current!.setMatrixAt(index, matrix);
      matrix.compose(
        position.set(x, ground + 0.3, z),
        rotation,
        scale.set(size, 0.46 + (index % 3) * 0.08, size * 0.82),
      );
      hedges.current!.setMatrixAt(index, matrix);
      hedges.current!.setColorAt(index, greens[shade]);
      const flowersPerSite = quality === 'high' ? 3 : 1;
      for (let flower = 0; flower < flowersPerSite; flower++) {
        const angle = index * 1.7 + flower * 2.4;
        const radius = flower ? size * 0.42 : 0;
        matrix.compose(
          position.set(
            x + Math.cos(angle) * radius,
            ground + 0.59 + (flower % 2) * 0.07,
            z + Math.sin(angle) * radius,
          ),
          rotation,
          scale.setScalar(quality === 'high' ? 0.16 : 0.19),
        );
        const item = index * flowersPerSite + flower;
        blooms.current!.setMatrixAt(item, matrix);
        blooms.current!.setColorAt(item, flowers[(shade + flower) % flowers.length]);
      }
    });
    const instances = [soils.current, hedges.current, blooms.current];
    for (const mesh of instances) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return () => instances.forEach((mesh) => mesh.dispose());
  }, [quality, sites]);
  const bloomCount = sites.length * (quality === 'high' ? 3 : 1);
  return (
    <group key={quality} name="dawnlight-forecourt-garden">
      <instancedMesh ref={soils} args={[undefined, undefined, sites.length]} receiveShadow>
        <sphereGeometry args={[1, 8, 5]} />
        <meshStandardMaterial color="#aa8e6b" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={hedges} args={[undefined, undefined, sites.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={blooms} args={[undefined, undefined, bloomCount]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

export function DawnlightGlasshouse() {
  return (
    <group name="dawnlight-glasshouse-district">
      <EastTrail />
      <Forecourt />
      <ConservatoryFrame />
      <PlantBeds />
      <ForecourtGarden />
    </group>
  );
}
