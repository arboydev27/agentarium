import { BIOLAB_HABITATS, DAWNLIGHT_GLASSHOUSE as SITE } from './dawnlightPlacement';
import { PressureHabitat, SolarRack, SensorMast } from './ColonyHardware';

export function DawnlightGlasshouse() {
  return (
    <group name="dawnlight-biolab">
      {BIOLAB_HABITATS.map((habitat) => (
        <PressureHabitat key={habitat.title} {...habitat} />
      ))}
      <SolarRack x={SITE.centerX + 2} z={SITE.centerZ - 12} />
      <SensorMast x={SITE.centerX + 7} z={SITE.centerZ - 5} height={5} />
    </group>
  );
}
