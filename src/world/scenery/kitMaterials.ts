import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { applySurfaceDetails } from '../WorldSurfaceMaterial';
import { useSurfaceTextures, type SurfaceFamily } from '../surfaceTextures';
import { WORLD_KIT_URL } from './WorldKit';

/**
 * The kit ships without embedded images. Its three textured families take
 * the same surface maps the primitives use, projected triplanarly in module
 * space, so one texture set serves every module and every clone. Base colours
 * mirror the Blender authoring values (linear).
 */
export const KIT_SURFACES: Record<
  'cast-foundation' | 'ceramic-paint' | 'dusty-alloy',
  { family: SurfaceFamily; color: [number, number, number]; metalness: number; metres: number }
> = {
  'cast-foundation': {
    family: 'cast-foundation',
    color: [0.38, 0.34, 0.29],
    metalness: 0,
    metres: 0.45,
  },
  'ceramic-paint': {
    family: 'ceramic-paint',
    color: [0.72, 0.69, 0.59],
    metalness: 0.25,
    metres: 1.6,
  },
  'dusty-alloy': { family: 'dusty-alloy', color: [0.24, 0.28, 0.3], metalness: 0.75, metres: 1.2 },
};

export function kitSurfaceOf(material: THREE.Material) {
  for (const key of Object.keys(KIT_SURFACES) as (keyof typeof KIT_SURFACES)[])
    if (material.name.startsWith(key)) return KIT_SURFACES[key];
  return null;
}

export type KitMaps = Record<SurfaceFamily, THREE.Texture[]>;

/** Give one kit material (shared or cloned) its colour and triplanar grain. */
export function applyKitSurface(material: THREE.MeshStandardMaterial, maps: KitMaps) {
  const surface = kitSurfaceOf(material);
  if (!surface) return material;
  if (!material.userData.kitSurface) {
    material.color.setRGB(...surface.color, THREE.LinearSRGBColorSpace);
    material.metalness = surface.metalness;
    material.roughness = 1;
    material.map = null;
    material.normalMap = null;
    material.roughnessMap = null;
    material.userData.kitSurface = surface.family;
  }
  applySurfaceDetails(
    material,
    maps[surface.family],
    surface.metres,
    true,
    surface.family === 'cast-foundation',
  );
  material.needsUpdate = true;
  return material;
}

/** The shared kit scene with its materials prepared once per texture set. */
export function useKitScene() {
  const { scene } = useGLTF(WORLD_KIT_URL);
  const ceramic = useSurfaceTextures('ceramic-paint');
  const alloy = useSurfaceTextures('dusty-alloy');
  const foundation = useSurfaceTextures('cast-foundation');
  const maps = useMemo<KitMaps>(
    () => ({
      'ceramic-paint': ceramic,
      'dusty-alloy': alloy,
      'cast-foundation': foundation,
      ironstone: [],
      regolith: [],
    }),
    [ceramic, alloy, foundation],
  );
  useMemo(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials)
        if (material instanceof THREE.MeshStandardMaterial) applyKitSurface(material, maps);
    });
  }, [scene, maps]);
  return { scene, maps };
}
