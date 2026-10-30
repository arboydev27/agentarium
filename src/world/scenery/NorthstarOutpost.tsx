import { WorldKit } from './WorldKit';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { Box, Cylinder, Sign } from '../primitives';
import { renderedTerrainHeight } from '../terrain';
import { NORTHSTAR_TOWER_XZ } from './northstarPlacement';
import { KitInstances } from '../habitat/KitInstances';
import type { Placement } from '../habitat/habitatLayout';
import { launchDustWash, roverPatrolPose } from '../ambientLife';

export function ExpeditionRover() {
  return (
    <group name="expedition-rover">
      <WorldKit module="survey-rover" />
    </group>
  );
}

/** The rover patrols a loop east of the pad; reduced motion parks it at the loop start. */
function RoverPatrol({
  originX,
  originZ,
  ground,
}: {
  originX: number;
  originZ: number;
  ground: number;
}) {
  const rover = useRef<THREE.Group>(null);
  const time = useRef(0);
  const reduced = useWorld((s) => s.reducedMotion);
  useFrame((_, delta) => {
    if (!rover.current) return;
    if (!reduced) time.current += Math.min(delta, 0.05);
    const pose = roverPatrolPose(time.current);
    rover.current.position.set(
      pose.x,
      renderedTerrainHeight(originX + pose.x, originZ + pose.z) - ground,
      pose.z,
    );
    rover.current.rotation.y = pose.heading;
  });
  return (
    <group ref={rover} name="rover-patrol">
      <ExpeditionRover />
    </group>
  );
}

function PadBeacons({ lift }: { lift: number }) {
  const placements = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i): Placement => ({
        module: 'pad-beacon',
        position: [Math.cos((i * Math.PI) / 4) * 4.1, lift, Math.sin((i * Math.PI) / 4) * 4.1],
        rotationY: 0,
        scale: [1, 1, 1],
      })),
    [lift],
  );
  return <KitInstances module="pad-beacon" placements={placements} />;
}

function Rocket() {
  const craft = useRef<THREE.Group>(null);
  const plume = useRef<THREE.Mesh>(null);
  const wash = useRef<THREE.Mesh>(null);
  const timer = useRef(0);
  const reduced = useWorld((s) => s.reducedMotion);
  // This is a decorative flight cycle. It does not read or write provider state.
  useFrame((_, delta) => {
    if (!craft.current || !plume.current) return;
    if (reduced) {
      craft.current.position.y = -0.55;
      craft.current.visible = true;
      plume.current.visible = false;
      if (wash.current) wash.current.visible = false;
      return;
    }
    timer.current = (timer.current + Math.min(delta, 0.05)) % 90;
    const elapsed = Math.max(0, timer.current - 60);
    const flying = elapsed > 0 && elapsed < 16;
    craft.current.visible = elapsed < 16;
    craft.current.position.y = (flying ? elapsed * elapsed * 0.65 : 0) - 0.55;
    plume.current.visible = flying;
    plume.current.scale.y = 1 + Math.sin(timer.current * 25) * 0.12;
    if (wash.current) {
      // Ignition throws a ring of pad dust outward under the climbing rocket.
      const dust = launchDustWash(flying ? elapsed : -1);
      wash.current.visible = dust.opacity > 0;
      wash.current.scale.setScalar(Math.max(dust.scale, 0.001));
      (wash.current.material as THREE.MeshBasicMaterial).opacity = dust.opacity;
    }
  });
  return (
    <group name="decorative-survey-launch">
      <group ref={craft}>
        <WorldKit module="survey-rocket" />
        <mesh ref={plume} position={[0, 0.15, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
          <coneGeometry args={[0.48, 2.3, 12]} />
          <meshBasicMaterial color="#ffd58d" transparent opacity={0.8} />
        </mesh>
      </group>
      <mesh ref={wash} position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.55, 1, 40]} />
        <meshBasicMaterial color="#d6a580" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export const NORTHSTAR_BENCH_XZ = [51.2, -110.5] as const;

export function NorthstarOutpost() {
  const [x, z] = NORTHSTAR_TOWER_XZ;
  const ground = renderedTerrainHeight(x, z);
  const cabinHeights = [-1.6, 1.6].flatMap((dx) =>
    [-1.35, 1.35].map((dz) => renderedTerrainHeight(x - 5.5 + dx, z + dz) - ground),
  );
  const cabinBase = Math.max(...cabinHeights) + 0.03;
  const cabinBottom = Math.min(...cabinHeights) - 0.1;
  const padLift =
    Math.max(
      0,
      ...Array.from({ length: 32 }, (_, i) => {
        const angle = (i / 32) * Math.PI * 2;
        return renderedTerrainHeight(x + Math.cos(angle) * 4.5, z + Math.sin(angle) * 4.5) - ground;
      }),
    ) + 0.12;
  return (
    <group name="northstar-spaceport" position={[x, ground, z]}>
      <Cylinder
        finish="dusty-alloy"
        pos={[0, padLift / 2, 0]}
        r={4.5}
        h={padLift + 0.24}
        color="#49515a"
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, padLift + 0.13, 0]}>
        <ringGeometry args={[3.7, 3.82, 48]} />
        <meshBasicMaterial color="#92e6df" side={THREE.DoubleSide} />
      </mesh>
      <group
        position={[
          NORTHSTAR_BENCH_XZ[0] - x,
          renderedTerrainHeight(...NORTHSTAR_BENCH_XZ) - ground,
          NORTHSTAR_BENCH_XZ[1] - z,
        ]}
      >
        <Box finish="ceramic-paint" pos={[0, 0.6, 0]} size={[2.1, 0.2, 0.65]} color="#d7c7ae" />
        <Box finish="ceramic-paint" pos={[0, 0.3, 0]} size={[1.6, 0.6, 0.4]} color="#535967" />
      </group>
      <group position={[0, padLift, 0]}>
        <Rocket />
        <group position={[-2.6, 0, 0]}>
          <WorldKit module="launch-gantry" />
        </group>
        <PadBeacons lift={0.12} />
      </group>
      <group
        position={[6, renderedTerrainHeight(x + 6, z - 6) - ground, -6]}
        rotation={[0, 0.2, 0]}
      >
        <WorldKit module="fuel-farm" />
      </group>
      <RoverPatrol originX={x} originZ={z} ground={ground} />
      <Box
        finish="ceramic-paint"
        pos={[-5.5, (cabinBase + cabinBottom) / 2, 0]}
        size={[3.2, cabinBase - cabinBottom, 2.7]}
        color="#706457"
        radius={0.03}
      />
      <group position={[-5.5, cabinBase, 0]}>
        <WorldKit module="control-cabin" />
      </group>
      <Sign
        text="NORTHSTAR / SURVEY FLIGHTS"
        pos={[-2, 1.3, 4.8]}
        size={[5, 0.4]}
        color="#eee2cb"
        background="#424955"
      />
    </group>
  );
}
