import { Sign } from '../primitives';
import { renderedTerrainHeight } from '../terrain';
import { WorldKit } from './WorldKit';

export function PressureHabitat({ x, z, title }: { x: number; z: number; title: string }) {
  return (
    <group name={title} position={[x, renderedTerrainHeight(x, z), z]}>
      <WorldKit module="pressure-habitat" />
      <Sign
        text={title}
        pos={[0, 2.45, 2.9]}
        size={[2.8, 0.3]}
        background="#414955"
        color="#f2e3cc"
      />
    </group>
  );
}

export function SolarRack({ x, z, turn = 0 }: { x: number; z: number; turn?: number }) {
  return (
    <group position={[x, renderedTerrainHeight(x, z), z]} rotation={[0, turn, 0]}>
      <WorldKit module="solar-rack" />
    </group>
  );
}

export function SensorMast({ x, z, height = 4 }: { x: number; z: number; height?: number }) {
  return (
    <group position={[x, renderedTerrainHeight(x, z), z]} scale={[1, height / 4, 1]}>
      <WorldKit module="sensor-mast" />
    </group>
  );
}
