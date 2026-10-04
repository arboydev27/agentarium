import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { renderedTerrainHeight } from '../terrain';
import {
  buildOuterLandscape,
  type FringePlacements,
  type FringeTree,
} from './outerLandscapePlacement';
import { partitionOuterLandscape, selectOuterGroups } from './outerLandscapeGroups';

const foliage: Record<FringeTree['biome'], readonly string[]> = {
  woodland: ['#41694e', '#587a57', '#6a865e'],
  amber: ['#967d4d', '#aa9463', '#777b4d'],
  highland: ['#6d8882', '#7f9990', '#879c98'],
  meadow: ['#678561', '#839a6f', '#7e987d'],
};
const stone: Record<FringeTree['biome'], string> = {
  woodland: '#778776',
  amber: '#ac9166',
  highland: '#9eaba6',
  meadow: '#a2a58b',
};

function useSharedMeshes(night: boolean) {
  const shared = useMemo(
    () => ({
      trunkGeometry: new THREE.CylinderGeometry(0.13, 0.2, 1, 5),
      pineGeometry: new THREE.ConeGeometry(1, 1, 7),
      broadGeometry: new THREE.DodecahedronGeometry(1, 0),
      rockGeometry: new THREE.DodecahedronGeometry(1, 0),
      trunkMaterial: new THREE.MeshStandardMaterial({
        color: night ? '#7d8988' : '#665a48',
        roughness: 1,
        flatShading: true,
      }),
      crownMaterial: new THREE.MeshStandardMaterial({
        color: night ? '#a4b5c2' : '#ffffff',
        roughness: 1,
        flatShading: true,
      }),
      rockMaterial: new THREE.MeshStandardMaterial({
        color: night ? '#a1b2b7' : '#ffffff',
        roughness: 1,
        flatShading: true,
      }),
    }),
    [],
  );
  // Keep mesh arguments stable so a theme change cannot reconstruct the
  // InstancedMeshes without repopulating their per-instance matrices.
  useEffect(() => {
    shared.trunkMaterial.color.set(night ? '#7d8988' : '#665a48');
    shared.crownMaterial.color.set(night ? '#a4b5c2' : '#ffffff');
    shared.rockMaterial.color.set(night ? '#a1b2b7' : '#ffffff');
  }, [night, shared]);
  useEffect(() => () => Object.values(shared).forEach((resource) => resource.dispose()), [shared]);
  return shared;
}

type SharedMeshes = ReturnType<typeof useSharedMeshes>;

function FringeLayer({
  name,
  pieces,
  shared,
}: {
  name: string;
  pieces: FringePlacements;
  shared: SharedMeshes;
}) {
  const pines = useMemo(() => pieces.trees.filter((tree) => tree.pine), [pieces]);
  const broadleaf = useMemo(() => pieces.trees.filter((tree) => !tree.pine), [pieces]);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const pineCrowns = useRef<THREE.InstancedMesh>(null);
  const broadCrowns = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (pieces.trees.length && !trunks.current) return;
    if (pines.length && !pineCrowns.current) return;
    if (broadleaf.length && !broadCrowns.current) return;
    if (pieces.rocks.length && !rocks.current) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    pieces.trees.forEach((tree, index) => {
      const ground = renderedTerrainHeight(tree.x, tree.z);
      matrix.compose(
        position.set(tree.x, ground + tree.height * 0.31, tree.z),
        rotation,
        scale.set(tree.height * 0.55, tree.height * 0.62, tree.height * 0.55),
      );
      trunks.current!.setMatrixAt(index, matrix);
    });
    const setCrown = (mesh: THREE.InstancedMesh, entries: readonly FringeTree[], pine: boolean) => {
      entries.forEach((tree, index) => {
        const ground = renderedTerrainHeight(tree.x, tree.z);
        matrix.compose(
          position.set(tree.x, ground + tree.height * (pine ? 0.73 : 0.75), tree.z),
          rotation,
          scale.set(tree.crown, tree.height * (pine ? 0.57 : 0.43), tree.crown),
        );
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index, new THREE.Color(foliage[tree.biome][index % 3]));
      });
    };
    if (pineCrowns.current) setCrown(pineCrowns.current, pines, true);
    if (broadCrowns.current) setCrown(broadCrowns.current, broadleaf, false);
    pieces.rocks.forEach((rock, index) => {
      const ground = renderedTerrainHeight(rock.x, rock.z);
      matrix.compose(
        position.set(rock.x, ground + rock.size * 0.3, rock.z),
        rotation,
        scale.set(rock.size * 1.4, rock.size * 0.75, rock.size),
      );
      rocks.current!.setMatrixAt(index, matrix);
      rocks.current!.setColorAt(index, new THREE.Color(stone[rock.biome]));
    });
    const owned = [trunks.current, pineCrowns.current, broadCrowns.current, rocks.current].filter(
      (mesh): mesh is THREE.InstancedMesh => mesh !== null,
    );
    for (const mesh of owned) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    // Geometries/materials are shared. Each mounted layer owns only its
    // per-instance buffers and releases them when it drops out of selection.
    return () => owned.forEach((mesh) => mesh.dispose());
  }, [pieces, pines, broadleaf]);

  return (
    <group name={name}>
      {pieces.trees.length > 0 && (
        <instancedMesh
          ref={trunks}
          args={[shared.trunkGeometry, shared.trunkMaterial, pieces.trees.length]}
          dispose={null}
        />
      )}
      {pines.length > 0 && (
        <instancedMesh
          ref={pineCrowns}
          args={[shared.pineGeometry, shared.crownMaterial, pines.length]}
          dispose={null}
        />
      )}
      {broadleaf.length > 0 && (
        <instancedMesh
          ref={broadCrowns}
          args={[shared.broadGeometry, shared.crownMaterial, broadleaf.length]}
          dispose={null}
        />
      )}
      {pieces.rocks.length > 0 && (
        <instancedMesh
          ref={rocks}
          args={[shared.rockGeometry, shared.rockMaterial, pieces.rocks.length]}
          dispose={null}
        />
      )}
    </group>
  );
}

// Scenic selection only; residents, routes, and task state never depend on it.
export function OuterLandscape() {
  const quality = useWorld((state) => state.quality);
  const night = useWorld((state) => state.night);
  const catalog = useMemo(() => partitionOuterLandscape(buildOuterLandscape(quality)), [quality]);
  const shared = useSharedMeshes(night);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const previous = useRef<ReadonlySet<string>>(new Set());
  const elapsed = useRef(0.2);
  const direction = useRef(new THREE.Vector3());

  // A coarse skyline is always present. Only optional detail groups follow the
  // camera, sampled five times per second with wider exit than entry radii.
  useFrame(({ camera }, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.2) return;
    elapsed.current = 0;
    camera.getWorldDirection(direction.current);
    const descent = -direction.current.y;
    const distance =
      descent > 0.05 ? Math.min(180, Math.max(0, (camera.position.y - 1) / descent)) : 0;
    const focus = {
      x: camera.position.x + direction.current.x * distance,
      z: camera.position.z + direction.current.z * distance,
    };
    const selected = selectOuterGroups(
      catalog.groups,
      { focus, camera: camera.position },
      previous.current,
    );
    const ids = selected.map((group) => group.id);
    previous.current = new Set(ids);
    setVisibleIds((current) =>
      current.length === ids.length && current.every((id, index) => id === ids[index])
        ? current
        : ids,
    );
  });
  const visible = new Set(visibleIds);
  return (
    <group name="distant-landscape-fringe">
      <FringeLayer
        key={`${quality}:coarse`}
        name="outer-fringe:coarse"
        pieces={catalog.coarse}
        shared={shared}
      />
      {catalog.groups
        .filter((group) => visible.has(group.id))
        .map((group) => (
          <FringeLayer
            key={`${quality}:${group.id}`}
            name={group.id}
            pieces={group}
            shared={shared}
          />
        ))}
    </group>
  );
}
