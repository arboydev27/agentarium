import { useSyncExternalStore } from 'react';
import { useWorld } from './state';
import {
  getScenicAssetSnapshot,
  retryScenicAsset,
  subscribeScenicAssets,
} from './world/scenicAssets';
import type { ScenicRegionId } from './world/scenicVisibility';

const labels: Record<ScenicRegionId, string> = {
  lookout: 'Meadow Lookout',
  orchard: 'Orchard Commons',
  observatory: 'Cedar Observatory',
  dawnlight: 'Dawnlight Glasshouse',
  windward: 'Windward Mill',
  amber: 'Amber Bluff',
  woodland: 'Lantern Hollow',
  northstar: 'Northstar Outpost',
  slate: 'Slate Reach',
};

/** Failed landmarks remain reachable even after the camera has moved away. */
export function SceneryStatus() {
  const live = useWorld((state) => state.mode === 'live');
  const snapshot = useSyncExternalStore(
    subscribeScenicAssets,
    getScenicAssetSnapshot,
    getScenicAssetSnapshot,
  );
  const failed = Object.values(snapshot).filter((asset) => asset.status === 'failed');
  if (!failed.length) return null;
  return (
    <aside className="scenery-status" aria-label="Scenery loading" role="status">
      <strong>Some scenery couldn’t load</strong>
      <ul>
        {failed.map(({ id }) => (
          <li key={id}>
            <span>{labels[id]}</span>
            <button
              type="button"
              aria-label={`Retry loading ${labels[id]}`}
              onClick={() => void retryScenicAsset(id).catch(() => {})}
            >
              Retry
            </button>
          </li>
        ))}
      </ul>
      {failed.some((asset) => asset.recovery === 'reload') ? (
        <div className="scenery-recovery">
          <p>
            Reload to try a fresh download.
            {live ? ' You’ll need to reconnect the bridge afterward.' : ''}
          </p>
          <button type="button" onClick={() => location.reload()}>
            Reload world
          </button>
        </div>
      ) : null}
    </aside>
  );
}
