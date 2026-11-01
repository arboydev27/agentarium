import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useWorld } from '../state';
import { ambientStep } from './ambient';
import { disposeColonist, dressColonist, RESIDENT_MODEL_URL, WALK_CYCLE_SPEED } from './character';
import { CREW, CREW_PACE, CREW_SCALE, crewPose, type CrewMember } from './crew';
import { FABRICATION_BAY } from './scenery/constructionPlacement';
import { applySurfaceDetails, surfaceFamilyDetails } from './surfaceShader';
import { useSurfaceTextures } from './surfaceTextures';

// The construction crew: three colonist clones in work suits at nine tenths
// scale, walking the loops in crew.ts. They are scenery with a skeleton: no
// label, no ring, no click, no entry in the shared position map, nothing in the
// store. Their clocks run with the other ambient machines, so a paused
// simulation does not stop them and reduced motion parks them.
//
// A rigged figure is drawn in every pass (colour, shadow, ambient occlusion), so
// each one costs about as much as a resident. The crew therefore mount only
// while the camera is near the site, each mesh keeps a generous bounding sphere
// so the frustum can cull a figure the camera is not looking at, and a capsule
// casts each figure's shadow instead of its skinned meshes.

const ignoreRaycast: THREE.Object3D['raycast'] = () => {};
/**
 * Casts a figure's shadow in place of its skinned meshes: ten skinned draws per
 * figure in every shadow pass become one plain capsule. It writes no colour and
 * no depth, so the colour pass and the ambient-occlusion pass never see it.
 */
const SHADOW_PROXY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
/** Camera distance from the raft at which the crew mount, and the larger one at which they unmount. */
export const CREW_MOUNT_DISTANCE = 70;
export const CREW_UNMOUNT_DISTANCE = 85;
/** Bounding sphere for frustum culling, in the figure's own space: the whole body with room for every clip. */
const BODY_BOUNDS = { center: new THREE.Vector3(0, 0.95, 0), radius: 1.7 };
const SITE_CENTRE = new THREE.Vector3(
  (FABRICATION_BAY.slab.minX + FABRICATION_BAY.slab.maxX) / 2,
  FABRICATION_BAY.slab.top,
  (FABRICATION_BAY.slab.minZ + FABRICATION_BAY.slab.maxZ) / 2,
);

export function ConstructionCrew() {
  const [near, setNear] = useState(false);
  const nearRef = useRef(false);
  useFrame(({ camera }) => {
    const distance = camera.position.distanceTo(SITE_CENTRE);
    const next = nearRef.current
      ? distance < CREW_UNMOUNT_DISTANCE
      : distance < CREW_MOUNT_DISTANCE;
    if (next !== nearRef.current) {
      nearRef.current = next;
      setNear(next);
    }
  });
  return near ? <CrewFigures /> : null;
}

function CrewFigures() {
  const { scene, animations } = useGLTF(RESIDENT_MODEL_URL);
  const maps = useSurfaceTextures('ceramic-paint');
  return (
    <group name="construction-crew">
      {CREW.map((member) => (
        <CrewFigure
          key={member.role}
          member={member}
          scene={scene}
          clips={animations}
          maps={maps}
        />
      ))}
    </group>
  );
}

function CrewFigure({
  member,
  scene,
  clips,
  maps,
}: {
  member: CrewMember;
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  maps: THREE.Texture[];
}) {
  const reduced = useWorld((s) => s.reducedMotion);
  const dressed = useMemo(() => {
    const copy = clone(scene);
    const materials = dressColonist(copy, { ...member.look, bare: true });
    for (const material of materials) {
      // Crew never fade, so they stay opaque: out of the transparent queue and
      // out of the ambient-occlusion pass's extra transparency renders.
      material.transparent = false;
      material.opacity = 1;
      if (material.userData.role === 'suit' || material.userData.role === 'trim')
        applySurfaceDetails(material, maps, {
          metres: 1.6,
          local: true,
          ...surfaceFamilyDetails('ceramic-paint'),
        });
    }
    copy.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.raycast = ignoreRaycast;
      object.castShadow = false;
      if (object instanceof THREE.SkinnedMesh) {
        object.boundingSphere = new THREE.Sphere(BODY_BOUNDS.center.clone(), BODY_BOUNDS.radius);
        object.frustumCulled = true;
      }
    });
    return { copy, materials };
  }, [scene, member, maps]);
  const mixer = useMemo(() => new THREE.AnimationMixer(dressed.copy), [dressed]);
  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(dressed.copy);
      disposeColonist(dressed.copy, dressed.materials);
    },
    [dressed, mixer],
  );
  const root = useRef<THREE.Group>(null);
  const time = useRef(0);
  const facing = useRef(crewPose(member, 0, true).heading);
  const active = useRef<THREE.AnimationAction | null>(null);
  const current = useRef('');
  useFrame((_, delta) => {
    const step = ambientStep(delta, reduced, false);
    time.current += step;
    const pose = crewPose(member, time.current, reduced);
    const body = root.current;
    if (!body) return;
    body.position.set(pose.x, pose.y, pose.z);
    const turn = Math.atan2(
      Math.sin(pose.heading - facing.current),
      Math.cos(pose.heading - facing.current),
    );
    facing.current += turn * (reduced ? 1 : 1 - Math.exp(-10 * Math.min(delta, 0.05)));
    body.rotation.y = facing.current;
    if (pose.clip !== current.current) {
      const clip = clips.find((c) => c.name === pose.clip);
      if (clip) {
        active.current?.fadeOut(reduced ? 0 : 0.45);
        const next = mixer.clipAction(clip);
        next
          .reset()
          .setLoop(THREE.LoopRepeat, Infinity)
          .fadeIn(reduced ? 0 : 0.45)
          .play();
        active.current = next;
        current.current = pose.clip;
        if (reduced) mixer.update(0);
      }
    }
    // The body is scaled, so a stride covers less ground; keep the feet planted.
    if (active.current)
      active.current.timeScale =
        pose.clip === 'Walking' ? CREW_PACE / (WALK_CYCLE_SPEED * CREW_SCALE) : 1;
    mixer.update(step);
  });
  return (
    <group ref={root} name={`crew-${member.role}`} scale={CREW_SCALE}>
      <primitive object={dressed.copy} dispose={null} />
      <mesh castShadow position={[0, 0.88, 0]} material={SHADOW_PROXY} raycast={ignoreRaycast}>
        <capsuleGeometry args={[0.3, 1.05, 2, 8]} />
      </mesh>
    </group>
  );
}
