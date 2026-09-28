import { describe, expect, it } from 'vitest';
import { initialAgents } from '../state';
import { ResidentMotion, routeForSeat, routeLengths, routePoint } from './motion';
const options = { reduced: false, playing: true, leaving: false, now: 10000 };
function resident(status = 'working' as ReturnType<typeof initialAgents>[number]['status']) {
  return { ...initialAgents()[0], status, updatedAt: 10000, observedAt: 10000 };
}
function advance(m: ResidentMotion, agent = resident(), seconds = 6, overrides = {}) {
  for (let i = 0; i < seconds * 60; i++) m.update(agent, 1 / 60, { ...options, ...overrides });
}
describe('resident movement and evidence', () => {
  it('arrives and settles into the desk, then rests after completion', () => {
    const m = new ResidentMotion(0);
    advance(m);
    expect(m.sitting).toBe(1);
    expect(m.clip(resident())).toBe('DeskType');
    const done = resident('completed');
    advance(m, done, 4);
    expect(m.distance).toBe(m.lengths[1]);
    expect(m.sitting).toBe(0);
    advance(m, done, 4);
    expect(m.clip(done)).toBe('Rest');
    advance(m, done, 4);
    expect(m.celebration).toBe(0);
  });
  it('reverses an interrupted route continuously without cutting corners', () => {
    const m = new ResidentMotion(0);
    advance(m, resident(), 1.4);
    let previous = m.position;
    for (let i = 0; i < 120; i++) {
      m.update(resident('idle'), 1 / 60, options);
      const next = m.position;
      expect(Math.hypot(...next.map((v, j) => v - previous[j]))).toBeLessThan(0.025);
      previous = next;
    }
    expect(m.distance).toBe(m.lengths[1]);
    advance(m);
    expect(m.sitting).toBe(1);
  });
  it('uses static destination poses for reduced motion, including departure', () => {
    const m = new ResidentMotion(4);
    m.update(resident('waiting'), 1 / 60, { ...options, reduced: true });
    expect(m.sitting).toBe(1);
    expect(m.clip(resident('waiting'))).toBe('DeskWait');
    m.update(resident(), 1 / 60, { ...options, reduced: true, leaving: true });
    expect(m.exited).toBe(true);
  });
  it('pauses movement and gesture clocks while preserving visible placement', () => {
    const m = new ResidentMotion(0);
    advance(m);
    const p = m.position,
      t = m.elapsed;
    advance(m, resident(), 3, { playing: false });
    expect(m.position).toEqual(p);
    expect(m.elapsed).toBe(t);
    const startup = new ResidentMotion(1);
    startup.update(resident(), 0, { ...options, playing: false });
    expect(startup.opacity).toBe(1);
    expect(startup.sitting).toBe(1);
  });
  it('does not celebrate old, unknown, or stale evidence', () => {
    for (const a of [
      { ...resident('completed'), observedAt: 1 },
      resident('unknown'),
      { ...resident('completed'), telemetryStale: true },
    ]) {
      const m = new ResidentMotion(0);
      advance(m, a, 5, { now: 100000 });
      expect(m.celebration).toBe(0);
    }
  });
  it('departs fully even when live work updates are paused', () => {
    const m = new ResidentMotion(0);
    advance(m);
    advance(m, resident(), 6, { playing: false, leaving: true });
    expect(m.exited).toBe(true);
    expect(m.opacity).toBe(0);
  });
  it('keeps each route on its floor and bounds positions during large frame gaps', () => {
    for (let seat = 0; seat < 8; seat++) {
      const route = routeForSeat(seat),
        lengths = routeLengths(route);
      expect(new Set(route.map((p) => p[1])).size).toBe(1);
      expect(routePoint(route, lengths, -1)).toEqual(route[0]);
      expect(routePoint(route, lengths, 100)).toEqual(route.at(-1));
      const m = new ResidentMotion(seat);
      m.update(resident(), 100, options);
      expect(m.distance).toBeLessThan(0.06);
    }
  });
});
