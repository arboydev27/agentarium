import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { SIT_LIFT, DESK_Z } from './motion';
export const ROBOT_SCALE = 0.37;
const vec = () => new THREE.Vector3();
// Offline CCD pose authoring: sample the bundled rig once, not IK on every render frame.
function reach(joints: THREE.Object3D[], palm: THREE.Object3D, target: THREE.Vector3) {
  const origin = vec(),
    end = vec(),
    direction = vec();
  const rotation = new THREE.Quaternion(),
    world = new THREE.Quaternion(),
    parent = new THREE.Quaternion();
  for (let pass = 0; pass < 12; pass++) {
    for (const joint of [...joints].reverse()) {
      joint.updateWorldMatrix(true, true);
      joint.getWorldPosition(origin);
      palm.getWorldPosition(end);
      end.sub(origin).normalize();
      direction.copy(target).sub(origin).normalize();
      rotation.setFromUnitVectors(end, direction);
      joint.getWorldQuaternion(world);
      joint.parent!.getWorldQuaternion(parent).invert();
      joint.quaternion.copy(parent.multiply(rotation.multiply(world))).normalize();
      joint.updateWorldMatrix(false, true);
    }
  }
}
function samplePose(model: THREE.Object3D, clip: THREE.AnimationClip, time: number) {
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.update(time);
  model.updateMatrixWorld(true);
  // Keep sampled transforms after freeing mixer bindings.
  const pose = new Map<
    THREE.Object3D,
    { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }
  >();
  model.traverse((o) =>
    pose.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }),
  );
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  for (const [o, t] of pose) {
    o.position.copy(t.p);
    o.quaternion.copy(t.q);
    o.scale.copy(t.s);
  }
  return pose;
}
export function createCharacterClips(source: THREE.Object3D, clips: THREE.AnimationClip[]) {
  const poser = clone(source);
  const sitting = clips.find((c) => c.name === 'Sitting')!;
  const pose = samplePose(poser, sitting, sitting.duration);
  const names = ['DeskType', 'DeskReview', 'DeskWait', 'DeskError'];
  const result: THREE.AnimationClip[] = [];
  for (const name of names) {
    const duration = 4,
      steps = 48;
    const times = Array.from({ length: steps + 1 }, (_, i) => (i * duration) / steps);
    const bones: THREE.Object3D[] = [];
    poser.traverse((o) => {
      if (o instanceof THREE.Bone) bones.push(o);
    });
    const values = new Map(bones.map((o) => [o, { p: [] as number[], q: [] as number[] }]));
    for (const time of times) {
      for (const [o, t] of pose) {
        o.position.copy(t.p);
        o.quaternion.copy(t.q);
        o.scale.copy(t.s);
      }
      const wave = Math.sin((time * Math.PI) / 2);
      const head = poser.getObjectByName('Head')!;
      head.rotateY(
        name === 'DeskReview' ? wave * 0.12 : name === 'DeskError' ? -0.12 : wave * 0.025,
      );
      head.rotateX(name === 'DeskError' ? 0.12 : 0.025);
      poser.updateMatrixWorld(true);
      for (const side of ['L', 'R']) {
        const sign = side === 'L' ? 1 : -1;
        const tap =
          name === 'DeskType'
            ? Math.sin(time * Math.PI * 6 + (sign === 1 ? 0 : Math.PI)) * 0.014
            : 0;
        const waiting = name === 'DeskWait' && side === 'R';
        const target = new THREE.Vector3(
          waiting ? -0.44 : sign * 0.18,
          (waiting ? 1.48 + wave * 0.025 : 1.08 + tap) - SIT_LIFT,
          (waiting ? -0.38 : -0.1) - DESK_Z,
        ).divideScalar(ROBOT_SCALE);
        reach(
          [poser.getObjectByName(`UpperArm${side}`)!, poser.getObjectByName(`LowerArm${side}`)!],
          poser.getObjectByName(`Palm1${side}`)!,
          target,
        );
      }
      for (const bone of bones) {
        const v = values.get(bone)!;
        bone.position.toArray(v.p, v.p.length);
        bone.quaternion.toArray(v.q, v.q.length);
      }
    }
    result.push(
      new THREE.AnimationClip(
        name,
        duration,
        bones.flatMap((bone) => {
          const v = values.get(bone)!;
          return [
            new THREE.VectorKeyframeTrack(`${bone.name}.position`, times, v.p),
            new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, v.q),
          ];
        }),
      ),
    );
  }
  const idle = clips.find((c) => c.name === 'Idle')!;
  const restPose = samplePose(poser, idle, 0.3);
  const bones: THREE.Object3D[] = [];
  poser.traverse((o) => {
    if (o instanceof THREE.Bone) bones.push(o);
  });
  const times = Array.from({ length: 49 }, (_, i) => i / 4);
  const tracks = new Map(bones.map((o) => [o, { p: [] as number[], q: [] as number[] }]));
  for (const t of times) {
    for (const [o, p] of restPose) {
      o.position.copy(p.p);
      o.quaternion.copy(p.q);
      o.scale.copy(p.s);
    }
    const stretch = Math.pow(Math.max(0, Math.sin((t * Math.PI) / 6)), 4);
    poser.getObjectByName('Head')!.rotateY(Math.sin((t * Math.PI) / 6) * 0.16);
    poser.getObjectByName('UpperArmL')!.rotateZ(-stretch * 0.28);
    poser.getObjectByName('UpperArmR')!.rotateZ(stretch * 0.28);
    for (const bone of bones) {
      const v = tracks.get(bone)!;
      bone.position.toArray(v.p, v.p.length);
      bone.quaternion.toArray(v.q, v.q.length);
    }
  }
  const rest = new THREE.AnimationClip(
    'Rest',
    12,
    bones.flatMap((b) => {
      const v = tracks.get(b)!;
      return [
        new THREE.VectorKeyframeTrack(`${b.name}.position`, times, v.p),
        new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, v.q),
      ];
    }),
  );
  // Destination poses keep feet/seat alignment, with hands away from an absent keyboard.
  for (const name of ['BenchRest', 'CafeBreak', 'GardenLook']) {
    const base = name === 'BenchRest' ? pose : restPose;
    const values = new Map(bones.map((o) => [o, { p: [] as number[], q: [] as number[] }]));
    const destinationTimes = Array.from({ length: 25 }, (_, i) => i / 4);
    for (const time of destinationTimes) {
      for (const [o, p] of base) {
        o.position.copy(p.p);
        o.quaternion.copy(p.q);
        o.scale.copy(p.s);
      }
      const wave = Math.sin((time * Math.PI) / 3);
      poser.getObjectByName('Head')!.rotateY(wave * (name === 'GardenLook' ? 0.3 : 0.12));
      if (name === 'CafeBreak') {
        poser.getObjectByName('LowerArmR')!.rotateX(-0.45 - wave * 0.08);
        poser.getObjectByName('Head')!.rotateX(0.05 + wave * 0.03);
      }
      for (const bone of bones) {
        const value = values.get(bone)!;
        bone.position.toArray(value.p, value.p.length);
        bone.quaternion.toArray(value.q, value.q.length);
      }
    }
    result.push(
      new THREE.AnimationClip(
        name,
        6,
        bones.flatMap((bone) => {
          const value = values.get(bone)!;
          return [
            new THREE.VectorKeyframeTrack(`${bone.name}.position`, destinationTimes, value.p),
            new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, destinationTimes, value.q),
          ];
        }),
      ),
    );
  }
  return [...clips, ...result, rest];
}
