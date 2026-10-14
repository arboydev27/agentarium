import { Html } from '@react-three/drei/web/Html.js';
import * as THREE from 'three';
import type { ScenicRegionId } from '../scenicVisibility';
import { renderedTerrainHeight } from '../terrain';
import { SCENIC_FALLBACK_PLANS, type FallbackShape, type FallbackTone } from './scenicFallbackPlan';

// A bounded, shared asset set: subtree disposal is disabled so changing or
// remounting a fallback never disposes geometry/material used by its neighbors.
const geometry: Record<FallbackShape, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 6),
};
const tones: Record<FallbackTone, string> = {
  wood: '#82674c',
  green: '#586d58',
  stone: '#85999c',
  amber: '#bf9b61',
  brass: '#b8895b',
  clay: '#b56f50',
};
const materials = Object.fromEntries(
  Object.entries(tones).map(([tone, color]) => [
    tone,
    new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
  ]),
) as Record<FallbackTone, THREE.MeshStandardMaterial>;
// These decoration-only forms must never intercept resident picking.
const ignoreRaycast: THREE.Object3D['raycast'] = () => {};

export type ScenicFallbackProps = {
  id: ScenicRegionId;
  state: 'loading' | 'failed';
  onRetry?: () => void;
};

export function ScenicFallback({ id, state, onRetry }: ScenicFallbackProps) {
  const plan = SCENIC_FALLBACK_PLANS[id];
  const [x, z] = plan.origin;
  return (
    <group
      name={`scenic-fallback-${id}`}
      position={[x, renderedTerrainHeight(x, z), z]}
      rotation={[0, plan.heading, 0]}
      dispose={null}
    >
      {plan.parts.map((part, index) => (
        <mesh
          key={index}
          geometry={geometry[part.shape]}
          material={materials[part.tone]}
          position={part.position}
          scale={part.scale}
          rotation={part.rotation}
          raycast={ignoreRaycast}
        />
      ))}
      {state === 'failed' && onRetry ? (
        <Html
          position={plan.retry}
          center
          occlude
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <button
            type="button"
            aria-label={`Retry ${plan.label} scenery`}
            title={`${plan.label} scenery could not load`}
            onClick={(event) => {
              event.stopPropagation();
              onRetry();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              pointerEvents: 'auto',
              minHeight: 32,
              padding: '6px 10px',
              border: '1px solid #877d68',
              borderRadius: 6,
              background: '#ebe5d7',
              color: '#343d36',
              font: 'inherit',
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Retry {plan.label} scenery
          </button>
        </Html>
      ) : null}
    </group>
  );
}
