import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { renderedTerrainHeight } from '../terrain';
import { buildOuterLandscape, type FringeTree } from './outerLandscapePlacement';

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

// Four shared instanced meshes frame the camera-reachable land. These are
// distant scenic forms, not resident destinations or task activity signals.
export function OuterLandscape() {
  const quality = useWorld((state) => state.quality);
  const night = useWorld((state) => state.night);
  const placement = useMemo(() => buildOuterLandscape(quality), [quality]);
  const pines = useMemo(() => placement.trees.filter((tree) => tree.pine), [placement]);
  const broadleaf = useMemo(() => placement.trees.filter((tree) => !tree.pine), [placement]);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const pineCrowns = useRef<THREE.InstancedMesh>(null);
  const broadCrowns = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!trunks.current || !pineCrowns.current || !broadCrowns.current || !rocks.current) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    placement.trees.forEach((tree, index) => {
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
    setCrown(pineCrowns.current, pines, true);
    setCrown(broadCrowns.current, broadleaf, false);
    placement.rocks.forEach((rock, index) => {
      const ground = renderedTerrainHeight(rock.x, rock.z);
      matrix.compose(
        position.set(rock.x, ground + rock.size * 0.3, rock.z),
        rotation,
        scale.set(rock.size * 1.4, rock.size * 0.75, rock.size),
      );
      rocks.current!.setMatrixAt(index, matrix);
      rocks.current!.setColorAt(index, new THREE.Color(stone[rock.biome]));
    });
    const owned = [trunks.current, pineCrowns.current, broadCrowns.current, rocks.current];
    for (const mesh of owned) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return () => {
      owned.forEach((mesh) => mesh.dispose());
    };
  }, [placement, pines, broadleaf]);

  return (
    <group key={quality} name="distant-landscape-fringe">
      <instancedMesh ref={trunks} args={[undefined, undefined, placement.trees.length]}>
        <cylinderGeometry args={[0.13, 0.2, 1, 5]} />
        <meshStandardMaterial color={night ? '#7d8988' : '#665a48'} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={pineCrowns} args={[undefined, undefined, pines.length]}>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial color={night ? '#a4b5c2' : '#ffffff'} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={broadCrowns} args={[undefined, undefined, broadleaf.length]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={night ? '#a4b5c2' : '#ffffff'} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, placement.rocks.length]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={night ? '#a1b2b7' : '#ffffff'} roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
