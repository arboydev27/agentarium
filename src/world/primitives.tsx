import { useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useWorld } from '../state';
export function Box({
  pos = [0, 0, 0],
  size = [1, 1, 1],
  color = '#ffffff',
  radius = 0.04,
  map,
  rotation = [0, 0, 0],
  ...props
}: {
  pos?: [number, number, number];
  size?: [number, number, number];
  color?: string;
  radius?: number;
  map?: THREE.Texture;
  rotation?: [number, number, number];
  [key: string]: unknown;
}) {
  if (radius === 0)
    return (
      <mesh position={pos} rotation={rotation} castShadow receiveShadow {...props}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} map={map} roughness={0.78} />
      </mesh>
    );
  return (
    <RoundedBox
      args={size}
      radius={radius}
      smoothness={2}
      position={pos}
      rotation={rotation}
      castShadow
      receiveShadow
      {...props}
    >
      <meshStandardMaterial color={color} map={map} roughness={0.78} />
    </RoundedBox>
  );
}
export function Cylinder({
  pos = [0, 0, 0],
  r = 0.1,
  top,
  h = 1,
  color = '#624c39',
  rotation = [0, 0, 0],
}: {
  pos?: [number, number, number];
  r?: number;
  top?: number;
  h?: number;
  color?: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={pos} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[top ?? r, r, h, 12]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}
export function Sphere({
  pos,
  scale,
  color,
}: {
  pos: [number, number, number];
  scale: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={pos} scale={scale} castShadow receiveShadow>
      <sphereGeometry args={[1, 12, 10]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}
export function Sign({
  text,
  pos,
  size = [2, 0.7],
  color = '#e8efd2',
  background = '#244b3b',
}: {
  text: string;
  pos: [number, number, number];
  size?: [number, number];
  color?: string;
  background?: string;
}) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 192;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 768, 192);
    ctx.fillStyle = color;
    ctx.font = '500 70px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 384, 96);
    return new THREE.CanvasTexture(c);
  }, [text, color, background]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={pos}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={tex} roughness={0.8} />
    </mesh>
  );
}
export function Tree({
  position,
  scale = 1,
  variant = 0,
}: {
  position: [number, number, number];
  scale?: number;
  variant?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <Cylinder pos={[0, 1.5, 0]} r={0.17} top={0.11} h={3} color="#705340" />
      <Cylinder pos={[0.36, 2.4, 0]} r={0.09} h={1.4} rotation={[0, 0, -0.55]} />
      {[
        [0, 3, 0],
        [0.7, 3.3, 0.1],
        [-0.65, 3.5, 0.2],
        [0.12, 4, 0.1],
        [0.05, 3.2, -0.65],
      ].map((p, i) => (
        <Sphere
          key={i}
          pos={p as [number, number, number]}
          scale={[0.92, 0.87, 0.85]}
          color={
            (variant ? ['#8b9e63', '#adba78', '#839759'] : ['#5a8656', '#709860', '#86a568'])[i % 3]
          }
        />
      ))}
      <Cylinder pos={[0, 0.05, 0]} r={0.65} h={0.1} color="#739861" />
    </group>
  );
}
export function Pot({ pos, scale = 1 }: { pos: [number, number, number]; scale?: number }) {
  return (
    <group position={pos} scale={scale}>
      <Cylinder pos={[0, 0.19, 0]} r={0.19} top={0.26} h={0.38} color="#c5896a" />
      <Cylinder pos={[0, 0.39, 0]} r={0.25} h={0.025} color="#4c4f35" />
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, i * 1.25, 0]}>
          <mesh
            position={[0.13, 0.62, 0]}
            rotation={[0, 0, -0.42]}
            scale={[0.12, 0.3, 0.08]}
            castShadow
          >
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={i % 2 ? '#86a461' : '#4d8156'} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
export function Lamp({ pos }: { pos: [number, number, number] }) {
  const night = useWorld((s) => s.night);
  return (
    <group position={pos}>
      <Cylinder pos={[0, 1.5, 0]} r={0.055} h={3} color="#354d3d" />
      <Cylinder pos={[0, 0.08, 0]} r={0.24} h={0.16} color="#354d3d" />
      <Cylinder pos={[0, 2.92, 0]} r={0.29} top={0.18} h={0.24} color="#264737" />
      <mesh position={[0, 2.73, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial
          color="#ffedb5"
          emissive="#ffcd79"
          emissiveIntensity={night ? 3 : 1}
        />
      </mesh>
      {night && <pointLight position={[0, 2.6, 0]} intensity={6} distance={6} color="#ffd291" />}
    </group>
  );
}
