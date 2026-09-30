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
          bridgeId: typeof data.bridgeId === 'string' ? data.bridgeId : null,
          richContext: data.capabilities?.richContext === true,
          historySupported: data.capabilities?.history === true,
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
    useWorld.setState({
      bridgeStatus: 'offline',
      bridgeError:
        e.code === 4003
          ? 'Authentication failed. Paste the token from the current bridge process and reconnect.'
          : 'Connection lost. Retrying automatically. Check the bridge process, address, and allowed browser origin.',
    });
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

export async function fetchHistory(after: number, until?: number, signal?: AbortSignal) {
  if (!current || useWorld.getState().bridgeStatus !== 'connected')
    throw new Error('Connect the bridge to load the recap.');
  const connection = current;
  const url = new URL('/history', connection.url);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.searchParams.set('after', String(after));
  if (until !== undefined) url.searchParams.set('until', String(until));
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + connection.token },
    signal,
  });
  if (!response.ok)
    throw new Error('Could not load history. Reconnect or check the bridge version.');
  const page = await response.json();
  if (current !== connection || page.bridgeId !== useWorld.getState().bridgeId)
    throw new Error('The bridge changed. Refresh the recap.');
  return page;
}
