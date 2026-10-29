import { describe, expect, it } from 'vitest';
import { orbitalZoomDestination, useUniverse } from './universe';
import { useWorld } from '../state';

describe('world scales', () => {
  it('crosses adjacent zoom boundaries and keeps entry distances stable', () => {
    expect(orbitalZoomDestination('planet', 30)).toBe('system');
    expect(orbitalZoomDestination('planet', 5)).toBe('colony');
    expect(orbitalZoomDestination('system', 20)).toBe('planet');
    expect(orbitalZoomDestination('planet', 13)).toBe('planet');
    expect(orbitalZoomDestination('system', 86)).toBe('system');
  });
  it('does not mutate session state or surface camera when changing scale', () => {
    const before = useWorld.getState();
    useUniverse.getState().setScale('planet');
    useUniverse.getState().setScale('system');
    useUniverse.getState().setScale('colony');
    expect(useWorld.getState()).toBe(before);
  });
});
