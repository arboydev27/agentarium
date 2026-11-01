import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { ambientStep } from '../ambient';
import { KitInstances } from '../habitat/KitInstances';
import { Box, Cylinder, Sign } from '../primitives';
import { renderedTerrainHeight } from '../terrain';
import {
  constructionPlacements,
  FABRICATION_BAY,
  fencePosts,
  hoistLoad,
  hoistTipHeight,
  LOAD_SIZE,
  rampFoot,
  signPlacement,
  type ConstructionModule,
} from './constructionPlacement';

// The Fabrication Bay east of the Research Array: a foundation raft with the
// first wall tiles up, a ramp, crates waiting in the yard, a keep-out line of
// posts and tape, spoil heaps and a hoist that lowers a cargo box onto the raft
// and raises it again. Built from kit modules and primitives, every number from
// constructionPlacement.ts, and kept to a few dozen meshes because each is drawn
// in every pass. Decorative: nothing here reads agent state.

const POST_HEIGHT = 1.05;
const TAPE_HEIGHT = 0.92;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

export function ConstructionSite() {
  const { slab } = FABRICATION_BAY;
  const placements = useMemo(() => constructionPlacements(), []);
  return (
    <group name="fabrication-bay">
      <Box
        finish="cast-foundation"
        pos={[(slab.minX + slab.maxX) / 2, (slab.top + slab.base) / 2, (slab.minZ + slab.maxZ) / 2]}
        size={[slab.maxX - slab.minX, slab.top - slab.base, slab.maxZ - slab.minZ]}
        color="#aa7860"
      />
      <Ramp />
      {(Object.keys(placements) as ConstructionModule[]).map((module) => (
        <KitInstances key={module} module={module} placements={placements[module]} />
      ))}
      <Hoist />
      <Fence />
      <SpoilHeaps />
      <KeepOutSign />
    </group>
  );
}

/** The site sign on the trail-side fence, facing the trail. */
function KeepOutSign() {
  const sign = signPlacement();
  return (
    <group
      position={[sign.x, renderedTerrainHeight(sign.x, sign.z) + 1.38, sign.z]}
      rotation={[0, sign.yaw, 0]}
    >
      <Sign
        text="FABRICATION BAY"
        pos={[0, 0, 0]}
        size={[3, 0.6]}
        color="#f5d98a"
        background="#3a3f4a"
      />
    </group>
  );
}

/** A thin plate up the raft's west edge, on the crew's crossing. */
function Ramp() {
  const { ramp, slab } = FABRICATION_BAY;
  const foot = rampFoot();
  const run = slab.minX - ramp.minX;
  const rise = slab.top - foot;
  return (
    <Box
      finish="cast-foundation"
      pos={[(ramp.minX + slab.minX) / 2, (foot + slab.top) / 2 - 0.03, (ramp.minZ + ramp.maxZ) / 2]}
      size={[Math.hypot(run, rise) + 0.1, 0.07, ramp.maxZ - ramp.minZ]}
      rotation={[0, 0, Math.atan2(rise, run)]}
      color="#b08064"
      radius={0.01}
    />
  );
}

/** Spoil from the raft's footing, one instanced mesh. */
function SpoilHeaps() {
  const heaps = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = heaps.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    FABRICATION_BAY.heaps.forEach((heap, i) => {
      matrix.compose(
        new THREE.Vector3(heap.x, renderedTerrainHeight(heap.x, heap.z) + 0.05, heap.z),
        rotation,
        new THREE.Vector3(...heap.scale),
      );
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh
      ref={heaps}
      args={[undefined, undefined, FABRICATION_BAY.heaps.length]}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[1, 12, 10]} />
      <meshStandardMaterial color="#7d5443" roughness={0.9} />
    </instancedMesh>
  );
}

/** Mast, slewing boom and a cargo box on a cable that comes down over the raft and goes back up. */
function Hoist() {
  const { hoist } = FABRICATION_BAY;
  const ground = renderedTerrainHeight(hoist.x, hoist.z);
  const reduced = useWorld((s) => s.reducedMotion);
  const pivot = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Mesh>(null);
  const load = useRef<THREE.Group>(null);
  const time = useRef(0);
  const start = hoistLoad(0, true);
  useFrame((_, delta) => {
    time.current += ambientStep(delta, reduced, false);
    const pose = hoistLoad(time.current, reduced);
    if (pivot.current) pivot.current.rotation.y = pose.yaw;
    if (cable.current) {
      cable.current.scale.y = pose.cable;
      cable.current.position.y = -pose.cable / 2;
    }
    if (load.current) load.current.position.y = -pose.cable - LOAD_SIZE[1] / 2;
  });
  return (
    <group name="fabrication-hoist" position={[hoist.x, ground, hoist.z]}>
      <Cylinder
        finish="dusty-alloy"
        pos={[0, hoist.mast / 2, 0]}
        r={0.14}
        top={0.2}
        h={hoist.mast}
        color="#5d6a74"
      />
      <group ref={pivot} position={[0, hoistTipHeight() - ground, 0]}>
        <Box
          finish="dusty-alloy"
          pos={[0, 0, -hoist.boom / 2 + 0.55]}
          size={[0.18, 0.22, hoist.boom + 1.1]}
          color="#c9863a"
          radius={0.02}
        />
        <group position={[0, 0, -hoist.boom]}>
          <mesh ref={cable} position={[0, -start.cable / 2, 0]} scale={[1, start.cable, 1]}>
            <cylinderGeometry args={[0.015, 0.015, 1, 6]} />
            <meshStandardMaterial color="#2c3036" roughness={0.5} metalness={0.6} />
          </mesh>
          <group
            ref={load}
            position={[0, -start.cable - LOAD_SIZE[1] / 2, 0]}
            rotation={[0, 0.4, 0]}
          >
            <Box finish="dusty-alloy" size={[...LOAD_SIZE]} color="#8f7a5c" radius={0.03} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Posts and tape along three sides, each instanced once; the north side stays open. */
function Fence() {
  const posts = useRef<THREE.InstancedMesh>(null);
  const tape = useRef<THREE.InstancedMesh>(null);
  const layout = useMemo(
    () => fencePosts().map((post) => ({ ...post, y: renderedTerrainHeight(post.x, post.z) })),
    [],
  );
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const direction = new THREE.Vector3();
    layout.forEach((post, i) => {
      matrix.compose(
        position.set(post.x, post.y + POST_HEIGHT / 2, post.z),
        rotation.identity(),
        scale.set(1, 1, 1),
      );
      posts.current?.setMatrixAt(i, matrix);
    });
    for (let i = 0; i + 1 < layout.length; i++) {
      const a = layout[i];
      const b = layout[i + 1];
      direction.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const length = direction.length();
      rotation.setFromUnitVectors(Z_AXIS, direction.normalize());
      matrix.compose(
        position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + TAPE_HEIGHT, (a.z + b.z) / 2),
        rotation,
        scale.set(0.05, 0.07, length),
      );
      tape.current?.setMatrixAt(i, matrix);
    }
    if (posts.current) posts.current.instanceMatrix.needsUpdate = true;
    if (tape.current) tape.current.instanceMatrix.needsUpdate = true;
  }, [layout]);
  return (
    <group name="fabrication-fence">
      <instancedMesh
        ref={posts}
        args={[undefined, undefined, layout.length]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.045, 0.05, POST_HEIGHT, 8]} />
        <meshStandardMaterial color="#e0a33c" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={tape} args={[undefined, undefined, layout.length - 1]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f2d27a" roughness={0.7} />
      </instancedMesh>
    </group>
  );
}
