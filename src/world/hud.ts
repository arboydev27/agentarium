import type { Agent } from '../state';
import { attentionFor } from '../shared/work.mjs';
import { WORLD, ZONES, type ZoneName } from './layout';
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
export function districtAt(x: number, z: number): ZoneName | 'overview' | 'horizon' {
  for (const [name, zone] of districts) {
    if (
      Math.abs(x - zone.center[0]) <= zone.size[0] / 2 &&
      Math.abs(z - zone.center[2]) <= zone.size[1] / 2
    )
      return name;
  }
  return Math.abs(x) > WORLD.width / 2 + 5 || Math.abs(z) > WORLD.depth / 2 + 5
    ? 'horizon'
    : 'overview';
}
