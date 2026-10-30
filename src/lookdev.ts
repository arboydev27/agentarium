import { useWorld } from './state';
import { WORLD_VIEWS, type WorldView } from './world/layout';

/**
 * Look-development harness. `?lookdev=<view>` pins a camera preset, pauses the
 * simulated colony (`playing: false`), disables cinematic motion, and optionally sets night with
 * `&night=1`, so visual changes can be compared as screenshots of one frame.
 */
export function applyLookdev(search = window.location.search) {
  const params = new URLSearchParams(search);
  const requested = params.get('lookdev');
  if (requested === null) return false;
  const view = (WORLD_VIEWS as readonly string[]).includes(requested)
    ? (requested as WorldView)
    : 'overview';
  useWorld.setState({
    camera: view,
    cameraCustomized: false,
    cameraVersion: useWorld.getState().cameraVersion + 1,
    followAgent: null,
    cinematic: false,
    playing: false,
    night: params.get('night') === '1',
  });
  return true;
}
