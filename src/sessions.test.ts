import { describe, expect, it } from 'vitest';
import { reduceAgentEvent } from './state';
import { agentSessionId, summarizeSessions } from './sessions';

const event = {
  id: 'one',
  agentId: 'main',
  sessionId: 'first',
  type: 'working' as const,
  timestamp: 1000,
  sequence: 1,
};

describe('session summaries', () => {
  it('keeps explicit session identity and summarizes attention across residents', () => {
    let agents = reduceAgentEvent([], event);
    agents = reduceAgentEvent(agents, { ...event, agentId: 'child', type: 'waiting' });
    agents = reduceAgentEvent(agents, { ...event, sessionId: 'second', type: 'failed' });
    expect(summarizeSessions(agents)).toEqual([
      {
        id: JSON.stringify(['Custom', 'first']),
        label: 'Custom · first',
        count: 2,
        needsAttention: 1,
      },
      {
        id: JSON.stringify(['Custom', 'second']),
        label: 'Custom · second',
        count: 1,
        needsAttention: 1,
      },
    ]);
  });
  it('supports older snapshots and upgrades them on the next event', () => {
    const [agent] = reduceAgentEvent([], event);
    delete agent.sessionId;
    agent.id = 'first:main';
    expect(agentSessionId(agent)).toBe('first');
    expect(reduceAgentEvent([], { ...event, sequence: 2 })[0].sessionId).toBe('first');
  });
  it('does not invent a session for a legacy ID without a separator', () => {
    const [agent] = reduceAgentEvent([], event);
    delete agent.sessionId;
    agent.id = 'legacy';
    expect(agentSessionId(agent)).toBe('Unknown session');
  });
  it('prefers explicit identity when IDs contain separators', () => {
    const [agent] = reduceAgentEvent([], { ...event, agentId: 'child:one' });
    expect(agentSessionId(agent)).toBe('first');
  });
});
