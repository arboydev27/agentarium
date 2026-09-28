import { Suspense, useEffect, useMemo, useRef, memo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, useGLTF, useAnimations, Line } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { ComponentRef } from 'react';
type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;
import { useWorld } from './state';
import type { Agent } from './state';
export const SEATS: [number, number, number][] = [
  [-5.4, 0.64, -1.8],
  [-2.2, 0.64, -1.8],
  [3.2, 0.42, 2.8],
  [6.1, 0.42, 2.8],
  [2.5, 1.05, -3.5],
  [5.5, 1.05, -3.5],
  [-5, 0.42, 3.3],
  [-2, 0.42, 3.3],
];
const statusColors = {
  idle: '#98aaa0',
  working: '#73ad69',
  tool: '#75a6c4',
  waiting: '#e9ae54',
  completed: '#82b76a',
  failed: '#d66c65',
  disconnected: '#9f9ca7',
  unknown: '#8a9784',
};
function Box({
  pos = [0, 0, 0],
  size = [1, 1, 1],
  color = '#ffffff',
  radius = 0.04,
  rotation = [0, 0, 0],
  ...props
}: {
  pos?: [number, number, number];
  size?: [number, number, number];
  color?: string;
  radius?: number;
  rotation?: [number, number, number];
  [key: string]: unknown;
}) {
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
      <meshStandardMaterial color={color} roughness={0.78} />
    </RoundedBox>
  );
}
function Cylinder({
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
function Sphere({
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
function Sign({
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
function Tree({
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
function Pot({ pos, scale = 1 }: { pos: [number, number, number]; scale?: number }) {
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
function Lamp({ pos }: { pos: [number, number, number] }) {
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
function Laptop({ active }: { active: boolean }) {
  const lid = useRef<THREE.Group>(null);
  const reduce = useWorld((s) => s.reducedMotion);
  useFrame((_, d) => {
    if (lid.current)
      lid.current.rotation.x = THREE.MathUtils.damp(
        lid.current.rotation.x,
        active ? -0.16 : -1.48,
        reduce ? 100 : 5,
        d,
      );
  });
  return (
    <group position={[0, 1.02, 0.17]}>
      <Box size={[0.73, 0.035, 0.5]} color="#475854" radius={0.02} />
      <Box pos={[0, 0.022, -0.02]} size={[0.57, 0.009, 0.25]} color="#2d3d37" radius={0.01} />
      {[0, 1, 2, 3].map((i) => (
        <Box
          key={i}
          pos={[0, 0.029, -0.105 + i * 0.055]}
          size={[0.51, 0.005, 0.008]}
          color="#7b9186"
          radius={0.001}
        />
      ))}
      <group ref={lid} position={[0, 0.01, 0.24]} rotation={[-0.16, 0, 0]}>
        <Box pos={[0, 0.23, 0]} size={[0.73, 0.46, 0.035]} color="#526862" radius={0.025} />
        <mesh position={[0, 0.23, -0.022]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.64, 0.37]} />
          <meshStandardMaterial
            color={active ? '#b6e6b0' : '#334940'}
            emissive={active ? '#74c99a' : '#000000'}
            emissiveIntensity={0.25}
          />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            pos={[-0.05 + Math.sin(i) * 0.05, 0.35 - i * 0.058, -0.025]}
            size={[0.32 + (i % 2) * 0.13, 0.012, 0.002]}
            color={active ? '#416f60' : '#334940'}
            radius={0}
          />
        ))}
      </group>
    </group>
  );
}
function Desk({ seat, active }: { seat: number; active: boolean }) {
  return (
    <group position={SEATS[seat % 8]}>
      <Box pos={[0, 0.96, 0.2]} size={[1.6, 0.13, 1]} color="#c99b68" radius={0.09} />
      {[-0.63, 0.63].map((x) => (
        <group key={x}>
          <Cylinder pos={[x, 0.48, 0.52]} r={0.045} h={0.9} color="#475447" />
          <Cylinder pos={[x, 0.48, -0.13]} r={0.045} h={0.9} color="#475447" />
        </group>
      ))}
      <Laptop active={active} />
      <Cylinder pos={[0.56, 1.095, 0.11]} r={0.1} h={0.19} color="#f2e7ca" />
      <Cylinder pos={[0.56, 1.2, 0.11]} r={0.085} h={0.008} color="#694931" />
      <Pot pos={[-0.61, 1.04, 0.5]} scale={0.42} />
      <Box pos={[0, 0.5, -0.69]} size={[0.73, 0.12, 0.66]} color="#738671" radius={0.1} />
      <Box pos={[0, 0.83, -0.98]} size={[0.73, 0.55, 0.1]} color="#738671" radius={0.09} />
      {[-0.27, 0.27].map((x) => (
        <group key={x}>
          <Cylinder pos={[x, 0.24, -0.89]} r={0.035} h={0.5} />
          <Cylinder pos={[x, 0.24, -0.45]} r={0.035} h={0.5} />
        </group>
      ))}
    </group>
  );
}
const Environment = memo(function Environment() {
  return (
    <group>
      <Box pos={[0, -0.28, 0]} size={[19.5, 1.1, 14.8]} color="#668065" radius={0.7} />
      <Box pos={[0, 0.2, 0]} size={[19.5, 0.4, 14.8]} color="#9fb482" radius={0.55} />
      <Box pos={[0, 0.41, 1.1]} size={[17, 0.06, 1.55]} color="#ddd1ae" radius={0.3} />
      <Box pos={[0.1, 0.41, 0.2]} size={[1.7, 0.065, 12.7]} color="#ddd1ae" radius={0.3} />
      {Array.from({ length: 14 }, (_, i) => (
        <Box
          key={i}
          pos={[-8 + i * 1.25, 0.456, 1.1]}
          size={[0.035, 0.006, 1.3]}
          color="#bcb897"
          radius={0}
        />
      ))}
      <Box pos={[-4.2, 0.48, -3.7]} size={[7.8, 0.3, 5.9]} color="#b89772" radius={0.14} />
      {Array.from({ length: 26 }, (_, i) => (
        <Box
          key={i}
          pos={[-7.94 + i * 0.3, 0.645, -3.7]}
          size={[0.013, 0.006, 5.65]}
          color="#8f7456"
          radius={0}
        />
      ))}
      <Box pos={[-4.2, 2.48, -6.45]} size={[7.7, 3.7, 0.22]} color="#e8dec0" />
      <Box pos={[-7.97, 2.38, -4.4]} size={[0.18, 3.5, 4.25]} color="#e8dec0" />
      <Box pos={[-4.2, 1, -6.28]} size={[7.5, 0.65, 0.1]} color="#416b54" />
      {[-6.3, -3.65].map((x) => (
        <group key={x}>
          <Box pos={[x, 2.67, -6.29]} size={[2.15, 2.1, 0.12]} color="#4d7055" radius={0.02} />
          <Box pos={[x, 2.67, -6.2]} size={[1.94, 1.88, 0.06]} color="#a6c4b2" radius={0.015} />
          <Box pos={[x, 2.67, -6.14]} size={[0.07, 1.89, 0.04]} color="#e2d1ad" />
          <Box pos={[x, 2.67, -6.14]} size={[1.94, 0.07, 0.04]} color="#e2d1ad" />
        </group>
      ))}
      <Box pos={[-4.2, 4.39, -5.42]} size={[8.25, 0.27, 2.72]} color="#315f49" radius={0.12} />
      {Array.from({ length: 18 }, (_, i) => (
        <Box
          key={i}
          pos={[-8.12 + i * 0.46, 4.56, -5.42]}
          size={[0.09, 0.08, 2.64]}
          color="#46765a"
          radius={0.025}
        />
      ))}
      <Box pos={[-4.2, 4.13, -4.03]} size={[8.2, 0.55, 0.15]} color="#315f49" radius={0.03} />
      <Sign text="the little café" pos={[-4.2, 4.15, -3.944]} size={[3.25, 0.5]} />
      <Box pos={[-6.8, 1.25, -4.35]} size={[1.55, 1.2, 1.8]} color="#365944" radius={0.06} />
      <Box pos={[-6.8, 1.91, -4.35]} size={[1.65, 0.12, 1.93]} color="#d5b486" />
      <Box pos={[-6.8, 2.23, -4.67]} size={[0.9, 0.57, 0.67]} color="#e5dfc9" radius={0.08} />
      <Box pos={[-6.8, 2.19, -4.3]} size={[0.62, 0.3, 0.025]} color="#344b43" radius={0.03} />
      <Cylinder pos={[-6.8, 2.62, -4.64]} r={0.15} h={0.25} color="#655344" />
      <Box pos={[-2, 2.95, -6.2]} size={[0.8, 1.05, 0.1]} color="#bf9367" />
      <Sign
        text="slow brew"
        pos={[-2, 2.95, -6.139]}
        size={[0.72, 0.55]}
        color="#eee4bf"
        background="#577554"
      />
      <Pot pos={[-7.2, 0.65, -1.7]} scale={1.4} />
      <Box pos={[4.4, 0.7, -4]} size={[7.4, 0.67, 5.3]} color="#af9877" radius={0.2} />
      <Box pos={[4.4, 1.03, -4]} size={[7.4, 0.1, 5.3]} color="#d5bb8d" radius={0.1} />
      {Array.from({ length: 23 }, (_, i) => (
        <Box
          key={i}
          pos={[0.86 + i * 0.32, 1.09, -4]}
          size={[0.012, 0.008, 5.15]}
          color="#ab946e"
          radius={0}
        />
      ))}
      <Box pos={[4.4, 2.57, -6.53]} size={[7.4, 3, 0.2]} color="#56816b" />
      <Box pos={[7.98, 2.57, -4.1]} size={[0.17, 3, 4.9]} color="#56816b" />
      <Box pos={[4.45, 2.8, -6.4]} size={[4.1, 1.75, 0.12]} color="#f0e4c9" />
      <Box pos={[4.45, 2.8, -6.32]} size={[3.83, 1.51, 0.04]} color="#acc8ba" />
      <Box pos={[4.45, 2.8, -6.26]} size={[0.09, 1.55, 0.08]} color="#f0e4c9" />
      <Box pos={[4.5, 4.15, -5.4]} size={[7.7, 0.23, 2.8]} color="#c18c62" radius={0.1} />
      <Sign
        text="THE STUDIO"
        pos={[4.4, 3.91, -3.94]}
        size={[2.4, 0.35]}
        background="#c18c62"
        color="#fff0cc"
      />
      {[-0.6, -0.3, 0].map((z, i) => (
        <Box
          key={i}
          pos={[1.2, 0.54 + i * 0.17, -1.6 + z]}
          size={[1.4, 0.18, 0.45]}
          color="#b89b74"
        />
      ))}
      <Box pos={[6.5, 1.7, -5.85]} size={[1.25, 1.25, 0.6]} color="#d4b181" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Box
          key={i}
          pos={[6.04 + i * 0.21, 1.92, -5.49]}
          size={[0.16, 0.53 - (i % 2) * 0.1, 0.25]}
          color={['#698a77', '#c28564', '#e7cf98'][i % 3]}
        />
      ))}
      <Pot pos={[1.15, 1.1, -5.65]} scale={1.3} />
      <Box pos={[4.7, 0.47, 3.8]} size={[6.3, 0.15, 4.6]} color="#b9ae84" radius={0.2} />
      {[2, 7.6].map((x) =>
        [1.8, 5.8].map((z) => (
          <Cylinder key={x + ',' + z} pos={[x, 2.3, z]} r={0.085} h={3.7} color="#8a7651" />
        )),
      )}
      <Box pos={[4.8, 4.17, 1.8]} size={[6.1, 0.17, 0.2]} color="#a9946b" />
      <Box pos={[4.8, 4.17, 5.8]} size={[6.1, 0.17, 0.2]} color="#a9946b" />
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} pos={[2 + i * 0.7, 4.32, 3.8]} size={[0.16, 0.18, 4.4]} color="#ac976e" />
      ))}
      {[2, 7.6].map((x) => (
        <group key={x}>
          <Cylinder
            pos={[x, 4.13, 3.8]}
            r={0.015}
            h={3.8}
            rotation={[Math.PI / 2, 0, 0]}
            color="#53694c"
          />
          {[2.1, 3, 3.9, 4.8, 5.6].map((z) => (
            <mesh key={z} position={[x, 3.95, z]}>
              <sphereGeometry args={[0.065, 8, 8]} />
              <meshStandardMaterial color="#fff1bc" emissive="#ffe29a" emissiveIntensity={1.6} />
            </mesh>
          ))}
        </group>
      ))}
      <Box pos={[-3.6, 0.44, 4.2]} size={[6.2, 0.08, 3.4]} color="#b2bf8f" radius={0.5} />
      <group position={[-7.6, 0.43, 3.1]}>
        <Box pos={[0, 0.5, 0]} size={[0.8, 0.16, 2]} color="#b0845e" />
        <Box pos={[-0.3, 0.8, 0]} size={[0.12, 0.6, 2]} color="#b0845e" />
        {[-0.7, 0.7].map((z) => (
          <Box key={z} pos={[0, 0.25, z]} size={[0.6, 0.5, 0.15]} color="#506c50" />
        ))}
      </group>
      {[
        [9, 0.4, -5.5],
        [-9, 0.4, -5.1],
        [-9, 0.4, 0.2],
        [8.8, 0.4, 5.7],
        [-8.3, 0.4, 6.2],
        [0.1, 0.4, 6.3],
      ].map((p, i) => (
        <Tree
          key={i}
          position={p as [number, number, number]}
          scale={i === 5 ? 0.65 : 0.9 + (i % 2) * 0.15}
          variant={i % 2}
        />
      ))}
      {[
        [8.7, 0.4, -0.5],
        [-8.8, 0.4, -2],
        [8.8, 0.4, 2],
        [-7, 0.4, 6.4],
        [5.7, 0.4, 6.5],
        [2.9, 0.4, 6.4],
        [-3.5, 0.4, -7],
      ].map((p, i) => (
        <group position={p as [number, number, number]} key={i}>
          <Sphere
            pos={[0, 0.35, 0]}
            scale={[0.8, 0.5, 0.55]}
            color={i % 2 ? '#789857' : '#53784a'}
          />
          <Sphere pos={[0.6, 0.23, 0.1]} scale={[0.55, 0.35, 0.45]} color="#86a360" />
        </group>
      ))}
      <Lamp pos={[-0.9, 0.4, 1]} />
      <Lamp pos={[8.4, 0.4, 1]} />
      <Lamp pos={[-6.7, 0.4, 1]} />
      <Pot pos={[7.3, 0.5, 5.3]} scale={1.4} />
      <Pot pos={[2.3, 0.5, 5.3]} />
      {Array.from({ length: 10 }, (_, i) => (
        <group key={i} position={[-8.1 + i * 1.8, 0.43, 6.7]}>
          <Cylinder pos={[0, 0.12, 0]} r={0.025} h={0.24} color="#6c8e50" />
          <Sphere
            pos={[0, 0.26, 0]}
            scale={[0.1, 0.07, 0.1]}
            color={i % 2 ? '#e5be72' : '#d79483'}
          />
        </group>
      ))}
      <Sign
        text="G R O V E"
        pos={[-0.1, -0.15, 7.417]}
        size={[2.15, 0.4]}
        color="#e0e8ce"
        background="#668065"
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.87, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial transparent opacity={0.16} />
      </mesh>
    </group>
  );
});
function Resident({ agent }: { agent: Agent }) {
  const { scene, animations } = useGLTF('/models/robot.glb');
  const model = useMemo(() => {
    const copy = clone(scene);
    copy.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        const cloned = materials.map((m) => {
          const mat = m.clone() as THREE.MeshStandardMaterial;
          if (mat.name === 'Main') mat.color.set(agent.color);
          if (mat.name === 'Grey') mat.color.set('#ede9d6');
          if (mat.name === 'Black') mat.color.set('#253c36');
          mat.roughness = 0.62;
          return mat;
        });
        o.material = Array.isArray(o.material) ? cloned : cloned[0];
      }
    });
    return copy;
  }, [scene, agent.color]);
  const root = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(animations, model);
  const selected = useWorld((s) => s.selected === agent.id);
  const select = useWorld((s) => s.select);
  const labels = useWorld((s) => s.labels);
  const reduced = useWorld((s) => s.reducedMotion);
  const playing = useWorld((s) => s.playing || s.mode === 'live');
  const seat = SEATS[agent.seat % 8];
  const isSeated = ['working', 'tool', 'waiting'].includes(agent.status);
  const historicalCompletion =
    agent.evidence === 'history' &&
    agent.status === 'completed' &&
    Date.now() - (agent.observedAt || 0) > 30000;
  const animation = historicalCompletion
    ? 'Idle'
    : isSeated
      ? 'Sitting'
      : agent.status === 'completed'
        ? 'Dance'
        : agent.status === 'failed'
          ? 'No'
          : 'Idle';
  useEffect(() => {
    const action = actions[animation];
    if (!action) return;
    action
      .reset()
      .fadeIn(reduced ? 0 : 0.35)
      .play();
    if (reduced) {
      action.time = animation === 'Sitting' ? action.getClip().duration : 0;
      mixer.update(0);
    }
    if (animation === 'Sitting') {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    return () => {
      action.fadeOut(0.3);
    };
  }, [actions, animation, reduced, mixer]);
  useEffect(() => {
    mixer.timeScale = reduced ? 0 : playing ? 1 : 0;
  }, [mixer, reduced, playing]);
  useEffect(
    () => () => {
      model.traverse((o) => {
        if (o instanceof THREE.Mesh)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    },
    [model],
  );
  const armL = useMemo(() => model.getObjectByName('LowerArmL'), [model]);
  const armR = useMemo(() => model.getObjectByName('LowerArmR'), [model]);
  useFrame(({ clock }, d) => {
    if (!root.current) return;
    const targetZ = seat[2] + (isSeated ? -0.69 : -1.08);
    root.current.position.z = THREE.MathUtils.damp(root.current.position.z, targetZ, 5, d);
    root.current.rotation.y = THREE.MathUtils.damp(
      root.current.rotation.y,
      isSeated ? 0 : 0.38,
      4,
      d,
    );
    if (!reduced && playing && isSeated && agent.status !== 'waiting') {
      const t = clock.elapsedTime * 7 + agent.seat;
      if (armL) armL.rotation.x += Math.sin(t) * 0.006;
      if (armR) armR.rotation.x += Math.cos(t) * 0.006;
    }
  });
  return (
    <group
      position={[seat[0], seat[1], seat[2] - 0.69]}
      ref={root}
      onClick={(e) => {
        e.stopPropagation();
        select(agent.id);
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <primitive object={model} scale={0.37} />
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.63, 0.69, 48]} />
          <meshBasicMaterial color="#f8d888" transparent opacity={0.95} />
        </mesh>
      )}
      {(labels || selected) && (
        <WorldLabel agent={agent} selected={selected} height={isSeated ? 1.9 : 2.05} />
      )}
    </group>
  );
}
function WorldLabel({
  agent,
  selected,
  height,
}: {
  agent: Agent;
  selected: boolean;
  height: number;
}) {
  const anchor = useRef<THREE.Group>(null);
  const element = useRef<HTMLButtonElement | null>(null);
  const point = useMemo(() => new THREE.Vector3(), []);
  const { gl, camera, size } = useThree();
  useEffect(() => {
    const button = document.createElement('button');
    button.style.position = 'absolute';
    button.style.left = '0';
    button.style.top = '0';
    button.style.zIndex = '20';
    button.style.pointerEvents = 'auto';
    button.style.visibility = 'hidden';
    const click = (e: MouseEvent) => {
      e.stopPropagation();
      useWorld.getState().select(agent.id);
    };
    button.addEventListener('click', click);
    gl.domElement.parentElement?.appendChild(button);
    element.current = button;
    return () => {
      button.removeEventListener('click', click);
      button.remove();
    };
  }, [gl, agent.id]);
  useEffect(() => {
    const button = element.current;
    if (!button) return;
    button.className = 'world-label ' + (selected ? 'is-selected' : '');
    button.title = agent.name;
    button.replaceChildren();
    const dot = document.createElement('i');
    dot.style.background = statusColors[agent.status];
    button.append(dot, document.createTextNode(agent.name));
    if (agent.status === 'waiting') {
      const alert = document.createElement('span');
      alert.textContent = '!';
      button.append(alert);
    }
  }, [agent.name, agent.status, selected]);
  useFrame(() => {
    if (!anchor.current || !element.current) return;
    anchor.current.updateWorldMatrix(true, false);
    point.setFromMatrixPosition(anchor.current.matrixWorld).project(camera);
    element.current.style.visibility =
      Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1 ? 'visible' : 'hidden';
    element.current.style.transform = `translate(${((point.x + 1) * size.width) / 2}px,${((1 - point.y) * size.height) / 2}px) translate(-50%,-50%)`;
  });
  return <group ref={anchor} position={[0, height, 0]} />;
}
function Residents() {
  const agents = useWorld((s) => s.agents);
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <Desk
          key={i}
          seat={i}
          active={agents.some(
            (a) => a.seat === i && ['working', 'tool', 'waiting'].includes(a.status),
          )}
        />
      ))}
      {agents
        .filter((a) => a.seat < 8)
        .map((a) => (
          <Resident key={a.id} agent={a} />
        ))}
      {agents
        .filter((a) => a.parentId && a.seat < 8)
        .map((a) => {
          const parent = agents.find((p) => p.id === a.parentId);
          if (!parent || parent.seat >= 8) return null;
          const p = SEATS[parent.seat],
            q = SEATS[a.seat];
          return (
            <Line
              key={a.id + 'link'}
              points={[
                [p[0], p[1] + 0.12, p[2] - 0.7],
                [(p[0] + q[0]) / 2, 2.4, (p[2] + q[2]) / 2],
                [q[0], q[1] + 0.12, q[2] - 0.7],
              ]}
              color="#e3c774"
              lineWidth={1.5}
              dashed
              dashSize={0.2}
              gapSize={0.15}
              transparent
              opacity={0.7}
            />
          );
        })}
    </>
  );
}
function Camera() {
  const controls = useRef<OrbitControlsImpl>(null);
  const view = useWorld((s) => s.camera);
  const version = useWorld((s) => s.cameraVersion);
  const cinematic = useWorld((s) => s.cinematic);
  const reduced = useWorld((s) => s.reducedMotion);
  const { camera, size } = useThree();
  const moving = useRef(true);
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const zoom = useRef(30);
  useEffect(() => {
    const views = {
      overview: { pos: [18, 19, 24], look: [0, 3.1, 0], factor: 1 },
      café: { pos: [-1, 8, 11], look: [-4.5, 1.8, -3], factor: 2.3 },
      garden: { pos: [12, 10, 15], look: [4.5, 1.4, 3.3], factor: 2.3 },
      studio: { pos: [11, 9, 12], look: [4.1, 2.1, -3.4], factor: 2.3 },
    };
    targetPos.current.fromArray(views[view].pos);
    targetLook.current.fromArray(views[view].look);
    zoom.current = Math.min(size.width / 27, size.height / 23) * views[view].factor;
    moving.current = true;
  }, [view, version, size.width, size.height]);
  useFrame((_, d) => {
    if (moving.current && controls.current) {
      const alpha = reduced ? 1 : 1 - Math.exp(-4 * d);
      camera.position.lerp(targetPos.current, alpha);
      controls.current.target.lerp(targetLook.current, alpha);
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, zoom.current, alpha);
      camera.updateProjectionMatrix();
      controls.current.update();
      if (
        camera.position.distanceTo(targetPos.current) < 0.02 &&
        Math.abs(camera.zoom - zoom.current) < 0.02
      )
        moving.current = false;
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      maxPolarAngle={Math.PI / 2.12}
      minPolarAngle={0.2}
      minZoom={10}
      maxZoom={150}
      autoRotate={cinematic && !reduced}
      autoRotateSpeed={0.35}
      onStart={() => {
        moving.current = false;
        useWorld.setState({ cinematic: false });
      }}
    />
  );
}
function Lighting() {
  const night = useWorld((s) => s.night);
  return (
    <>
      <fog attach="fog" args={[night ? '#263a43' : '#d8dfd0', 45, 100]} />
      <ambientLight intensity={night ? 0.5 : 1.15} color={night ? '#a2b6ed' : '#fff8e7'} />
      <hemisphereLight args={[night ? '#849ccf' : '#e8f0e0', '#849970', night ? 0.6 : 1.4]} />
      <directionalLight
        position={[-7, 14, 8]}
        intensity={night ? 0.7 : 3.2}
        color={night ? '#b2bff0' : '#ffe6b0'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[10, 8, -8]} intensity={night ? 0.55 : 1} color="#b2d5d0" />
    </>
  );
}
export default function World() {
  const quality = useWorld((s) => s.quality);
  return (
    <Canvas
      orthographic
      shadows
      dpr={quality === 'low' ? 1 : [1, 1.6]}
      camera={{ position: [18, 19, 24], zoom: 30, near: 0.1, far: 180 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => useWorld.getState().select(null)}
    >
      <Lighting />
      <Environment />
      <Suspense fallback={null}>
        <Residents />
      </Suspense>
      <Camera />
    </Canvas>
  );
}
useGLTF.preload('/models/robot.glb');
