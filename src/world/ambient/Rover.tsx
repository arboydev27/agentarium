import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { ambientStep } from '../ambient';
import { roverDustPuff, roverLoopPose, type RoverLoop } from '../ambientLife';
import { WorldKit } from '../scenery/WorldKit';
import { renderedTerrainHeight } from '../terrain';

// A kit rover driving one of the world-space loops, terrain-following, with a
// dust puff behind it. Reduced motion parks it at the loop start with no dust;
// low quality draws no dust either. Decorative: nothing here reads agent state.

let puffTexture: THREE.CanvasTexture | null = null;
function dustTexture() {
  if (puffTexture) return puffTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    2,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  puffTexture = new THREE.CanvasTexture(canvas);
  puffTexture.colorSpace = THREE.SRGBColorSpace;
  return puffTexture;
}

/** The puff trailing a rover; `time` is the rover's own clock so parking freezes it. */
export function RoverDust({ time }: { time: RefObject<number> }) {
  const reduced = useWorld((s) => s.reducedMotion);
  const sprite = useRef<THREE.Sprite>(null);
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: dustTexture(),
        color: '#c98d62',
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const puff = roverDustPuff(time.current ?? 0, reduced);
    if (!sprite.current) return;
    sprite.current.visible = puff.opacity > 0.01;
    sprite.current.scale.setScalar(puff.scale);
    material.opacity = puff.opacity;
  });
  // The kit rover faces +Z, so its dust hangs behind it on -Z.
  return <sprite ref={sprite} material={material} position={[0, 0.45, -1.5]} visible={false} />;
}

export function AmbientRover({ loop, phase = 0 }: { loop: RoverLoop; phase?: number }) {
  const group = useRef<THREE.Group>(null);
  const time = useRef(0);
  const reduced = useWorld((s) => s.reducedMotion);
  const low = useWorld((s) => s.quality === 'low');
  useFrame((_, delta) => {
    time.current += ambientStep(delta, reduced, false);
    const pose = roverLoopPose(loop, time.current, phase);
    const rover = group.current;
    if (!rover) return;
    rover.position.set(pose.x, renderedTerrainHeight(pose.x, pose.z), pose.z);
    rover.rotation.y = pose.heading;
  });
  return (
    <group ref={group} name={`rover-${loop.id}`}>
      <WorldKit module="survey-rover" />
      {!low && <RoverDust time={time} />}
    </group>
  );
}
