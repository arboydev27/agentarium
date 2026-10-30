import * as THREE from 'three';
import type { Status } from '../state';
import { ACCESSORIES, type residentStyle } from './personality';

// The colonist: one rigged alien body (assets/blender/build_resident.py) with
// named clips, expression and silhouette morphs, and eight head accessories.
// This module owns the asset contract the renderer relies on.

export const RESIDENT_MODEL_URL = '/models/resident/colonist.glb?v=colonist-1';
/** Metres the authored walk cycle covers per second of clip time. */
export const WALK_CYCLE_SPEED = 1.2;
/** Standing height of the body without accessories. */
export const RESIDENT_HEIGHT = 1.79;

export const CLIP_NAMES = [
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
  'SurveySky',
  'SampleScan',
] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

export const EXPRESSIONS = ['Focused', 'Confused', 'Happy'] as const;
export type Expression = (typeof EXPRESSIONS)[number];
export type ExpressionWeights = Record<Expression, number>;

export const SILHOUETTES = ['TallCranium', 'WideHead', 'Broad', 'Slender'] as const;
export type Silhouette = (typeof SILHOUETTES)[number];

/** Material names in the GLB and which resident colour each takes. */
export const MATERIAL_ROLES = {
  'colonist suit': 'suit',
  'colonist trim': 'trim',
  'colonist skin': 'skin',
  'colonist accent': 'accent',
  'colonist eye': 'fixed',
  'colonist boot': 'fixed',
  'colonist dark': 'fixed',
} as const;

/** Where each resident state puts the face. Neutral is all zeros. */
export function expressionFor(status: Status | undefined, celebrating = false): ExpressionWeights {
  const weights: ExpressionWeights = { Focused: 0, Confused: 0, Happy: 0 };
  switch (status) {
    case 'working':
      weights.Focused = 1;
      break;
    case 'tool':
      weights.Focused = 0.65;
      break;
    case 'waiting':
      weights.Confused = 0.85;
      break;
    case 'failed':
      weights.Confused = 1;
      break;
    case 'completed':
      weights.Happy = celebrating ? 1 : 0.45;
      break;
    default:
      break;
  }
  return weights;
}

export function silhouetteFor(build: ReturnType<typeof residentStyle>['build']) {
  const weights: Record<Silhouette, number> = { TallCranium: 0, WideHead: 0, Broad: 0, Slender: 0 };
  if (build.startsWith('tall')) weights.TallCranium = 1;
  if (build.startsWith('wide')) weights.WideHead = 1;
  if (build.endsWith('broad')) weights.Broad = 1;
  if (build.endsWith('lean')) weights.Slender = 1;
  return weights;
}

export function accessoryName(name: (typeof ACCESSORIES)[number]) {
  return `accessory-${name}`;
}

/** Head meshes carry the expression morphs; the GLTF loader splits them per material. */
export function headMeshes(model: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh && o.morphTargetDictionary && 'Focused' in o.morphTargetDictionary)
      meshes.push(o);
  });
  return meshes;
}

function setMorph(model: THREE.Object3D, name: string, value: number) {
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.morphTargetDictionary || !o.morphTargetInfluences) return;
    const index = o.morphTargetDictionary[name];
    if (index !== undefined) o.morphTargetInfluences[index] = value;
  });
}

export type ResidentLook = {
  color: string;
  style: ReturnType<typeof residentStyle>;
};

/**
 * Give a cloned model its resident's colours, accessory and silhouette. Materials
 * are cloned so each resident fades independently of the shared GLTF cache; the
 * caller owns the returned materials.
 */
export function dressColonist(model: THREE.Object3D, look: ResidentLook) {
  const materials: THREE.MeshStandardMaterial[] = [];
  const byName = new Map<string, THREE.MeshStandardMaterial>();
  const colour = (role: (typeof MATERIAL_ROLES)[keyof typeof MATERIAL_ROLES]) =>
    role === 'suit'
      ? look.color
      : role === 'trim'
        ? look.style.trim
        : role === 'skin'
          ? look.style.skin
          : role === 'accent'
            ? look.style.accent
            : null;
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    const source = o.material as THREE.MeshStandardMaterial;
    let mat = byName.get(source.name);
    if (!mat) {
      mat = source.clone();
      const role = MATERIAL_ROLES[source.name as keyof typeof MATERIAL_ROLES] ?? 'fixed';
      const tint = colour(role);
      if (tint) mat.color.set(tint);
      mat.userData.role = role;
      mat.transparent = true;
      byName.set(source.name, mat);
      materials.push(mat);
    }
    o.material = mat;
  });
  const wanted = accessoryName(look.style.accessory);
  model.traverse((o) => {
    if (o.name.startsWith('accessory-')) o.visible = o.name === wanted;
  });
  for (const [name, value] of Object.entries(silhouetteFor(look.style.build)))
    setMorph(model, name, value);
  return materials;
}

/** Ease the face toward `target`; `k` is the per-frame blend (1 snaps). */
export function easeExpression(meshes: THREE.Mesh[], target: ExpressionWeights, k: number) {
  for (const mesh of meshes) {
    const influences = mesh.morphTargetInfluences;
    const dictionary = mesh.morphTargetDictionary;
    if (!influences || !dictionary) continue;
    for (const name of EXPRESSIONS) {
      const index = dictionary[name];
      if (index === undefined) continue;
      influences[index] += (target[name] - influences[index]) * k;
    }
  }
}

/** Free the per-resident GPU state created by dressing a clone. */
export function disposeColonist(model: THREE.Object3D, materials: THREE.Material[]) {
  materials.forEach((m) => m.dispose());
  const skeletons = new Set<THREE.Skeleton>();
  model.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton);
  });
  skeletons.forEach((skeleton) => skeleton.dispose());
}
