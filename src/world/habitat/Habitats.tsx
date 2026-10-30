import { Fragment, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state';
import type { Status } from '../../state';
import { SEATS, ZONES, type ZoneName } from '../layout';
import type { Point } from '../motion';
import { Box, Cylinder, Sign } from '../primitives';
import { WorldKit } from '../scenery/WorldKit';
import { STATUS_COLORS } from '../statusColors';
import { renderedTerrainHeight } from '../terrain';
import {
  apronSlabs,
  doorPlacements,
  HABITAT_PROPS,
  HABITATS,
  OPENING_DEPTH,
  OPENING_MODULE,
  propPlacement,
  ROOF_DISH,
  roofTop,
  shellPlacements,
  SIDES,
  WALL_HEIGHT,
  YARD_PROPS,
  ZONE_NAMES,
  zoneOfSeat,
  type DoorPlacement,
  type Placement,
  type ShellPlacement,
  type Side,
} from './habitatLayout';
import { KitInstances } from './KitInstances';
import { revealAmount, sideFacesCamera } from './reveal';

const scratch = new THREE.Vector3();
const nameplate = { color: '#efe4d0', background: '#2f3540' };

type Fades = Record<Side | 'roof', { current: number }>;

/** All four pressurized modules, their airlocks, interiors and yard hardware. */
export function Habitats() {
  return (
    <group name="pressurized-habitats">
      {ZONE_NAMES.map((zone) => (
        <HabitatModule key={zone} zone={zone} />
      ))}
      <Yard />
    </group>
  );
}

function HabitatModule({ zone }: { zone: ZoneName }) {
  const shell = useMemo(() => shellPlacements(zone), [zone]);
  const doors = useMemo(() => doorPlacements(zone), [zone]);
  const aprons = useMemo(() => apronSlabs(zone), [zone]);
  const groups = useMemo(() => {
    const bySide = Object.fromEntries(
      SIDES.map((side) => [side, { wall: [] as ShellPlacement[], glass: [] as ShellPlacement[] }]),
    ) as Record<Side, { wall: ShellPlacement[]; glass: ShellPlacement[] }>;
    const pick = (part: ShellPlacement['part']) => shell.filter((p) => p.part === part);
    for (const placement of shell) {
      if (placement.part === 'wall') bySide[placement.side!].wall.push(placement);
      if (placement.part === 'glass') bySide[placement.side!].glass.push(placement);
    }
    return {
      bySide,
      corners: pick('corner'),
      roof: pick('roof'),
      radiators: pick('radiator'),
      roofRadiators: pick('roof-radiator'),
    };
  }, [shell]);
  const fades = useMemo<Fades>(
    () => ({
      north: { current: 0 },
      south: { current: 0 },
      east: { current: 0 },
      west: { current: 0 },
      roof: { current: 0 },
    }),
    [],
  );
  // A selected or followed resident opens their own module regardless of distance.
  const forced = useWorld((s) => {
    const id = s.followAgent ?? s.selected;
    const agent = id ? s.agents.find((a) => a.id === id) : undefined;
    return !!agent && zoneOfSeat(agent.seat) === zone;
  });
  const reduced = useWorld((s) => s.reducedMotion);
  const night = useWorld((s) => s.night);
  const [cx, cy, cz] = ZONES[zone].center;
  const [w, d] = ZONES[zone].size;
  useFrame(({ camera }, delta) => {
    const distance = camera.position.distanceTo(scratch.set(cx, cy + 1.5, cz));
    const reveal = revealAmount(distance, forced);
    const k = reduced ? 1 : 1 - Math.exp(-5 * delta);
    fades.roof.current += (reveal - fades.roof.current) * k;
    for (const side of SIDES) {
      const target = sideFacesCamera(side, zone, camera.position) ? reveal : 0;
      fades[side].current += (target - fades[side].current) * k;
    }
  });
  return (
    <group name={`habitat-${zone}`}>
      {SIDES.map((side) => (
        <Fragment key={side}>
          <KitInstances
            module="hab-wall"
            placements={groups.bySide[side].wall}
            fade={fades[side]}
            floor={0.14}
          />
          <KitInstances
            module="hab-glass"
            placements={groups.bySide[side].glass}
            fade={fades[side]}
            floor={0.1}
          />
        </Fragment>
      ))}
      <KitInstances module="hab-corner" placements={groups.corners} />
      <KitInstances module="hab-radiator" placements={groups.radiators} />
      <KitInstances module="hab-roof" placements={groups.roof} fade={fades.roof} />
      <KitInstances module="hab-radiator" placements={groups.roofRadiators} fade={fades.roof} />
      {zone === ROOF_DISH.zone && (
        <KitInstances
          module="communications-dish"
          placements={[
            {
              module: 'communications-dish',
              position: [ROOF_DISH.x, roofTop(zone), ROOF_DISH.z],
              rotationY: 0,
              scale: [1, 1, 1],
            },
          ]}
          fade={fades.roof}
        />
      )}
      {doors.map((door) => (
        <Airlock key={`${door.side}:${door.at}`} door={door} />
      ))}
      {aprons.map((slab, index) => (
        <Box
          key={index}
          finish="cast-foundation"
          pos={[slab.x, slab.y - 0.07, slab.z]}
          size={[slab.w, 0.14, slab.d]}
          color="#aa7860"
          radius={0.02}
        />
      ))}
      <Interior zone={zone} />
      <pointLight
        position={[cx, cy + WALL_HEIGHT - 0.35, cz]}
        intensity={night ? 9 : 2.5}
        distance={Math.max(w, d) * 0.9}
        decay={2}
        color="#ffd7a6"
      />
    </group>
  );
}

function Airlock({ door }: { door: DoorPlacement }) {
  const depth = OPENING_DEPTH[door.kind];
  return (
    <group name={`${door.zone}-${door.kind}`}>
      <group position={door.position} rotation={[0, door.rotationY, 0]}>
        <WorldKit module={OPENING_MODULE[door.kind]} />
        <Sign
          text={door.title}
          pos={[0, 2.72, depth + 0.03]}
          size={[door.kind === 'gate' ? 2.4 : 1.7, 0.28]}
          color={nameplate.color}
          background={nameplate.background}
        />
      </group>
      {door.ramp && <Ramp {...door.ramp} />}
    </group>
  );
}

/** A slab whose top follows the walked chord, from the outside node up to the floor. */
function Ramp({ from, to, width }: { from: Point; to: Point; width: number }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const run = Math.hypot(dx, dz);
  const length = Math.hypot(run, dy);
  if (length < 0.05) return null;
  const yaw = Math.atan2(dx, dz);
  const pitch = -Math.asin(dy / length);
  return (
    <group
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]}
      rotation={[0, yaw, 0]}
    >
      <group rotation={[pitch, 0, 0]}>
        <Box
          finish="cast-foundation"
          pos={[0, -0.045, 0]}
          size={[width, 0.09, length + 0.3]}
          color="#b08568"
          radius={0.015}
        />
        {[-1, 1].map((side) => (
          <Box
            key={side}
            finish="dusty-alloy"
            pos={[(side * (width + 0.08)) / 2, 0.02, 0]}
            size={[0.06, 0.05, length + 0.3]}
            color="#5b4a3e"
            radius={0.01}
          />
        ))}
      </group>
    </group>
  );
}

function Interior({ zone }: { zone: ZoneName }) {
  const props = useMemo(
    () => HABITAT_PROPS.filter((prop) => prop.zone === zone).map(propPlacement),
    [zone],
  );
  const byModule = useMemo(() => {
    const map = new Map<Placement['module'], Placement[]>();
    for (const placement of props) {
      const list = map.get(placement.module) ?? [];
      list.push(placement);
      map.set(placement.module, list);
    }
    return [...map.entries()];
  }, [props]);
  return (
    <group name={`${zone}-interior`}>
      {byModule.map(([module, placements]) => (
        <KitInstances key={module} module={module} placements={placements} />
      ))}
      {ZONES[zone].seats.map((seat) => (
        <StatusLamp key={seat} seat={seat} />
      ))}
    </group>
  );
}

/**
 * A pendant lamp over each desk carries the resident's state as colour. Idle
 * desks glow faintly; working, waiting and failed states are bright enough to bloom.
 */
function StatusLamp({ seat }: { seat: number }) {
  const status = useWorld((s) => s.agents.find((a) => a.seat === seat)?.status);
  const [x, y, z] = SEATS[seat];
  const color = status ? STATUS_COLORS[status] : '#4f5a57';
  const bright =
    !!status && (['working', 'tool', 'waiting', 'failed'] as Status[]).includes(status);
  const lampY = y + 2.45;
  return (
    <group position={[x, 0, z - 0.25]} name={`status-lamp-${seat}`}>
      <Cylinder
        pos={[0, (lampY + y + WALL_HEIGHT) / 2, 0]}
        r={0.012}
        h={y + WALL_HEIGHT - lampY}
        color="#1e2226"
      />
      <Cylinder
        finish="dusty-alloy"
        pos={[0, lampY, 0]}
        r={0.16}
        top={0.1}
        h={0.14}
        color="#3d444d"
      />
      {/* A bulb under the shade and a cap on top keep the state readable from every camera. */}
      <mesh position={[0, lampY - 0.12, 0]}>
        <sphereGeometry args={[0.085, 16, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={bright ? 3.4 : status ? 1.3 : 0.3}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, lampY + 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.09, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={bright ? 3.4 : status ? 1.3 : 0.3}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Yard() {
  const placements = useMemo(
    () =>
      YARD_PROPS.map((prop): Placement => ({
        module: prop.module,
        position: [prop.x, prop.y ?? renderedTerrainHeight(prop.x, prop.z), prop.z],
        rotationY: prop.turn,
        scale: [1, 1, 1],
      })),
    [],
  );
  const byModule = useMemo(() => {
    const map = new Map<Placement['module'], Placement[]>();
    for (const placement of placements) {
      const list = map.get(placement.module) ?? [];
      list.push(placement);
      map.set(placement.module, list);
    }
    return [...map.entries()];
  }, [placements]);
  return (
    <group name="habitat-yard">
      {byModule.map(([module, list]) => (
        <KitInstances key={module} module={module} placements={list} />
      ))}
    </group>
  );
}

export { HABITATS, type RefObject };
