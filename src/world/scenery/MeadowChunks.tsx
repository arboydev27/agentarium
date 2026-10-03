import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { detailChunkAt, selectDetailChunks } from '../chunks';
import { LOOKOUT } from '../layout';
import { meadowTrailPoint, terrainHeight } from '../terrain';
import { clearOfOrchard } from './orchardPlacement';
import { clearOfObservatory } from './observatoryPlacement';

const PATCH_CENTERS: [number, number][] = [
  [-15, -22],
  [-17, -38],
  [-19, -57],
  [-12, -72],
  [19, -23],
  [25, -31],
  [25, -56],
  [14, -69],
];
const OAK = { x: 18.5, z: -44 } as const;

type Piece = { x: number; y: number; z: number; size: number; shade: number };
type ChunkPieces = { patches: Piece[]; flowers: Piece[]; rocks: Piece[] };

function clearOfRoutes(x: number, z: number) {
  const index = Math.max(0, Math.min(34, Math.round((-10.2 - z) / 2.35)));
  const trail = meadowTrailPoint(index);
  if (Math.abs(x - trail[0]) < 3.1 && Math.abs(z - trail[2]) < 2.6) return false;
  return (
    Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) >= LOOKOUT.focusRadius + 1.6 &&
    clearOfOrchard(x, z) &&
    clearOfObservatory(x, z)
  );
}

function buildPieces(quality: 'high' | 'low') {
  const count = quality === 'high' ? 240 : 104;
  const patches = Array.from({ length: count }, (_, i) => {
    const [cx, cz] = PATCH_CENTERS[i % PATCH_CENTERS.length];
    const ring = Math.floor(i / PATCH_CENTERS.length);
    const spread = Math.sqrt((ring + 0.5) / (count / PATCH_CENTERS.length)) * 8.5;
    const angle = i * 2.399963;
    const x = cx + Math.cos(angle) * spread;
    const z = cz + Math.sin(angle) * spread;
    const size = 0.66 + ((i * 11) % 17) * 0.045;
    return { x, z, y: terrainHeight(x, z), size, shade: i % 4 };
  }).filter(({ x, z }) => clearOfRoutes(x, z));
  const rocks = Array.from({ length: quality === 'high' ? 42 : 20 }, (_, i) => {
    const [cx, cz] = PATCH_CENTERS[(i * 3) % PATCH_CENTERS.length];
    const angle = i * 2.399963;
    const radius = 4.5 + ((i * 7) % 15) * 0.31;
    const x = cx + Math.cos(angle) * radius;
    const z = cz + Math.sin(angle) * radius;
    return { x, z, y: terrainHeight(x, z), size: 0.37 + (i % 5) * 0.095, shade: i % 3 };
  }).filter(({ x, z }) => clearOfRoutes(x, z) && Math.hypot(x - OAK.x, z - OAK.z) > 3.5);
  const groups = new Map<string, ChunkPieces>();
  const add = (piece: Piece, kind: keyof ChunkPieces) => {
    const chunk = detailChunkAt(piece.x, piece.z);
    if (!chunk) return;
    let group = groups.get(chunk.id);
    if (!group) {
      group = { patches: [], flowers: [], rocks: [] };
      groups.set(chunk.id, group);
    }
    group[kind].push(piece);
  };
  patches.forEach((piece, i) => {
    add(piece, 'patches');
    if (quality === 'high' && i % 3 === 0) add(piece, 'flowers');
  });
  rocks.forEach((piece) => add(piece, 'rocks'));
  return groups;
}

function useSharedMeshes() {
  const shared = useMemo(
    () => ({
      hummockGeometry: new THREE.SphereGeometry(1, 7, 5),
      flowerGeometry: new THREE.IcosahedronGeometry(1, 0),
      rockGeometry: new THREE.DodecahedronGeometry(1, 0),
      hummockMaterial: new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      flowerMaterial: new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      rockMaterial: new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
    }),
    [],
  );
  useEffect(() => () => Object.values(shared).forEach((resource) => resource.dispose()), [shared]);
  return shared;
}

type SharedMeshes = ReturnType<typeof useSharedMeshes>;

function MeadowChunk({
  id,
  pieces,
  shared,
}: {
  id: string;
  pieces: ChunkPieces;
  shared: SharedMeshes;
}) {
  const hummocks = useRef<THREE.InstancedMesh>(null);
  const blooms = useRef<THREE.InstancedMesh>(null);
  const stones = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!hummocks.current && pieces.patches.length) return;
    if (!stones.current && pieces.rocks.length) return;
    if (!blooms.current && pieces.flowers.length) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const greens = ['#779361', '#8fa472', '#6f8d65', '#a4ae79'].map((c) => new THREE.Color(c));
    const petals = ['#dfad81', '#e7cb91', '#d79b87', '#eadab0'].map((c) => new THREE.Color(c));
    const stoneColors = ['#b0aa8d', '#d0c4a1', '#9ba18a'].map((c) => new THREE.Color(c));
    pieces.patches.forEach(({ x, y, z, size, shade }, i) => {
      matrix.compose(
        position.set(x, y + size * 0.15, z),
        rotation,
        scale.set(size, size * 0.23, size * 0.76),
      );
      hummocks.current!.setMatrixAt(i, matrix);
      hummocks.current!.setColorAt(i, greens[shade]);
    });
    pieces.flowers.forEach(({ x, y, z, size, shade }, i) => {
      matrix.compose(position.set(x, y + size * 0.31, z), rotation, scale.setScalar(size * 0.115));
      blooms.current!.setMatrixAt(i, matrix);
      blooms.current!.setColorAt(i, petals[shade]);
    });
    pieces.rocks.forEach(({ x, y, z, size, shade }, i) => {
      matrix.compose(
        position.set(x, y + size * 0.27, z),
        rotation,
        scale.set(size, size * 0.6, size * 0.8),
      );
      stones.current!.setMatrixAt(i, matrix);
      stones.current!.setColorAt(i, stoneColors[shade]);
    });
    const instances = [hummocks.current, blooms.current, stones.current].filter(
      (mesh): mesh is THREE.InstancedMesh => mesh !== null,
    );
    for (const mesh of instances) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    // R3F leaves shared geometry/materials alone; dispose only per-chunk
    // instance buffers when the selection drops this chunk.
    return () => instances.forEach((mesh) => mesh.dispose());
  }, [pieces]);
  return (
    <group name={id}>
      {pieces.patches.length > 0 && (
        <instancedMesh
          ref={hummocks}
          args={[shared.hummockGeometry, shared.hummockMaterial, pieces.patches.length]}
          dispose={null}
        />
      )}
      {pieces.flowers.length > 0 && (
        <instancedMesh
          ref={blooms}
          args={[shared.flowerGeometry, shared.flowerMaterial, pieces.flowers.length]}
          dispose={null}
        />
      )}
      {pieces.rocks.length > 0 && (
        <instancedMesh
          ref={stones}
          args={[shared.rockGeometry, shared.rockMaterial, pieces.rocks.length]}
          dispose={null}
        />
      )}
    </group>
  );
}

export function MeadowChunks() {
  const quality = useWorld((state) => state.quality);
  const groups = useMemo(() => buildPieces(quality), [quality]);
  const shared = useSharedMeshes();
  const [visible, setVisible] = useState<string[]>([]);
  const selected = useRef<ReadonlySet<string>>(new Set());
  // Select on the first rendered frame, then sample at 0.2-second intervals.
  const elapsed = useRef(0.2);
  const direction = useRef(new THREE.Vector3());
  useFrame(({ camera }, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.2) return;
    elapsed.current = 0;
    camera.getWorldDirection(direction.current);
    const descent = -direction.current.y;
    const distance =
      descent > 0.05 ? Math.min(140, Math.max(0, (camera.position.y - 1) / descent)) : 0;
    const focus = {
      x: camera.position.x + direction.current.x * distance,
      z: camera.position.z + direction.current.z * distance,
    };
    const chunks = selectDetailChunks({ focus, camera: camera.position }, selected.current);
    selected.current = new Set(chunks.map((chunk) => chunk.id));
    const next = chunks.filter((chunk) => groups.has(chunk.id)).map((chunk) => chunk.id);
    setVisible((previous) =>
      previous.length === next.length && previous.every((id, i) => id === next[i])
        ? previous
        : next,
    );
  });
  return (
    <group name="meadow-detail-chunks">
      {visible.map((id) => {
        const pieces = groups.get(id);
        return pieces ? (
          <MeadowChunk key={`${quality}:${id}`} id={id} pieces={pieces} shared={shared} />
        ) : null;
      })}
    </group>
  );
}
