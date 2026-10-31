import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { ambientStep } from '../ambient';
import { Cylinder } from '../primitives';
import { renderedTerrainHeight } from '../terrain';
import { DOCK_PADS, DRONE_ROUTES, droneBlink, dronePose, type DroneRoute } from './drones';

// Two small quadrotor drones built from primitives, flying the routes in
// drones.ts between the pads, the module roofs, the roof dish and the relay
// mast. Decorative: they never carry a label, a ring or a resident identity.

const ROTOR_OFFSETS: readonly [number, number][] = [
  [0.14, 0.14],
  [-0.14, 0.14],
  [0.14, -0.14],
  [-0.14, -0.14],
];

export function MaintenanceDrones() {
  return (
    <group name="maintenance-drones">
      {DOCK_PADS.map((pad) => (
        <DockPad key={pad.id} pad={pad} />
      ))}
      {DRONE_ROUTES.map((route) => (
        <Drone key={route.id} route={route} />
      ))}
    </group>
  );
}

function DockPad({ pad }: { pad: (typeof DOCK_PADS)[number] }) {
  const y = renderedTerrainHeight(pad.x, pad.z);
  return (
    <group name={`drone-${pad.id}`} position={[pad.x, y, pad.z]}>
      <Cylinder finish="cast-foundation" pos={[0, 0.03, 0]} r={0.75} h={0.06} color="#8e6a55" />
      <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.58, 32]} />
        <meshBasicMaterial color="#92e6df" />
      </mesh>
    </group>
  );
}

function Drone({ route }: { route: DroneRoute }) {
  const group = useRef<THREE.Group>(null);
  const rotors = useRef<THREE.InstancedMesh>(null);
  const rotorSpin = useRef<THREE.Group>(null);
  const time = useRef(0);
  const reduced = useWorld((s) => s.reducedMotion);
  const light = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#92e6df',
        emissive: '#92e6df',
        emissiveIntensity: 1,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => light.dispose(), [light]);
  useLayoutEffect(() => {
    const mesh = rotors.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    ROTOR_OFFSETS.forEach(([x, z], i) => {
      matrix.makeTranslation(x, 0.055, z);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame((_, delta) => {
    time.current += ambientStep(delta, reduced, false);
    const pose = dronePose(route, time.current, reduced);
    const body = group.current;
    if (!body) return;
    body.position.set(pose.x, pose.y, pose.z);
    body.rotation.y = pose.heading;
    if (rotorSpin.current) rotorSpin.current.rotation.y = pose.rotor;
    light.emissiveIntensity = droneBlink(time.current, reduced);
  });
  return (
    <group ref={group} name={`drone-${route.id}`}>
      <mesh castShadow>
        <boxGeometry args={[0.22, 0.06, 0.22]} />
        <meshStandardMaterial color="#d9cfbd" roughness={0.6} metalness={0.2} />
      </mesh>
      {[Math.PI / 4, -Math.PI / 4].map((turn) => (
        <mesh key={turn} rotation={[0, turn, 0]} position={[0, 0.02, 0]}>
          <boxGeometry args={[0.44, 0.025, 0.04]} />
          <meshStandardMaterial color="#3d444d" roughness={0.7} metalness={0.4} />
        </mesh>
      ))}
      <group ref={rotorSpin}>
        <instancedMesh ref={rotors} args={[undefined, undefined, ROTOR_OFFSETS.length]}>
          <cylinderGeometry args={[0.1, 0.1, 0.01, 16]} />
          <meshStandardMaterial color="#6b7480" roughness={0.5} transparent opacity={0.7} />
        </instancedMesh>
      </group>
      <mesh position={[0, 0.01, 0.13]} material={light}>
        <sphereGeometry args={[0.035, 10, 8]} />
      </mesh>
    </group>
  );
}
