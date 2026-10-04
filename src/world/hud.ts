import type { Agent } from '../state';
import { attentionFor } from '../shared/work.mjs';
import { landscapeBiomeAt } from './biomes';
import {
  LOOKOUT,
  OBSERVATORY,
  ORCHARD,
  WORLD,
  ZONES,
  type WorldLocation,
  type ZoneName,
} from './layout';
import { AMBER_BLUFF } from './scenery/amberPlacement';
import { DAWNLIGHT_GLASSHOUSE } from './scenery/dawnlightPlacement';
import { SOUTHWIND_SHORE } from './scenery/southwindTrailPlacement';
import { TRAIL_TURNOUTS, turnoutPoint } from './scenery/turnoutPlacement';
import { WINDWARD_MILL } from './scenery/windwardPlacement';
import { WOODLAND_HOLLOW } from './scenery/woodlandPlacement';
export type WorkFilter = 'working' | 'completed' | 'unknown' | 'here';
export function matchesWorkFilter(agent: Agent, filter: WorkFilter, paused = false) {
  if (filter === 'here') return agent.seat >= 0 && agent.seat < 8;
  const uncertain =
    paused || agent.telemetryStale || ['unknown', 'disconnected'].includes(agent.status);
  if (filter === 'unknown') return !!uncertain;
  if (uncertain) return false;
  if (filter === 'working') return agent.status === 'working' || agent.status === 'tool';
  return agent.status === 'completed';
}
export function worldCounts(agents: Agent[], paused = false) {
  return {
    working: agents.filter((a) => matchesWorkFilter(a, 'working', paused)).length,
    completed: agents.filter((a) => matchesWorkFilter(a, 'completed', paused)).length,
    unknown: agents.filter((a) => matchesWorkFilter(a, 'unknown', paused)).length,
    here: agents.filter((a) => matchesWorkFilter(a, 'here')).length,
    attention: agents.filter((a) => attentionFor(a)).length,
  };
}
const districts = Object.entries(ZONES) as [ZoneName, (typeof ZONES)[ZoneName]][];
export function districtAt(x: number, z: number): WorldLocation {
  for (const [name, zone] of districts) {
    if (
      Math.abs(x - zone.center[0]) <= zone.size[0] / 2 &&
      Math.abs(z - zone.center[2]) <= zone.size[1] / 2
    )
      return name;
  }
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) <= LOOKOUT.focusRadius) return 'lookout';
  if (Math.hypot(x - ORCHARD.x, z - ORCHARD.z) <= ORCHARD.focusRadius) return 'orchard';
  if (Math.hypot(x - OBSERVATORY.x, z - OBSERVATORY.z) <= OBSERVATORY.focusRadius)
    return 'observatory';
  if (Math.hypot(x - SOUTHWIND_SHORE.x, z - SOUTHWIND_SHORE.z) <= SOUTHWIND_SHORE.focusRadius)
    return 'mere';
  if (
    Math.hypot(x - DAWNLIGHT_GLASSHOUSE.centerX, z - DAWNLIGHT_GLASSHOUSE.centerZ) <=
    DAWNLIGHT_GLASSHOUSE.focusRadius
  )
    return 'dawnlight';
  if (Math.hypot(x - WINDWARD_MILL.centerX, z - WINDWARD_MILL.centerZ) <= WINDWARD_MILL.focusRadius)
    return 'windward';
  if (Math.hypot(x - AMBER_BLUFF.x, z - AMBER_BLUFF.z) <= AMBER_BLUFF.focusRadius) return 'amber';
  if (Math.hypot(x - WOODLAND_HOLLOW.x, z - WOODLAND_HOLLOW.z) <= WOODLAND_HOLLOW.focusRadius)
    return 'hollow';
  for (const turnout of TRAIL_TURNOUTS) {
    const [tx, , tz] = turnoutPoint(turnout.trailIndex, turnout.side, 4.8);
    if (Math.hypot(x - tx, z - tz) <= 3.6) return turnout.id;
  }
  if (Math.abs(x) <= WORLD.width / 2 + 5 && Math.abs(z) <= WORLD.depth / 2 + 5) return 'overview';
  switch (landscapeBiomeAt(x, z)) {
    case 'woodland':
      return 'western-woods';
    case 'highland':
      return 'northern-highlands';
    case 'amber':
      return 'amber-foothills';
    default:
      return 'open-landscape';
  }
}
