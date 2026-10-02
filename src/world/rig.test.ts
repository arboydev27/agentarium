import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, Vector3 } from 'three';
import { createCharacterClips, ROBOT_SCALE } from './rig';
import { DESK_Z, SIT_LIFT } from './motion';

describe('bundled character asset contract', () => {
  it('authors loopable desk poses with both hands reaching the keyboard', async () => {
    const bytes = await readFile(new URL('../../public/models/robot.glb', import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const clips = createCharacterClips(gltf.scene, gltf.animations);
    const mixer = new AnimationMixer(gltf.scene);
    for (const name of [
      'Walking',
      'Rest',
      'ThumbsUp',
      'DeskType',
      'DeskReview',
      'DeskWait',
      'DeskError',
      'BenchRest',
      'CafeBreak',
      'GardenLook',
    ])
      expect(clips.some((c) => c.name === name)).toBe(true);
    for (const name of ['DeskType', 'DeskReview', 'DeskError']) {
      const clip = clips.find((c) => c.name === name)!;
      for (const t of [0, 0.5, 1, 2, 3.5]) {
        mixer.stopAllAction();
        mixer.clipAction(clip).play();
        mixer.setTime(t);
        gltf.scene.updateMatrixWorld(true);
        for (const side of ['L', 'R']) {
          const palm = gltf.scene
            .getObjectByName(`Palm1${side}`)!
            .getWorldPosition(new Vector3())
            .multiplyScalar(ROBOT_SCALE);
          palm.y += SIT_LIFT;
          palm.z += DESK_Z;
          expect(Math.abs(palm.x - (side === 'L' ? 0.18 : -0.18))).toBeLessThan(0.055);
          expect(Math.abs(palm.y - 1.08)).toBeLessThan(0.055);
          expect(Math.abs(palm.z + 0.1)).toBeLessThan(0.055);
        }
      }
      for (const track of clip.tracks) {
        const size = track.getValueSize();
        for (let i = 0; i < size; i++)
          expect(track.values[i]).toBeCloseTo(track.values[track.values.length - size + i], 4);
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
  });

  it('keeps destination gestures loopable and anchored to their floor or bench', async () => {
    const bytes = await readFile(new URL('../../public/models/robot.glb', import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const clips = createCharacterClips(gltf.scene, gltf.animations);
    const mixer = new AnimationMixer(gltf.scene);
    for (const name of ['Rest', 'BenchRest', 'CafeBreak', 'GardenLook']) {
      const clip = clips.find((candidate) => candidate.name === name)!;
      for (const track of clip.tracks) {
        const size = track.getValueSize();
        for (let i = 0; i < size; i++)
          expect(track.values[i]).toBeCloseTo(track.values[track.values.length - size + i], 4);
      }
      mixer.stopAllAction();
      mixer.clipAction(clip).play();
      mixer.setTime(0);
      gltf.scene.updateMatrixWorld(true);
      const anchored = ['FootL', 'FootR', 'Hips'].map((bone) =>
        gltf.scene.getObjectByName(bone)!.getWorldPosition(new Vector3()),
      );
      const head = gltf.scene.getObjectByName('Head')!;
      const headAtStart = head.quaternion.clone();
      const torso = gltf.scene.getObjectByName('Torso_1')!;
      const torsoAtStart = torso.quaternion.clone();
      const gestureBone = gltf.scene.getObjectByName(
        name === 'CafeBreak' ? 'LowerArmR' : name === 'BenchRest' ? 'LowerArmL' : 'UpperArmL',
      )!;
      const armAtStart = gestureBone.quaternion.clone();
      mixer.setTime(clip.duration / 4);
      gltf.scene.updateMatrixWorld(true);
      expect(head.quaternion.angleTo(headAtStart)).toBeGreaterThan(0.1);
      mixer.setTime(name === 'Rest' ? clip.duration / 16 : clip.duration / 8);
      expect(torso.quaternion.angleTo(torsoAtStart)).toBeGreaterThan(0.01);
      mixer.setTime(name === 'Rest' ? clip.duration / 4 : clip.duration / 2);
      expect(gestureBone.quaternion.angleTo(armAtStart)).toBeGreaterThan(0.05);
      for (const time of [clip.duration / 8, clip.duration / 2, (clip.duration * 3) / 4]) {
        mixer.setTime(time);
        gltf.scene.updateMatrixWorld(true);
        for (const [index, bone] of ['FootL', 'FootR', 'Hips'].entries()) {
          const position = gltf.scene.getObjectByName(bone)!.getWorldPosition(new Vector3());
          expect(position.distanceTo(anchored[index])).toBeLessThan(0.001);
        }
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
  });
});
