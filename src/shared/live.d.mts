import type { Agent } from '../state';
export function sessionKey(agent: Agent): string;
export function mergeSessions(telemetry: Agent[], discovered: Agent[]): Agent[];
export function seatLatestSessions(
  agents: Agent[],
  previous?: Agent[],
  preferences?: { pinned: string[]; hidden: string[]; attentionFirst?: boolean },
): Agent[];
