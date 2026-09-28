import { useWorld } from './state';
let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;
let current: { url: string; token: string } | null = null;
export function disconnectBridge() {
  current = null;
  clearTimeout(retry);
  const old = socket;
  socket = null;
  old?.close();
  useWorld.setState({ bridgeStatus: 'offline', bridgeError: null });
}
export function connectBridge(url: string, token: string) {
  const parsed = new URL(url);
  if (!['ws:', 'wss:'].includes(parsed.protocol))
    throw new Error('Use a ws:// or wss:// bridge address.');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname))
    throw new Error('This version connects only to a local bridge.');
  if (!token.trim()) throw new Error('Paste the session token from the bridge terminal.');
  disconnectBridge();
  current = { url, token: token.trim() };
  attempt = 0;
  useWorld.getState().switchMode('live');
  open();
}
function open() {
  if (!current) return;
  useWorld.setState({ bridgeStatus: 'connecting', bridgeError: null });
  const ws = new WebSocket(current.url);
  socket = ws;
  ws.onopen = () => {
    if (socket !== ws || !current) return;
    ws.send(JSON.stringify({ type: 'authenticate', token: current.token }));
  };
  ws.onmessage = (message) => {
    if (socket !== ws) return;
    try {
      const data = JSON.parse(message.data);
      if (data.type === 'snapshot') {
        attempt = 0;
        useWorld.getState().hydrate(data.agents);
        useWorld.setState({
          discoverySupported: data.discoverySupported === true,
          discoveryProviders: data.providers || [],
        });
      } else if (data.type === 'event') {
        useWorld.getState().ingest(data.event);
      } else if (data.type === 'sessions') {
        useWorld.getState().syncSessions(data.agents);
        useWorld.setState({ discoveryProviders: data.providers || [] });
      } else if (data.type === 'discoveryError') {
        useWorld.setState({
          bridgeError: 'Local discovery request failed. Reconnect and try again.',
        });
      } else if (data.type === 'error') {
        useWorld.setState({ bridgeStatus: 'offline' });
      }
    } catch {
      /* Ignore malformed transport messages. */
    }
  };
  ws.onerror = () => {};
  ws.onclose = (e) => {
    if (socket !== ws) return;
    useWorld.setState((s) => ({
      bridgeStatus: 'offline',
      bridgeError:
        e.code === 4003
          ? 'Authentication failed. Paste the token from the current bridge process and reconnect.'
          : 'Connection lost. Retrying automatically. Check the bridge process, address, and allowed browser origin.',
      agents: s.agents.map((a) => ({ ...a, status: 'disconnected' })),
    }));
    if (current && e.code !== 4003) {
      retry = setTimeout(open, Math.min(30000, 1000 * 2 ** attempt++));
    }
  };
}

export function configureDiscovery(providers: string[]) {
  if (!socket || useWorld.getState().bridgeStatus !== 'connected')
    throw new Error('Connect the bridge first.');
  if (!useWorld.getState().discoverySupported)
    throw new Error('Restart npm run bridge to enable local discovery.');
  socket.send(JSON.stringify({ type: 'discover', providers }));
}
