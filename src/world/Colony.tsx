import { WorldKit } from './scenery/WorldKit';
import { Box, Cylinder, Sign } from './primitives';
import { ZONES, type ZoneName } from './layout';

const shell = '#e4d4bd';
const frame = '#393d47';
const panel = '#667382';
const cyan = '#8de3df';

function LightStrip({ position, width }: { position: [number, number, number]; width: number }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[width, 0.035, 0.035]} />
      <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={1.4} />
    </mesh>
  );
}

function Deck({ zone }: { zone: ZoneName }) {
  const {
    center: [x, y, z],
    size: [w, d],
  } = ZONES[zone];
  return (
    <group name={`colony-deck-${zone}`}>
      <Box
        finish="cast-foundation"
        pos={[x, (y + 0.4) / 2, z]}
        size={[w, y - 0.4, d]}
        color="#aa7860"
        radius={0.04}
      />
      {[-1, 1].map((side) => (
        <LightStrip
          key={side}
          position={[x, y + 0.02, z + side * (d / 2 - 0.15)]}
          width={w - 0.4}
        />
      ))}
    </group>
  );
}

// Rear service spines leave the existing seats, entrances and navigation aisles open.
function Habitat({
  x,
  y,
  z,
  width,
  title,
}: {
  x: number;
  y: number;
  z: number;
  width: number;
  title: string;
}) {
  return (
    <group position={[x, y, z]} name={title}>
      <group scale={[width / 10, 1, 1]}>
        <WorldKit module="service-wall" />
      </group>
      <Sign
        text={title}
        pos={[0, 2.98, 0.39]}
        size={[3.5, 0.33]}
        color={shell}
        background={frame}
      />
    </group>
  );
}

function ResourceBank() {
  return (
    <group name="resource-processing-bank">
      <Box
        finish="cast-foundation"
        pos={[6.75, 0.45, 12.5]}
        size={[9.4, 0.2, 1.5]}
        color="#aa7860"
      />
      {[3, 5.5, 8, 10.5].map((x, i) => (
        <group key={x} position={[x, 0.55, 12.5]} scale={[1, 1 + i * 0.08, 1]}>
          <WorldKit module="resource-tank" />
        </group>
      ))}
      <Sign
        text="RESOURCE LAB"
        pos={[7, 2.3, 12.5]}
        size={[3, 0.32]}
        color={shell}
        background={frame}
      />
    </group>
  );
}

function Communications() {
  return (
    <group name="colony-communications" position={[-1.5, 0.49, 8.1]}>
      <WorldKit module="communications-dish" />
    </group>
  );
}

export function Colony() {
  return (
    <group name="mars-colony">
      {(Object.keys(ZONES) as ZoneName[]).map((zone) => (
        <Deck key={zone} zone={zone} />
      ))}
      <Habitat x={-7} y={0.68} z={-8.9} width={11.5} title="HABITAT COMMONS" />
      <Habitat x={7} y={1.1} z={-8.4} width={9} title="RESEARCH ARRAY" />
      <ResourceBank />
      <Communications />
      <Box
        finish="cast-foundation"
        pos={[-10.6, 1.04, 3.4]}
        size={[0.6, 0.15, 2.1]}
        color={shell}
      />
      <Box finish="cast-foundation" pos={[-10.9, 1.4, 3.4]} size={[0.1, 0.6, 2.1]} color={panel} />
      <Cylinder finish="dusty-alloy" pos={[-3.6, 0.72, 7.7]} r={0.85} h={0.46} color={frame} />
      <Cylinder finish="dusty-alloy" pos={[-3.6, 0.97, 7.7]} r={0.7} h={0.04} color={cyan} />
      <Box
        finish="cast-foundation"
        pos={[0, 0.43, 0.85]}
        size={[27.4, 0.06, 1.7]}
        color="#d4af87"
      />
      <Box finish="cast-foundation" pos={[0.1, 0.43, 0]} size={[1.8, 0.06, 20.5]} color="#d4af87" />
      {[-12, -6, 0, 6, 12].map((x) => (
        <LightStrip key={x} position={[x, 0.47, 1.65]} width={1.5} />
      ))}
    </group>
  );
}
