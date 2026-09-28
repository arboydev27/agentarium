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
});
