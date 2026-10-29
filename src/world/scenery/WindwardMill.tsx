import { WINDWARD_MILL as SITE } from './windwardPlacement';
import { PressureHabitat, SolarRack, SensorMast } from './ColonyHardware';

export function WindwardMill() {
  return (
    <group name="helios-power-field">
      <PressureHabitat x={SITE.centerX} z={SITE.centerZ} title="HELIOS / POWER" />
      {[0, 1, 2].flatMap((row) =>
        [0, 1].map((column) => (
          <SolarRack
            key={`${row}:${column}`}
            x={SITE.centerX - 8 - column * 5}
            z={SITE.centerZ - 5 + row * 4}
            turn={-0.25}
          />
        )),
      )}
      <SensorMast x={SITE.centerX + 3} z={SITE.centerZ - 5} height={7} />
    </group>
  );
}
