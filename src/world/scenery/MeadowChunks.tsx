import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { selectDetailChunks, type DetailChunk } from '../chunks';
import { buildMeadowPieces, meadowChunkHasDetail } from './meadowPlacement';

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
  chunk,
  quality,
  shared,
}: {
  chunk: DetailChunk;
  quality: 'high' | 'low';
  shared: SharedMeshes;
}) {
  const pieces = useMemo(() => buildMeadowPieces(chunk, quality), [chunk, quality]);
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
    <group name={chunk.id}>
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
  const shared = useSharedMeshes();
  const [visible, setVisible] = useState<DetailChunk[]>([]);
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
    const next = chunks.filter(meadowChunkHasDetail);
    setVisible((previous) =>
      previous.length === next.length && previous.every((chunk, i) => chunk.id === next[i].id)
        ? previous
        : next,
    );
  });
  return (
    <group name="meadow-detail-chunks">
      {visible.map((chunk) => (
        <MeadowChunk
          key={`${quality}:${chunk.id}`}
          chunk={chunk}
          quality={quality}
          shared={shared}
        />
      ))}
    </group>
  );
}
