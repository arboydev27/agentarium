import { WORLD_VIEWS, type WorldView } from '../world/layout';
import { STATUS_LABEL, type Agent } from '../state';
import { attentionFor } from '../shared/work.mjs';

/** Short hotbar labels. The full place names stay in WORLD_VIEW_LABELS. */
export const HOTBAR_LABELS: Record<WorldView, string> = {
  overview: 'Overview',
  café: 'Commons',
  garden: 'Lab',
  studio: 'Array',
  courtyard: 'Comms',
  lookout: 'Lookout',
  orchard: 'Base',
  northstar: 'Spaceport',
  observatory: 'Deep Sky',
  hollow: 'Field Stn',
  mere: 'Crater',
  dawnlight: 'Biolab',
  windward: 'Helios',
  amber: 'Bluff',
  horizon: 'Horizon',
};

/** Number keys for the first ten hotbar slots, in slot order. */
export const HOTBAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
export function hotbarKey(index: number): string | null {
  return HOTBAR_KEYS[index] ?? null;
}
export function hotbarViewForKey(
  key: string,
  views: readonly WorldView[] = WORLD_VIEWS,
): WorldView | null {
  const index = (HOTBAR_KEYS as readonly string[]).indexOf(key);
  return index >= 0 && index < views.length ? views[index] : null;
}

export type HudAction =
  | { type: 'view'; view: WorldView }
  | { type: 'play' }
  | { type: 'map' }
  | { type: 'roster' }
  | { type: 'night' }
  | { type: 'watch' }
  | { type: 'help' };

/** Single-key HUD shortcuts. Modifier chords belong to the browser. */
export function hudShortcut(event: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}): HudAction | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const view = hotbarViewForKey(event.key);
  if (view) return { type: 'view', view };
  switch (event.key) {
    case ' ':
      return { type: 'play' };
    case 'm':
    case 'M':
      return { type: 'map' };
    case 'r':
    case 'R':
      return { type: 'roster' };
    case 'n':
    case 'N':
      return { type: 'night' };
    case 'w':
    case 'W':
      return { type: 'watch' };
    case '?':
      return { type: 'help' };
    default:
      return null;
  }
}

export const HUD_SHORTCUT_HELP: { keys: string; does: string }[] = [
  { keys: '1 – 9, 0', does: 'Jump to the first ten viewpoints' },
  { keys: '← →', does: 'Move between viewpoints while the hotbar has focus' },
  { keys: 'Arrows', does: 'Pan the camera while the world has focus; Shift pans farther' },
  { keys: 'M', does: 'Open or close the map' },
  { keys: 'R', does: 'Open or close the resident list' },
  { keys: 'N', does: 'Switch between daylight and evening' },
  { keys: 'W', does: 'Enter or leave watch mode' },
  { keys: 'Space', does: 'Pause or resume the simulation' },
  {
    keys: 'Esc',
    does: 'Leave watch mode, stop following, clear the selection, then close the pane',
  },
  { keys: '?', does: 'Open this help' },
];

/** Milliseconds without input before non-essential HUD dims. */
export const HUD_IDLE_DELAY = 4000;
export function hudIsIdle(lastInteractionAt: number, now: number, delay = HUD_IDLE_DELAY) {
  return now - lastInteractionAt >= delay;
}
/** Overlays dim only while nothing is being read or edited. Attention never dims (CSS). */
export function hudDims(state: { idle: boolean; paneOpen: boolean; dialogOpen: boolean }) {
  return state.idle && !state.paneOpen && !state.dialogOpen;
}

export type RosterGlyph = 'attention' | 'working' | 'completed' | 'idle' | 'unknown';
/** Status glyph for a roster row. Reported attention outranks uncertainty, like worldCounts. */
export function rosterGlyph(agent: Agent, paused = false): RosterGlyph {
  if (attentionFor(agent)) return 'attention';
  if (
    paused ||
    agent.telemetryStale ||
    agent.status === 'unknown' ||
    agent.status === 'disconnected'
  )
    return 'unknown';
  if (agent.status === 'working' || agent.status === 'tool') return 'working';
  if (agent.status === 'completed') return 'completed';
  return 'idle';
}
export function rosterStatusLabel(agent: Agent, paused = false) {
  return (paused || agent.telemetryStale ? 'Last known: ' : '') + STATUS_LABEL[agent.status];
}

/** Below this viewport width the roster strip collapses to a chip. */
export const ROSTER_COLLAPSE_WIDTH = 600;
export function rosterCollapses(width: number) {
  return width <= ROSTER_COLLAPSE_WIDTH;
}

/** Escape unwinds one layer at a time, so closing a resident returns to the list beneath it. */
export function escapeTarget(state: {
  watchMode: boolean;
  following: boolean;
  selected: boolean;
  paneOpen: boolean;
}): 'watch' | 'follow' | 'selection' | 'pane' | null {
  if (state.watchMode) return 'watch';
  if (state.following) return 'follow';
  if (state.selected) return 'selection';
  if (state.paneOpen) return 'pane';
  return null;
}
