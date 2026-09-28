import { create } from 'zustand';
import { seatLatestSessions } from './shared/live.mjs';
import { reduceAgentEvent, validateEvent, agentKey, normalizeAgent } from './shared/protocol.mjs';
export { reduceAgentEvent } from './shared/protocol.mjs';
export type Status =
  'idle' | 'working' | 'tool' | 'waiting' | 'completed' | 'failed' | 'disconnected' | 'unknown';
export type Provider = 'Codex' | 'Claude' | 'Gemini' | 'Custom';
export type Agent = {
  id: string;
  sessionId?: string;
  agentId?: string;
  evidence?: 'history' | 'event';
  observedAt?: number;
  name: string;
  provider: Provider;
  color: string;
  status: Status;
  task: string;
  zone: string;
  seat: number;
  updatedAt: number;
  startedAt: number;
  parentId?: string;
  sequence: number;
  source: 'demo' | 'live';
};
export type AgentEvent = {
  id: string;
  agentId: string;
  sessionId: string;
  sequence: number;
  timestamp: number;
  type: Status;
  name?: string;
  provider?: Provider;
  task?: string;
  parentId?: string;
};
export type Activity = { id: string; name: string; message: string; time: number; status: Status };
export const STATUS_LABEL: Record<Status, string> = {
  idle: 'On a break',
  working: 'Working',
  tool: 'Using a tool',
  waiting: 'Needs you',
  completed: 'Completed',
  failed: 'Needs attention',
  disconnected: 'Disconnected',
  unknown: 'Activity unknown',
};
export const COLORS = [
  '#eeb960',
  '#c6a0e8',
  '#8dcbb9',
  '#ef917b',
  '#8ebbe2',
  '#b8c774',
  '#e3afd2',
  '#d9cba3',
];
export const NAMES = ['Milo', 'Juniper', 'Atlas', 'Cleo', 'Nova', 'Sage', 'Pip', 'Wren'];
export const TASKS = [
  'Building the new homepage',
  'Reviewing the authentication flow',
  'Researching design references',
  'Writing integration tests',
  'Refining the mobile layout',
  'Checking accessibility',
  'Exploring the codebase',
  'Summarizing project notes',
];
const zones = ['Café', 'Café', 'Garden', 'Garden', 'Studio', 'Studio', 'Courtyard', 'Courtyard'];
export function initialAgents(): Agent[] {
  return NAMES.map((name, i) => ({
    id: 'demo-' + i,
    name,
    provider: (['Codex', 'Claude', 'Gemini'] as Provider[])[i % 3],
    color: COLORS[i],
    status: i === 0 || i === 2 ? 'working' : i === 1 ? 'tool' : i === 4 ? 'waiting' : 'idle',
    task: i < 5 ? TASKS[i] : 'Ready for the next idea',
    zone: zones[i],
    seat: i,
    updatedAt: Date.now(),
    startedAt: Date.now() - [42000, 68000, 24000, 0, 51000, 0, 0, 0][i],
    sequence: 0,
    source: 'demo',
  }));
}
export type DiscoveryProvider = {
  provider: 'Codex' | 'Claude' | 'Gemini';
  enabled: boolean;
  state: 'disabled' | 'scanning' | 'ready' | 'empty' | 'unavailable' | 'error';
  count: number;
  detail: string;
  checkedAt?: number;
};
type State = {
  agents: Agent[];
  selected: string | null;
  events: Activity[];
  mode: 'demo' | 'live';
  playing: boolean;
  speed: number;
  night: boolean;
  reducedMotion: boolean;
  quality: 'high' | 'low';
  labels: boolean;
  camera: 'overview' | 'café' | 'garden' | 'studio';
  cameraVersion: number;
  cinematic: boolean;
  bridgeStatus: 'offline' | 'connecting' | 'connected';
  bridgeError: string | null;
  receivedEvents: number;
  lastReceivedAt: number | null;
  receivedProviders: Provider[];
  discoverySupported: boolean;
  discoveryProviders: DiscoveryProvider[];
  seen: Set<string>;
  select: (id: string | null) => void;
  set: (s: Partial<State>) => void;
  setStatus: (id: string, status: Status) => void;
  spawn: (parent?: string) => void;
  reset: () => void;
  tick: () => void;
  ingest: (e: AgentEvent) => void;
  hydrate: (a: Agent[]) => void;
  syncSessions: (a: Agent[]) => void;
  switchMode: (m: 'demo' | 'live') => void;
};
export const useWorld = create<State>((set, get) => ({
  agents: initialAgents(),
  selected: null,
  events: [
    {
      id: 'welcome',
      name: 'The grove',
      message: 'A new day of ideas. The demo is running.',
      time: Date.now(),
      status: 'idle',
    },
  ],
  mode: 'demo',
  playing: true,
  speed: 1,
  night: false,
  reducedMotion:
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  quality: 'high',
  labels: true,
  camera: 'overview',
  cameraVersion: 0,
  cinematic: false,
  bridgeStatus: 'offline',
  bridgeError: null,
  receivedEvents: 0,
  lastReceivedAt: null,
  receivedProviders: [],
  discoverySupported: false,
  discoveryProviders: [],
  seen: new Set(),
  set: (s) => set(s),
  select: (id) => set({ selected: id }),
  setStatus: (id, status) => {
    if (get().mode !== 'demo') return;
    const a = get().agents.find((a) => a.id === id);
    if (!a) return;
    set((s) => ({
      agents: s.agents.map((x) =>
        x.id === id
          ? {
              ...x,
              status,
              updatedAt: Date.now(),
              startedAt: status === 'working' ? Date.now() : x.startedAt,
              task: status === 'working' ? TASKS[x.seat % 8] : x.task,
            }
          : x,
      ),
      events: [
        {
          id: crypto.randomUUID(),
          name: a.name,
          message:
            status === 'working'
              ? 'Started ' + TASKS[a.seat % 8].toLowerCase()
              : STATUS_LABEL[status],
          time: Date.now(),
          status,
        },
        ...s.events,
      ].slice(0, 40),
    }));
  },
  spawn: (parent) => {
    if (get().mode !== 'demo') return;
    const idle = get().agents.find((a) => a.status === 'idle' || a.status === 'completed');
    if (!idle) return;
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === idle.id
          ? {
              ...a,
              parentId: parent,
              status: 'working',
              task: parent
                ? 'Helping with ' +
                  (s.agents.find((x) => x.id === parent)?.task.toLowerCase() || 'a task')
                : TASKS[a.seat % 8],
              startedAt: Date.now(),
              updatedAt: Date.now(),
            }
          : a,
      ),
      selected: idle.id,
      events: [
        {
          id: crypto.randomUUID(),
          name: idle.name,
          message: parent ? 'Joined a task as a subagent' : 'Opened a laptop and started a task',
          time: Date.now(),
          status: 'working' as Status,
        },
        ...s.events,
      ].slice(0, 40),
    }));
  },
  reset: () =>
    set({
      agents: initialAgents(),
      selected: null,
      events: [],
      mode: 'demo',
      playing: true,
      bridgeError: null,
      receivedEvents: 0,
      lastReceivedAt: null,
      receivedProviders: [],
      discoverySupported: false,
      discoveryProviders: [],
      seen: new Set(),
    }),
  tick: () => {
    const s = get();
    if (!s.playing || s.mode !== 'demo') return;
    const a = s.agents[Math.floor(Math.random() * s.agents.length)];
    const next: Status =
      a.status === 'working'
        ? 'tool'
        : a.status === 'tool'
          ? Math.random() > 0.75
            ? 'waiting'
            : 'completed'
          : a.status === 'waiting'
            ? 'waiting'
            : a.status === 'completed'
              ? 'idle'
              : a.status === 'idle'
                ? 'working'
                : a.status;
    s.setStatus(a.id, next);
  },
  ingest: (input) => {
    let e: AgentEvent;
    try {
      e = validateEvent(input);
    } catch {
      return;
    }
    const s = get();
    if (s.mode !== 'live' || s.seen.has(e.id)) return;
    const next = reduceAgentEvent(s.agents, e);
    if (next === s.agents) return;
    const seen = new Set(s.seen);
    seen.add(e.id);
    if (seen.size > 3000) seen.delete(seen.values().next().value!);
    set({
      agents: seatLatestSessions(next, s.agents),
      receivedEvents: s.receivedEvents + 1,
      lastReceivedAt: Date.now(),
      receivedProviders: [
        ...new Set([
          ...s.receivedProviders,
          next.find((a) => a.id === agentKey(e.provider, e.sessionId, e.agentId))!.provider,
        ]),
      ],
      seen,
      events: [
        {
          id: e.id,
          name:
            e.name ||
            next.find((a) => a.id === agentKey(e.provider, e.sessionId, e.agentId))?.name ||
            'Agent',
          message: STATUS_LABEL[e.type],
          time: e.timestamp,
          status: e.type,
        },
        ...s.events,
      ].slice(0, 40),
    });
  },
  hydrate: (agents) =>
    set({
      agents: seatLatestSessions(agents.map(normalizeAgent), get().agents),
      bridgeStatus: 'connected',
      bridgeError: null,
      receivedEvents: 0,
      lastReceivedAt: null,
      receivedProviders: [],
      discoverySupported: false,
      discoveryProviders: [],
    }),
  syncSessions: (agents) => {
    const s = get();
    if (s.mode !== 'live') return;
    const next = seatLatestSessions(agents.map(normalizeAgent), s.agents);
    set({ agents: next, selected: next.some((a) => a.id === s.selected) ? s.selected : null });
  },
  switchMode: (mode) =>
    set({
      mode,
      agents: mode === 'demo' ? initialAgents() : [],
      selected: null,
      events: [],
      bridgeError: null,
      receivedEvents: 0,
      lastReceivedAt: null,
      receivedProviders: [],
      discoverySupported: false,
      discoveryProviders: [],
      seen: new Set(),
      bridgeStatus: 'offline',
      playing: mode === 'demo',
    }),
}));
