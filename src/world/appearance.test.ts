import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AnimationMixer, Vector3 } from 'three';
import { dressResident } from './appearance';
import { residentStyle } from './personality';

it('attaches eight distinct accessories to the animated head and cleans up only owned geometry', async () => {
  const bytes = await readFile(new URL('../../public/models/robot.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  for (let i = 0; i < 8; i++) {
    const model = clone(gltf.scene),
      style = residentStyle(`demo-${i}`);
    const wardrobe = dressResident(model, style),
      head = model.getObjectByName('Head')!;
    const accessory = model.getObjectByName(`accessory-${style.accessory}`)!;
    expect(accessory.parent).toBe(head);
    expect(accessory.children.length).toBeGreaterThan(0);
    const local = accessory.position.clone();
    const mixer = new AnimationMixer(model);
    mixer.clipAction(gltf.animations.find((c) => c.name === 'Walking')!).play();
    mixer.update(0.5);
    model.updateMatrixWorld(true);
    expect(accessory.position).toEqual(local);
    expect(
      accessory.getWorldPosition(new Vector3()).distanceTo(head.getWorldPosition(new Vector3())),
    ).toBeLessThan(6);
    wardrobe.dispose();
    expect(model.getObjectByName(accessory.name)).toBeUndefined();
    expect(gltf.scene.getObjectByName(`accessory-${style.accessory}`)).toBeUndefined();
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  }
});
