import type { Agent } from './state';

// Older persisted snapshots predate the explicit sessionId field.
export function agentSessionId(agent: Agent): string {
  if (agent.sessionId) return agent.sessionId;
  const separator = agent.id.lastIndexOf(':');
  return separator > 0 ? agent.id.slice(0, separator) : 'Unknown session';
}

export function summarizeSessions(agents: Agent[]) {
  const sessions = new Map<string, { id: string; count: number; needsAttention: number }>();
  for (const agent of agents) {
    const id = agentSessionId(agent);
    const session = sessions.get(id) ?? { id, count: 0, needsAttention: 0 };
    session.count++;
    if (agent.status === 'waiting' || agent.status === 'failed') session.needsAttention++;
    sessions.set(id, session);
  }
  return [...sessions.values()];
}
