import { describe, it, expect } from 'vitest';
import { reduceAgentEvent, validateEvent } from './shared/protocol.mjs';
import { attentionFor, safeWorkUrl } from './shared/work.mjs';
import { mergeSessions, seatLatestSessions } from './shared/live.mjs';
import { filterResidents } from './sessions';
import type { Agent, AgentEvent } from './state';
const event = (
  sequence: number,
  type: AgentEvent['type'] = 'waiting',
  work?: AgentEvent['work'],
): AgentEvent => ({
  id: 'e' + sequence,
  sequence,
  type,
  timestamp: sequence * 1000,
  sessionId: 's',
  agentId: 'main',
  provider: 'Custom',
  work,
});
const apply = (
  agents: Agent[],
  sequence: number,
  type: AgentEvent['type'] = 'waiting',
  work?: AgentEvent['work'],
) => reduceAgentEvent(agents, validateEvent(event(sequence, type, work)));
describe('real-work evidence', () => {
  it('keeps first attention time through repeats and uncertainty, resolves only on progress', () => {
    const first = apply([], 1);
    const repeat = apply(first, 2);
    expect(repeat[0].attention?.since).toBe(1000);
    expect(repeat[0].attention?.id).toBe('e1');
    const unknown = apply(repeat, 3, 'unknown');
    expect(attentionFor(unknown[0])?.id).toBe('e1');
    expect(attentionFor(apply(repeat, 3, 'unknown', { runId: 'new-but-unconfirmed' })[0])?.id).toBe(
      'e1',
    );
    expect(filterResidents(unknown, [], 'attention')).toHaveLength(1);
    const resumed = apply(unknown, 4, 'working');
    expect(attentionFor(resumed[0])).toBeUndefined();
    expect(apply(resumed, 5)[0].attention?.id).toBe('e5');
    expect(apply(resumed, 2)).toBe(resumed);
  });
  it('distinguishes explicit requests and new runs, without carrying stale outcome text', () => {
    const first = apply([], 1, 'waiting', {
      runId: 'r1',
      objective: 'Build sign in',
      request: { id: 'q1', kind: 'approval', message: 'Choose a target' },
    });
    const repeat = apply(first, 2, 'waiting', { request: { id: 'q1', kind: 'approval' } });
    expect(repeat[0].attention?.id).toBe('e1');
    expect(repeat[0].attention?.message).toBe('Choose a target');
    expect(
      apply(repeat, 3, 'waiting', { request: { id: 'q2', kind: 'input' } })[0].attention?.id,
    ).toBe('e3');
    expect(
      apply(repeat, 3, 'waiting', { runId: 'r2', request: { id: 'q1', kind: 'input' } })[0]
        .attention?.id,
    ).toBe('e3');
    const done = apply(first, 2, 'completed', {
      result: { summary: 'Draft prepared', url: 'https://example.com/draft' },
    });
    expect(done[0].work?.result?.summary).toBe('Draft prepared');
    const next = apply(done, 3, 'working');
    expect(next[0].work?.result).toBeUndefined();
    expect(next[0].work?.objective).toBe('Build sign in');
  });
  it('rejects active content, credentials, bad shapes, oversized text and incompatible metadata', () => {
    for (const url of [
      'javascript:alert(1)',
      'file:///tmp/test',
      'data:text/html,hi',
      'https://user:pass@example.com',
      'http://example.com',
    ]) {
      expect(safeWorkUrl(url)).toBeUndefined();
      expect(() => validateEvent(event(1, 'working', { sourceUrl: url }))).toThrow();
    }
    expect(() => validateEvent(event(1, 'working', { objective: 'x'.repeat(301) }))).toThrow();
    expect(() =>
      validateEvent(event(1, 'working', { request: { id: 'q', kind: 'input' } })),
    ).toThrow();
    expect(() => validateEvent(event(1, 'waiting', { result: { summary: 'Done' } }))).toThrow();
    expect(
      validateEvent({ ...event(1), work: { objective: 'Safe', secret: 'omit' } }).work,
    ).toEqual({ objective: 'Safe' });
  });
  it('preserves uncertain attention when history supersedes telemetry but clears on newer completion', () => {
    const original = apply([], 1);
    const history = {
      ...original[0],
      status: 'unknown' as const,
      evidence: 'history' as const,
      updatedAt: 5000,
      observedAt: 5000,
      attention: undefined,
      work: undefined,
    };
    expect(attentionFor(mergeSessions(original, [history])[0])?.id).toBe('e1');
    expect(
      attentionFor(mergeSessions(original, [{ ...history, status: 'completed' }])[0]),
    ).toBeUndefined();
  });
  it('promotes old attention without evicting pins or unhiding sessions', () => {
    const agents = Array.from(
      { length: 12 },
      (_, i) =>
        reduceAgentEvent([], {
          ...event(1, i === 0 || i === 1 ? 'waiting' : 'working'),
          sessionId: 's' + i,
          timestamp: i * 1000,
        })[0],
    );
    const hidden = JSON.stringify(['Custom', 's0']);
    const pin = JSON.stringify(['Custom', 's2']);
    const seated = seatLatestSessions(agents, [], {
      pinned: [pin],
      hidden: [hidden],
      attentionFirst: true,
    });
    expect(seated.find((a) => a.sessionId === 's1')!.seat).toBeLessThan(8);
    expect(seated.find((a) => a.sessionId === 's2')!.seat).toBeLessThan(8);
    expect(seated.find((a) => a.sessionId === 's0')!.seat).toBe(8);
    expect(filterResidents(seated, [hidden], 'attention')).toHaveLength(2);
    const pins = agents.slice(4).map((a) => JSON.stringify(['Custom', a.sessionId]));
    expect(
      seatLatestSessions(agents, [], { pinned: pins, hidden: [], attentionFirst: true }).find(
        (a) => a.sessionId === 's1',
      )!.seat,
    ).toBe(8);
  });
});
