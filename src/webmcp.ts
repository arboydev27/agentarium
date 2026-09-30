import { useWorld, STATUS_LABEL } from './state';
import type { Status } from './state';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
export function registerWorldTools() {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (tool: Tool, options: { signal: AbortSignal }) => Promise<void> | void;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const object = (input: unknown): Record<string, unknown> => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('Expected an object');
    return input as Record<string, unknown>;
  };
  const tools: Tool[] = [
    {
      name: 'grove_list_agents',
      description:
        'Read the displayed agents and whether their source is simulation or a live bridge.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => {
        const s = useWorld.getState();
        return {
          mode: s.mode,
          agents: s.agents.map(({ id, name, provider, status, task, parentId }) => ({
            id,
            name,
            provider,
            status,
            task,
            parentId,
          })),
        };
      },
    },
    {
      name: 'grove_spawn_demo_task',
      description: 'Start a simulated task using an idle resident. Does not run a real AI agent.',
      inputSchema: {
        type: 'object',
        properties: { parentId: { type: 'string' } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        const p = object(input),
          s = useWorld.getState();
        if (s.mode !== 'demo') throw new Error('Available only in simulation');
        if (
          p.parentId !== undefined &&
          (typeof p.parentId !== 'string' || !s.agents.some((a) => a.id === p.parentId))
        )
          throw new Error('Unknown parent agent');
        if (!s.agents.some((a) => a.status === 'idle' || a.status === 'completed'))
          throw new Error('All residents are busy');
        s.spawn(p.parentId as string | undefined);
        return { agentId: useWorld.getState().selected, status: 'working', simulated: true };
      },
    },
    {
      name: 'grove_set_demo_status',
      description: 'Change one simulated agent’s status and corresponding character behavior.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          status: { type: 'string', enum: Object.keys(STATUS_LABEL) },
        },
        required: ['agentId', 'status'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        const p = object(input),
          s = useWorld.getState();
        if (s.mode !== 'demo') throw new Error('Available only in simulation');
        if (typeof p.agentId !== 'string' || !s.agents.some((a) => a.id === p.agentId))
          throw new Error('Unknown agent');
        if (typeof p.status !== 'string' || !Object.hasOwn(STATUS_LABEL, p.status))
          throw new Error('Invalid status');
        s.setStatus(p.agentId, p.status as Status);
        return { agentId: p.agentId, status: p.status, simulated: true };
      },
    },
    {
      name: 'grove_change_view',
      description: 'Move the camera to an overview or a named part of the grove.',
      inputSchema: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['overview', 'café', 'garden', 'studio', 'courtyard'] },
        },
        required: ['view'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        const p = object(input);
        if (!['overview', 'café', 'garden', 'studio', 'courtyard'].includes(p.view as string))
          throw new Error('Unknown view');
        useWorld.setState((s) => ({
          camera: p.view as typeof s.camera,
          cameraVersion: s.cameraVersion + 1,
          followAgent: null,
        }));
        return { view: p.view };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(
        () => {},
      );
    } catch {
      /* Optional API is not available in all browsers. */
    }
  }
  return () => lifecycle.abort();
}
