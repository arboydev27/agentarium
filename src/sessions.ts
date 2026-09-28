import { sessionKey } from './shared/live.mjs';
export { sessionKey } from './shared/live.mjs';
import type { Agent } from './state';

// Older persisted snapshots predate the explicit sessionId field.
export function agentSessionId(agent: Agent): string {
  if (agent.sessionId) return agent.sessionId;
  const separator = agent.id.lastIndexOf(':');
  return separator > 0 ? agent.id.slice(0, separator) : 'Unknown session';
}

export function summarizeSessions(agents: Agent[]) {
  const sessions = new Map<
    string,
    { id: string; count: number; needsAttention: number; label: string }
  >();
  for (const agent of agents) {
    const id = sessionKey(agent);
    const session = sessions.get(id) ?? {
      id,
      count: 0,
      needsAttention: 0,
      label: `${agent.provider} · ${agentSessionId(agent)}`,
    };
    session.count++;
    if (agent.status === 'waiting' || agent.status === 'failed') session.needsAttention++;
    sessions.set(id, session);
  }
  return [...sessions.values()];
}

export type SessionView = 'visible' | 'attention' | 'hidden';
export function filterResidents(agents: Agent[], hidden: string[], view: SessionView, filter = '') {
  const hiddenKeys = new Set(hidden);
  return agents.filter((agent) => {
    if (filter && sessionKey(agent) !== filter) return false;
    if (view === 'attention') return agent.status === 'waiting' || agent.status === 'failed';
    return hiddenKeys.has(sessionKey(agent)) === (view === 'hidden');
  });
}
