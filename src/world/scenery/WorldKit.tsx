import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export type WorldKitModule =
  | 'pressure-habitat'
  | 'solar-rack'
  | 'sensor-mast'
  | 'service-wall'
  | 'resource-tank'
  | 'survey-rover'
  | 'survey-rocket'
  | 'launch-gantry'
  | 'control-cabin'
  | 'communications-dish'
  | 'workstation'
  | 'telescope'
  | 'orbital-relay'
  | 'survey-console'
  | 'sample-cabinet'
  | 'hab-wall'
  | 'hab-glass'
  | 'hab-corner'
  | 'hab-airlock'
  | 'hab-gate'
  | 'hab-airlock-flush'
  | 'hab-roof'
  | 'hab-radiator'
  | 'hab-locker'
  | 'hab-crate'
  | 'hab-planter'
  | 'hab-rack'
  | 'hab-galley';

/** Cache-busting query changes whenever the kit is regenerated. */
export const WORLD_KIT_URL = '/models/world-kit/colony-hardware.glb?v=colony-6';

/** Cache-owned geometry and materials are shared across independently placed clones. */
export function WorldKit({ module }: { module: WorldKitModule }) {
  const { scene } = useGLTF(WORLD_KIT_URL);
  const model = useMemo(() => {
    const source = scene.getObjectByName(module);
    if (!source) throw new Error(`World kit is missing ${module}`);
    const clone = source.clone(true);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.raycast = () => {};
      }
    });
    return clone;
  }, [scene, module]);
  return <primitive object={model} dispose={null} />;
}
