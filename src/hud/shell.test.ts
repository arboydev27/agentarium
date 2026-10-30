import { describe, expect, it } from 'vitest';
import { initialAgents } from '../state';
import { WORLD_VIEWS, WORLD_VIEW_LABELS } from '../world/layout';
import { worldCounts } from '../world/hud';
import {
  escapeTarget,
  HOTBAR_KEYS,
  HOTBAR_LABELS,
  HUD_IDLE_DELAY,
  HUD_SHORTCUT_HELP,
  hotbarKey,
  hotbarViewForKey,
  hudDims,
  hudIsIdle,
  hudShortcut,
  rosterCollapses,
  rosterGlyph,
  rosterStatusLabel,
} from './shell';

describe('viewpoint hotbar', () => {
  it('gives every viewpoint a short, unique label', () => {
    const labels = WORLD_VIEWS.map((view) => HOTBAR_LABELS[view]);
    expect(new Set(labels).size).toBe(WORLD_VIEWS.length);
    for (const label of labels) expect(label.length).toBeLessThanOrEqual(10);
    expect(Object.keys(HOTBAR_LABELS).sort()).toEqual([...WORLD_VIEWS].sort());
    expect(HOTBAR_LABELS.overview).toBe(WORLD_VIEW_LABELS.overview);
  });
  it('maps number keys to the first ten slots in order and leaves the rest keyless', () => {
    expect(hotbarKey(0)).toBe('1');
    expect(hotbarKey(8)).toBe('9');
    expect(hotbarKey(9)).toBe('0');
    expect(hotbarKey(10)).toBeNull();
    expect(hotbarViewForKey('1')).toBe('overview');
    expect(hotbarViewForKey('0')).toBe(WORLD_VIEWS[9]);
    expect(hotbarViewForKey('5')).toBe(WORLD_VIEWS[4]);
    expect(hotbarViewForKey('x')).toBeNull();
    expect(hotbarViewForKey('3', ['overview', 'café'])).toBeNull();
    expect(HOTBAR_KEYS).toHaveLength(10);
  });
});

describe('keyboard shortcuts', () => {
  it('resolves single keys and ignores browser chords', () => {
    expect(hudShortcut({ key: '2' })).toEqual({ type: 'view', view: 'café' });
    expect(hudShortcut({ key: 'm' })).toEqual({ type: 'map' });
    expect(hudShortcut({ key: 'R' })).toEqual({ type: 'roster' });
    expect(hudShortcut({ key: 'n' })).toEqual({ type: 'night' });
    expect(hudShortcut({ key: 'w' })).toEqual({ type: 'watch' });
    expect(hudShortcut({ key: '?' })).toEqual({ type: 'help' });
    expect(hudShortcut({ key: ' ' })).toEqual({ type: 'play' });
    expect(hudShortcut({ key: 'r', metaKey: true })).toBeNull();
    expect(hudShortcut({ key: '1', ctrlKey: true })).toBeNull();
    expect(hudShortcut({ key: 'n', altKey: true })).toBeNull();
    expect(hudShortcut({ key: 'q' })).toBeNull();
  });
  it('documents every shortcut the HUD handles', () => {
    const text = HUD_SHORTCUT_HELP.map((entry) => entry.keys).join(' ');
    for (const key of ['1', '0', 'M', 'R', 'N', 'W', 'Space', 'Esc', '?', 'Arrows'])
      expect(text).toContain(key);
  });
});

describe('idle dimming', () => {
  it('dims after the delay and only while nothing is open', () => {
    expect(hudIsIdle(1000, 1000 + HUD_IDLE_DELAY - 1)).toBe(false);
    expect(hudIsIdle(1000, 1000 + HUD_IDLE_DELAY)).toBe(true);
    expect(hudDims({ idle: true, paneOpen: false, dialogOpen: false })).toBe(true);
    expect(hudDims({ idle: true, paneOpen: true, dialogOpen: false })).toBe(false);
    expect(hudDims({ idle: true, paneOpen: false, dialogOpen: true })).toBe(false);
    expect(hudDims({ idle: false, paneOpen: false, dialogOpen: false })).toBe(false);
  });
});

describe('roster glyphs', () => {
  it('agrees with the world counts and keeps attention ahead of uncertainty', () => {
    const agents = initialAgents();
    const counts = worldCounts(agents);
    const glyphs = agents.map((agent) => rosterGlyph(agent));
    expect(glyphs.filter((g) => g === 'working')).toHaveLength(counts.working);
    expect(glyphs.filter((g) => g === 'attention')).toHaveLength(counts.attention);
    expect(glyphs.filter((g) => g === 'completed')).toHaveLength(counts.completed);
    const paused = agents.map((agent) => rosterGlyph(agent, true));
    expect(paused.filter((g) => g === 'attention')).toHaveLength(counts.attention);
    expect(paused.filter((g) => g === 'working')).toHaveLength(0);
    expect(paused.filter((g) => g === 'unknown')).toHaveLength(agents.length - counts.attention);
  });
  it('labels stale or paused rows as last known rather than inventing a status', () => {
    const [agent] = initialAgents();
    expect(rosterStatusLabel(agent)).toBe('Working');
    expect(rosterStatusLabel(agent, true)).toBe('Last known: Working');
    expect(rosterStatusLabel({ ...agent, telemetryStale: true })).toBe('Last known: Working');
    expect(rosterGlyph({ ...agent, telemetryStale: true })).toBe('unknown');
    expect(rosterGlyph({ ...agent, status: 'disconnected' })).toBe('unknown');
    expect(rosterGlyph({ ...agent, status: 'failed' })).toBe('attention');
    expect(rosterGlyph({ ...agent, status: 'idle' })).toBe('idle');
  });
});

describe('layout and dismissal', () => {
  it('collapses the roster to a chip on phones only', () => {
    expect(rosterCollapses(390)).toBe(true);
    expect(rosterCollapses(600)).toBe(true);
    expect(rosterCollapses(601)).toBe(false);
    expect(rosterCollapses(1440)).toBe(false);
  });
  it('unwinds Escape one layer at a time', () => {
    const all = { watchMode: true, following: true, selected: true, paneOpen: true };
    expect(escapeTarget(all)).toBe('watch');
    expect(escapeTarget({ ...all, watchMode: false })).toBe('follow');
    expect(escapeTarget({ ...all, watchMode: false, following: false })).toBe('selection');
    expect(
      escapeTarget({ watchMode: false, following: false, selected: false, paneOpen: true }),
    ).toBe('pane');
    expect(
      escapeTarget({ watchMode: false, following: false, selected: false, paneOpen: false }),
    ).toBeNull();
  });
});
