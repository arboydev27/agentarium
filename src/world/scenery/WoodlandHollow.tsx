import { WOODLAND_SHELTER_XZ } from './woodlandPlacement';
import { PressureHabitat, SolarRack, SensorMast } from './ColonyHardware';

export function LanternHollow() {
  const [x, z] = WOODLAND_SHELTER_XZ;
  return (
    <group name="basalt-field-station">
      <PressureHabitat x={x} z={z} title="BASALT FIELD STATION" />
      <SolarRack x={x - 5.5} z={z - 3} turn={0.4} />
      <SensorMast x={x + 1} z={z + 6} height={5.5} />
    </group>
  );
}
