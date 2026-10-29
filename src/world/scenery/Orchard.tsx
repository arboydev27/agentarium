import { ReferenceHabitat } from './ReferenceHabitat';
import { ORCHARD } from '../layout';
import { SolarRack, SensorMast } from './ColonyHardware';

export function OrchardCommons() {
  return (
    <group name="expedition-base">
      <ReferenceHabitat />
      <SolarRack x={ORCHARD.x - 6} z={ORCHARD.z - 5} />
      <SolarRack x={ORCHARD.x - 6} z={ORCHARD.z - 9} />
      <SensorMast x={ORCHARD.x - 5} z={ORCHARD.z + 5} />
    </group>
  );
}
