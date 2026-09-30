import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectBridge, disconnectBridge } from './bridge';
import { useWorld } from './state';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen = () => {};
  onmessage = (_: { data: string }) => {};
  onclose = (_: { code: number }) => {};
  onerror = () => {};
  send = vi.fn();
  close = vi.fn();
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  message(data: unknown) {
    this.onmessage({ data: JSON.stringify(data) });
  }
}

describe('bridge connection lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    FakeSocket.instances = [];
    useWorld.getState().switchMode('demo');
  });
  afterEach(() => {
    disconnectBridge();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it('authenticates before accepting a snapshot without claiming new activity', () => {
    connectBridge('ws://127.0.0.1:4318', ' token ');
    const ws = FakeSocket.instances[0];
    ws.onopen();
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'authenticate', token: 'token' }));
    expect(useWorld.getState().bridgeStatus).toBe('connecting');
    ws.message({ type: 'snapshot', agents: [] });
    expect(useWorld.getState().bridgeStatus).toBe('connected');
    expect(useWorld.getState().receivedEvents).toBe(0);
  });
  it('preserves reported task states and attention during disconnect and reconnect', () => {
    connectBridge('ws://127.0.0.1:4318', 'token');
    const ws = FakeSocket.instances[0];
    ws.message({ type: 'snapshot', agents: [] });
    for (const [i, type] of ['working', 'waiting', 'failed'].entries())
      ws.message({
        type: 'event',
        event: {
          id: `e${i}`,
          sessionId: `s${i}`,
          agentId: 'main',
          provider: 'Codex',
          sequence: 1,
          timestamp: 1000,
          type,
        },
      });
    const before = useWorld.getState().agents;
    ws.onclose({ code: 1006 });
    expect(useWorld.getState().agents).toBe(before);
    expect(useWorld.getState().bridgeStatus).toBe('offline');
    vi.advanceTimersByTime(1000);
    FakeSocket.instances[1].message({ type: 'snapshot', agents: before });
    expect(useWorld.getState().agents.map((a) => a.status)).toEqual(before.map((a) => a.status));
    expect(useWorld.getState().bridgeStatus).toBe('connected');
  });
  it('explains rejected authentication and does not automatically retry it', () => {
    connectBridge('ws://127.0.0.1:4318', 'wrong');
    FakeSocket.instances[0].onclose({ code: 4003 });
    expect(useWorld.getState().bridgeError).toContain('Authentication failed');
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
  it('retries a dropped connection but cancels retries on explicit disconnect', () => {
    connectBridge('ws://127.0.0.1:4318', 'token');
    FakeSocket.instances[0].onclose({ code: 1006 });
    expect(useWorld.getState().bridgeError).toContain('Retrying automatically');
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].onclose({ code: 1006 });
    disconnectBridge();
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});

it('advertises work features per bridge and falls back when an old bridge reconnects', () => {
  vi.stubGlobal('WebSocket', FakeSocket);
  try {
    connectBridge('ws://127.0.0.1:4318', 'token');
    const ws = FakeSocket.instances.at(-1)!;
    ws.message({
      type: 'snapshot',
      agents: [],
      bridgeId: 'database-one',
      protocolVersion: 2,
      capabilities: { richContext: true, history: true },
    });
    expect(useWorld.getState().bridgeId).toBe('database-one');
    expect(useWorld.getState().historySupported).toBe(true);
    ws.message({ type: 'snapshot', agents: [] });
    expect(useWorld.getState().bridgeId).toBeNull();
    expect(useWorld.getState().richContext).toBe(false);
    expect(useWorld.getState().historySupported).toBe(false);
  } finally {
    disconnectBridge();
    vi.unstubAllGlobals();
  }
});
