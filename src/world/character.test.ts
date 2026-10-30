import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AnimationMixer, Box3, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { DESK_Z } from './motion';
import { ACCESSORIES, residentStyle } from './personality';
import {
  accessoryName,
  CLIP_NAMES,
  disposeColonist,
  dressColonist,
  easeExpression,
  EXPRESSIONS,
  expressionFor,
  headMeshes,
  MATERIAL_ROLES,
  RESIDENT_HEIGHT,
  SILHOUETTES,
  silhouetteFor,
  WALK_CYCLE_SPEED,
} from './character';

const MODEL = new URL('../../public/models/resident/colonist.glb', import.meta.url);

async function load() {
  const bytes = await readFile(MODEL);
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
}

const world = (scene: Awaited<ReturnType<typeof load>>['scene'], bone: string) =>
  scene.getObjectByName(bone)!.getWorldPosition(new Vector3());

function play(
  gltf: Awaited<ReturnType<typeof load>>,
  mixer: AnimationMixer,
  name: string,
  t: number,
) {
  mixer.stopAllAction();
  const clip = gltf.animations.find((c) => c.name === name)!;
  mixer.clipAction(clip).play();
  mixer.setTime(t);
  gltf.scene.updateMatrixWorld(true);
  return clip;
}

describe('colonist asset contract', () => {
  it('ships every clip, expression, silhouette, accessory and material the renderer expects', async () => {
    const gltf = await load();
    expect((await stat(MODEL)).size).toBeLessThan(1.6 * 1024 * 1024);
    for (const name of CLIP_NAMES) expect(gltf.animations.map((c) => c.name)).toContain(name);
    const faces = headMeshes(gltf.scene);
    expect(faces.length).toBeGreaterThan(0);
    for (const mesh of faces)
      for (const name of [...EXPRESSIONS, 'TallCranium', 'WideHead'])
        expect(mesh.morphTargetDictionary, name).toHaveProperty(name);
    const torsoKeys = new Set<string>();
    gltf.scene.traverse((o) => {
      if (o instanceof Mesh && o.morphTargetDictionary)
        Object.keys(o.morphTargetDictionary).forEach((k) => torsoKeys.add(k));
    });
    for (const name of SILHOUETTES) expect(torsoKeys.has(name), name).toBe(true);
    for (const accessory of ACCESSORIES)
      expect(gltf.scene.getObjectByName(accessoryName(accessory)), accessory).toBeDefined();
    const materials = new Set<string>();
    gltf.scene.traverse((o) => {
      if (o instanceof Mesh) materials.add((o.material as MeshStandardMaterial).name);
    });
    for (const name of materials) expect(MATERIAL_ROLES, name).toHaveProperty(name);
    // Human scale against 2.1 m doorways and the 1.02 m desks.
    const standing = new Box3().setFromObject(gltf.scene);
    expect(standing.min.y).toBeGreaterThan(-0.02);
    expect(world(gltf.scene, 'Head').y + 0.28).toBeCloseTo(RESIDENT_HEIGHT, 1);
  });

  it('loops every clip and types with both hands over the laptop keys', async () => {
    const gltf = await load();
    const mixer = new AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) {
      for (const track of clip.tracks) {
        const size = track.getValueSize();
        for (let i = 0; i < size; i++)
          expect(track.values[i], `${clip.name} ${track.name}`).toBeCloseTo(
            track.values[track.values.length - size + i],
            3,
          );
      }
    }
    // Laptop keys sit at 1.05 m over the seat, 0.24..0.40 m in front of the root.
    for (const name of ['DeskType', 'DeskReview', 'DeskError'] as const) {
      for (const t of [0, 0.7, 1.5, 2.9, 3.6]) {
        play(gltf, mixer, name, t);
        for (const side of ['L', 'R'] as const) {
          const wrist = world(gltf.scene, `Hand${side}`);
          const forward = new Vector3(0, 1, 0).applyQuaternion(
            gltf.scene.getObjectByName(`Hand${side}`)!.getWorldQuaternion(new Quaternion()),
          );
          const tip = wrist.clone().addScaledVector(forward, 0.14);
          expect(Math.abs(wrist.x - (side === 'L' ? 0.18 : -0.18)), `${name} ${side}`).toBeLessThan(
            0.05,
          );
          expect(wrist.y, `${name} ${side}`).toBeGreaterThan(1.05);
          expect(wrist.y, `${name} ${side}`).toBeLessThan(1.16);
          expect(tip.z, `${name} ${side}`).toBeGreaterThan(0.24);
          expect(tip.z, `${name} ${side}`).toBeLessThan(0.42);
          expect(tip.y, `${name} ${side}`).toBeLessThan(wrist.y);
        }
        // Seated on the chair cushion behind the root, feet under the desk.
        const hips = world(gltf.scene, 'Hips');
        expect(hips.y).toBeCloseTo(0.62, 1);
        expect(hips.z + DESK_Z).toBeLessThan(-0.6);
        for (const foot of ['FootL', 'FootR']) expect(world(gltf.scene, foot).y).toBeLessThan(0.12);
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
  });

  it('keeps standing and bench loops anchored while the head and arms move', async () => {
    const gltf = await load();
    const mixer = new AnimationMixer(gltf.scene);
    for (const name of [
      'Rest',
      'BenchRest',
      'CafeBreak',
      'GardenLook',
      'SurveySky',
      'SampleScan',
    ]) {
      const clip = play(gltf, mixer, name, 0);
      const anchored = ['FootL', 'FootR', 'Hips'].map((bone) => world(gltf.scene, bone));
      const headAtStart = gltf.scene.getObjectByName('Head')!.getWorldQuaternion(new Quaternion());
      let headMoved = 0;
      for (const time of [
        clip.duration / 8,
        clip.duration / 4,
        clip.duration / 2,
        (clip.duration * 3) / 4,
      ]) {
        play(gltf, mixer, name, time);
        for (const [index, bone] of ['FootL', 'FootR', 'Hips'].entries())
          expect(
            world(gltf.scene, bone).distanceTo(anchored[index]),
            `${name} ${bone}`,
          ).toBeLessThan(0.002);
        headMoved = Math.max(
          headMoved,
          gltf.scene
            .getObjectByName('Head')!
            .getWorldQuaternion(new Quaternion())
            .angleTo(headAtStart),
        );
      }
      expect(headMoved, name).toBeGreaterThan(0.05);
    }
    // Bench rest sits at the comms bench height, hands on the thighs.
    play(gltf, mixer, 'BenchRest', 1);
    expect(world(gltf.scene, 'Hips').y).toBeCloseTo(0.69, 1);
    expect(world(gltf.scene, 'HandL').y).toBeLessThan(0.9);
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
  });

  it('walks with planted feet that cover the authored stride', async () => {
    const gltf = await load();
    const mixer = new AnimationMixer(gltf.scene);
    const clip = gltf.animations.find((c) => c.name === 'Walking')!;
    const samples = Array.from({ length: 13 }, (_, i) => (i / 12) * clip.duration);
    let maxZ = -Infinity;
    let minZ = Infinity;
    for (const time of samples) {
      play(gltf, mixer, 'Walking', time);
      const foot = world(gltf.scene, 'FootL');
      maxZ = Math.max(maxZ, foot.z);
      minZ = Math.min(minZ, foot.z);
      expect(foot.y).toBeGreaterThan(0.08);
      expect(world(gltf.scene, 'Hips').z).toBeCloseTo(0, 1);
    }
    expect(maxZ - minZ).toBeCloseTo((WALK_CYCLE_SPEED * clip.duration) / 2, 1);
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
  });

  it('dresses eight distinct residents from one asset and frees only what it made', async () => {
    const gltf = await load();
    const shared = new Set<MeshStandardMaterial>();
    gltf.scene.traverse((o) => {
      if (o instanceof Mesh) shared.add(o.material as MeshStandardMaterial);
    });
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const style = residentStyle(`demo-${i}`);
      const model = clone(gltf.scene);
      const materials = dressColonist(model, { color: '#4466aa', style });
      expect(materials.every((m) => !shared.has(m))).toBe(true);
      const suit = materials.find((m) => m.userData.role === 'suit')!;
      expect(`#${suit.color.getHexString()}`).toBe('#4466aa');
      expect(`#${materials.find((m) => m.userData.role === 'skin')!.color.getHexString()}`).toBe(
        style.skin,
      );
      const visible: string[] = [];
      model.traverse((o) => {
        if (o.name.startsWith('accessory-') && o.visible) visible.push(o.name);
      });
      expect(visible).toEqual([accessoryName(style.accessory)]);
      seen.add(`${style.accessory}:${style.build}:${style.skin}`);
      const faces = headMeshes(model);
      easeExpression(faces, expressionFor('working'), 1);
      expect(faces[0].morphTargetInfluences![faces[0].morphTargetDictionary!.Focused]).toBe(1);
      easeExpression(faces, expressionFor('idle'), 0.5);
      expect(faces[0].morphTargetInfluences![faces[0].morphTargetDictionary!.Focused]).toBeCloseTo(
        0.5,
      );
      disposeColonist(model, materials);
    }
    expect(seen.size).toBe(8);
    for (const material of shared) expect(material.userData.role).toBeUndefined();
  });
});

describe('expression and silhouette rules', () => {
  it('maps resident state to one dominant expression', () => {
    expect(expressionFor('working')).toEqual({ Focused: 1, Confused: 0, Happy: 0 });
    expect(expressionFor('failed').Confused).toBe(1);
    expect(expressionFor('waiting').Confused).toBeGreaterThan(0.5);
    expect(expressionFor('completed', true).Happy).toBe(1);
    expect(expressionFor('completed', false).Happy).toBeLessThan(1);
    expect(expressionFor('idle')).toEqual({ Focused: 0, Confused: 0, Happy: 0 });
    expect(expressionFor(undefined)).toEqual({ Focused: 0, Confused: 0, Happy: 0 });
  });
  it('varies head shape and build without touching limb lengths', () => {
    expect(silhouetteFor('tall-broad')).toEqual({
      TallCranium: 1,
      WideHead: 0,
      Broad: 1,
      Slender: 0,
    });
    expect(silhouetteFor('wide-lean')).toEqual({
      TallCranium: 0,
      WideHead: 1,
      Broad: 0,
      Slender: 1,
    });
    expect(silhouetteFor('plain')).toEqual({ TallCranium: 0, WideHead: 0, Broad: 0, Slender: 0 });
    const builds = new Set(Array.from({ length: 8 }, (_, i) => residentStyle(`demo-${i}`).build));
    expect(builds.size).toBe(8);
  });
});
