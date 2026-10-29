import { LOOKOUT } from '../layout';
import { TerrainApron } from '../TerrainApron';
export function MeadowLookoutGround() {
  return (
    <group name="meadow-lookout-pad">
      <TerrainApron x={LOOKOUT.x} z={LOOKOUT.z} radius={LOOKOUT.clearingRadius} />
    </group>
  );
}
