import { WorldKit } from './WorldKit';
import { LOOKOUT } from '../layout';
import { renderedTerrainHeight } from '../terrain';
import { Sign } from '../primitives';
import { SensorMast } from './ColonyHardware';

export function MeadowLookout() {
  return (
    <group name="survey-lookout">
      <group
        position={[
          LOOKOUT.x - 6.5,
          renderedTerrainHeight(LOOKOUT.x - 6.5, LOOKOUT.z - 6),
          LOOKOUT.z - 6,
        ]}
      >
        <WorldKit module="relay-mast" />
      </group>
      <SensorMast x={LOOKOUT.x - 3.8} z={LOOKOUT.z - 2.5} height={5.2} />
      <SensorMast x={LOOKOUT.x + 3.8} z={LOOKOUT.z - 2.5} height={3.6} />
      <group
        position={[LOOKOUT.x, renderedTerrainHeight(LOOKOUT.x, LOOKOUT.z - 2.4), LOOKOUT.z - 2.4]}
      >
        <WorldKit module="survey-console" />
        <Sign
          text="SURVEY LOOKOUT"
          pos={[0, 0.95, 0.5]}
          size={[2.3, 0.3]}
          color="#f1e1c9"
          background="#454957"
        />
      </group>
    </group>
  );
}
