import type { Agent, AgentEvent, AttentionItem, WorkContext } from '../state';
export function safeWorkUrl(value: unknown): string | undefined;
export function validateWork(value: unknown): WorkContext;
export function attentionFor(agent: Agent): AttentionItem | undefined;
export function workUpdate(
  old: Agent | undefined,
  event: AgentEvent,
): { attention?: AttentionItem; work: WorkContext };
