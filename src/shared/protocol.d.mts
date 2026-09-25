import type {Agent,AgentEvent} from '../state';
export const STATUSES:string[];
export const PROVIDERS:string[];
export const COLORS:string[];
export function validateEvent(input:unknown):AgentEvent;
export function reduceAgentEvent(agents:Agent[],event:AgentEvent):Agent[];
