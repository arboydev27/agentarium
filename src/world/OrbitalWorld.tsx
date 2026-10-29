import { WorldKit } from './scenery/WorldKit';
import { createPlanetTexture, type PlanetSurface } from './planetTexture';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { ComponentRef } from 'react';
import { useWorld } from '../state';
import { orbitalZoomDestination, useUniverse } from './universe';

function Planet({ radius = 3 }: { radius?: number }) {
  const texture = useMemo(() => createPlanetTexture(), []);
  const relief = useMemo(() => createPlanetTexture('colony', true), []);
  useEffect(
    () => () => {
      texture.dispose();
      relief.dispose();
    },
    [texture, relief],
  );
  return (
    <group name="colony-planet">
      <mesh onDoubleClick={() => useUniverse.getState().setScale('colony')}>
        <sphereGeometry args={[radius, 64, 48]} />
        <meshStandardMaterial map={texture} bumpMap={relief} bumpScale={0.016} roughness={1} />
      </mesh>
      <mesh scale={1.025}>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshBasicMaterial
          color="#d58b64"
          transparent
          opacity={0.09}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[radius * 0.65, radius * 0.28, radius * 0.71]}
        onClick={(event) => {
          event.stopPropagation();
          useUniverse.getState().setScale('colony');
        }}
      >
        <sphereGeometry args={[radius * 0.026, 12, 8]} />
        <meshBasicMaterial color="#a6fff1" />
      </mesh>
    </group>
  );
}

function Satellite() {
  const orbit = useRef<THREE.Group>(null);
  const reduced = useWorld((s) => s.reducedMotion);
  useFrame((_, delta) => {
    if (orbit.current && !reduced) orbit.current.rotation.y += delta * 0.08;
  });
  return (
    <group ref={orbit} rotation={[0.3, 0, 0.2]}>
      <group position={[4.3, 0, 0]} scale={0.16}>
        <Suspense fallback={null}>
          <WorldKit module="orbital-relay" />
        </Suspense>
      </group>
    </group>
  );
}

function SystemBody({ radius, kind }: { radius: number; kind: PlanetSurface }) {
  const texture = useMemo(() => createPlanetTexture(kind), [kind]);
  const relief = useMemo(() => createPlanetTexture(kind, true), [kind]);
  useEffect(
    () => () => {
      texture.dispose();
      relief.dispose();
    },
    [texture, relief],
  );
  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 32]} />
      <meshStandardMaterial
        map={texture}
        bumpMap={kind === 'banded' ? null : relief}
        bumpScale={0.035}
        roughness={1}
      />
    </mesh>
  );
}

function System() {
  const rings = useMemo(
    () =>
      [8, 14, 22, 34].map((radius) =>
        Array.from({ length: 97 }, (_, i): [number, number, number] => [
          Math.cos((i / 96) * Math.PI * 2) * radius,
          0,
          Math.sin((i / 96) * Math.PI * 2) * radius,
        ]),
      ),
    [],
  );
  return (
    <group name="fictional-solar-system">
      <mesh>
        <sphereGeometry args={[3, 40, 24]} />
        <meshBasicMaterial color="#ffcf7b" />
      </mesh>
      <pointLight intensity={2200} distance={110} decay={2} color="#ffe4bc" />
      {rings.map((points, i) => (
        <Line key={i} points={points} color="#6e6879" transparent opacity={0.45} lineWidth={1} />
      ))}
      {[
        { x: 8, z: 0, size: 0.65, kind: 'cratered' as const },
        { x: -9, z: 10.72, size: 1, kind: 'ochre' as const },
        { x: -30, z: -16, size: 2, kind: 'banded' as const },
      ].map((planet, i) => (
        <group key={i} position={[planet.x, 0, planet.z]}>
          <SystemBody radius={planet.size} kind={planet.kind} />
        </group>
      ))}
      <group
        position={[18, 0, -12.65]}
        onClick={(event) => {
          event.stopPropagation();
          useUniverse.getState().setScale('planet');
        }}
      >
        <Planet radius={1.4} />
      </group>
    </group>
  );
}

function OrbitalScene() {
  const scale = useUniverse((s) => s.scale);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  return (
    <>
      <color attach="background" args={['#10121e']} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[-8, 5, 8]} intensity={3} color="#ffe0b7" />
      <Stars radius={120} depth={35} count={1600} factor={2} fade speed={0} />
      {scale === 'planet' ? (
        <>
          <Planet />
          <Satellite />
        </>
      ) : (
        <System />
      )}
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        minDistance={scale === 'planet' ? 5 : 20}
        maxDistance={scale === 'planet' ? 30 : 140}
        onEnd={() => {
          if (controls.current)
            useUniverse
              .getState()
              .setScale(orbitalZoomDestination(scale, controls.current.getDistance()));
        }}
      />
    </>
  );
}

export function OrbitalWorld() {
  const scale = useUniverse((s) => s.scale);
  const reduced = useWorld((s) => s.reducedMotion);
  return (
    <div key={scale} className={reduced ? 'orbital-scene' : 'orbital-scene scale-arrival'}>
      <Canvas
        key={scale}
        camera={{
          position: scale === 'planet' ? [7, 4, 10] : [38, 48, 60],
          fov: 45,
          near: 0.1,
          far: 300,
        }}
        dpr={[1, 1.6]}
      >
        <OrbitalScene />
      </Canvas>
    </div>
  );
}
