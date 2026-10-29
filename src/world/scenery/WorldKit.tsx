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
  | 'sample-cabinet';

/** Cache-owned geometry and materials are shared across independently placed clones. */
export function WorldKit({ module }: { module: WorldKitModule }) {
  const { scene } = useGLTF('/models/world-kit/colony-hardware.glb?v=colony-5');
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
