import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../state';
import { ambientStep, leafPose } from './ambient';

export function Breeze({ children, phase = 0 }: { children: ReactNode; phase?: number }) {
  const ref = useRef<THREE.Group>(null);
  const time = useRef(0);
  const reduced = useWorld((s) => s.reducedMotion);
  const low = useWorld((s) => s.quality === 'low');
  useFrame((_, delta) => {
    if (!ref.current) return;
    time.current += ambientStep(delta, reduced, low);
    ref.current.rotation.z = reduced || low ? 0 : Math.sin(time.current * 0.65 + phase) * 0.009;
    ref.current.rotation.x = reduced || low ? 0 : Math.sin(time.current * 0.43 + phase) * 0.004;
  });
  return <group ref={ref}>{children}</group>;
}

export function DriftingLeaves() {
  const reduced = useWorld((s) => s.reducedMotion);
  const low = useWorld((s) => s.quality === 'low');
  const ref = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!ref.current || reduced || low) return;
    time.current += ambientStep(delta, false, false);
    for (let i = 0; i < 12; i++) {
      const p = leafPose(time.current, i);
      scratch.position.set(p.x, p.y, p.z);
      scratch.rotation.set(p.angle * 0.7, p.angle, p.angle * 0.3);
      scratch.scale.set(p.scale, p.scale * 0.45, p.scale);
      scratch.updateMatrix();
      ref.current.setMatrixAt(i, scratch.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  if (reduced || low) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 12]} frustumCulled={false}>
      <sphereGeometry args={[1, 5, 3]} />
      <meshStandardMaterial color="#beac68" roughness={0.95} />
    </instancedMesh>
  );
}

export function BasinWater() {
  const rings = useRef<THREE.Group>(null);
  const time = useRef(0);
  const reduced = useWorld((s) => s.reducedMotion);
  const low = useWorld((s) => s.quality === 'low');
  useFrame((_, delta) => {
    if (!rings.current || reduced || low) return;
    time.current += ambientStep(delta, false, false);
    rings.current.children.forEach((child, i) => {
      const phase = (time.current * 0.25 + i / 3) % 1;
      child.scale.setScalar(0.2 + phase * 0.5);
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
        Math.sin(phase * Math.PI) * 0.3;
    });
  });
  return (
    <group position={[-2.2, 0.85, 8]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.75, 40]} />
        <meshStandardMaterial color="#7ca5a0" roughness={0.25} metalness={0.15} />
      </mesh>
      {!reduced && !low && (
        <group ref={rings} position={[0, 0.008, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.97, 1, 40]} />
              <meshBasicMaterial color="#d2e4cb" transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

// A small local halo, not a full-screen bloom pass or another light/shadow source.
export function WarmGlow({
  position,
  size = 0.7,
}: {
  position: [number, number, number];
  size?: number;
}) {
  const night = useWorld((s) => s.night);
  const low = useWorld((s) => s.quality === 'low');
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,224,155,0.65)');
    gradient.addColorStop(0.25, 'rgba(255,204,130,0.18)');
    gradient.addColorStop(1, 'rgba(255,204,130,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return night && !low ? (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        toneMapped={false}
        opacity={0.65}
      />
    </sprite>
  ) : null;
}
