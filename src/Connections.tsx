import { useState } from 'react';
import { Radio } from 'lucide-react';
import { useWorld } from './state';
export function Connections({ notify }: { notify: (s: string) => void }) {
  const mode = useWorld((s) => s.mode);
  const status = useWorld((s) => s.bridgeStatus);
  const bridgeError = useWorld((s) => s.bridgeError);
  const receivedEvents = useWorld((s) => s.receivedEvents);
  const lastReceivedAt = useWorld((s) => s.lastReceivedAt);
  const receivedProviders = useWorld((s) => s.receivedProviders);
  const residentCount = useWorld((s) => s.agents.length);
  const discoveryProviders = useWorld((s) => s.discoveryProviders);
  const discoverySupported = useWorld((s) => s.discoverySupported);
  const richContext = useWorld((s) => s.richContext);
  const historySupported = useWorld((s) => s.historySupported);
  const toggleDiscovery = async (providerName: string) => {
    setError('');
    try {
      const enabled = discoveryProviders.filter((p) => p.enabled).map((p) => p.provider as string);
      const next = enabled.includes(providerName)
        ? enabled.filter((p) => p !== providerName)
        : [...enabled, providerName];
      (await import('./bridge')).configureDiscovery(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not configure discovery');
    }
  };

  const [provider, setProvider] = useState<'Claude' | 'Gemini' | 'Codex'>('Claude');
  const [token, setToken] = useState('');
  const [url, setUrl] = useState('ws://127.0.0.1:4318');
  const [error, setError] = useState('');
  const connect = async () => {
    setError('');
    try {
      const bridge = await import('./bridge');
      bridge.connectBridge(url, token);
      notify('Connecting to your local bridge…');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect');
    }
  };
  return (
    <>
      <p className="modal-intro">
        The demo is a simulation. Connect the local bridge to visualize events from your own agents.
      </p>
      <section
        className="connection-diagnostics"
        aria-label="Connection diagnostics"
        aria-live="polite"
      >
        <strong>
          {status === 'connected'
            ? 'Bridge connected'
            : status === 'connecting'
              ? 'Connecting to bridge…'
              : 'Bridge not connected'}
        </strong>
        <p>
          {status === 'connected'
            ? receivedEvents > 0
              ? `${receivedEvents} new hook/proxy events received since this connection.`
              : 'No hook/proxy events received since this connection. Local history observations are shown separately below.'
            : 'Connect the bridge first, then configure an event source below.'}
        </p>
        {mode === 'live' && (
          <p>
            {residentCount} residents in the current snapshot. Saved residents do not confirm fresh
            activity.
          </p>
        )}
        {lastReceivedAt !== null && (
          <p>
            Last event received:{' '}
            <time dateTime={new Date(lastReceivedAt).toISOString()}>
              {new Date(lastReceivedAt).toLocaleString()}
            </time>
            <br />
            Event sources: {receivedProviders.join(', ')}
          </p>
        )}
      </section>
      {status === 'connected' && (
        <section className="connection-diagnostics" aria-label="Observation capabilities">
          <strong>What this connection can report</strong>
          <p>
            Durable event recap: {historySupported ? 'available' : 'restart an updated bridge'}.
          </p>
          <p>
            Optional request text, objectives, results, and HTTPS links:{' '}
            {richContext ? 'enabled for configured producers' : 'disabled'}.
          </p>
          <p>
            Built-in hooks and the proxy report lifecycle status, not request bodies or output
            summaries. Local readers show history evidence; Claude and Gemini discovery alone cannot
            confirm running work.
          </p>
          <p>
            Source navigation is available only when a producer supplies a link. Provider
            compatibility is fixture-tested; the installed provider version still needs an
            end-to-end check.
          </p>
        </section>
      )}
      <div className="connection-steps">
        <h3>1. Connect your local bridge</h3>
        <p>
          From the repository, run <code>npm run bridge</code>. Paste its token below. Use the
          locally served app; a hosted page may not be able to connect to your computer.
        </p>
      </div>
      <label className="field-label">
        Bridge address
        <input value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
      </label>
      <label className="field-label">
        Session token
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Token from your local terminal"
          autoComplete="off"
        />
      </label>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {mode === 'live' && status === 'offline' && (
        <p className="inline-error">
          {bridgeError ||
            'The bridge is offline. Check the address and token, or return to the simulation.'}
        </p>
      )}
      <div className="connection-actions">
        <button
          className="secondary"
          onClick={() => {
            void import('./bridge').then((b) => b.disconnectBridge());
            useWorld.getState().switchMode('demo');
            notify('Back in the simulation.');
          }}
        >
          Use simulation
        </button>
        <button
          className="primary"
          disabled={status === 'connecting'}
          onClick={() => void connect()}
        >
          <Radio size={16} />
          {status === 'connected'
            ? 'Reconnect bridge'
            : status === 'connecting'
              ? 'Connecting…'
              : 'Connect bridge'}
        </button>
      </div>
      <div className="connection-steps">
        <h3>2. Discover existing sessions</h3>
        <p>
          Choose which local histories to read. Up to eight sessions occupy the world, with pinned
          sessions first and recent sessions filling the remaining seats. The demo stays separate.
        </p>
        <p>
          Experimental readers scan every 5 seconds while a live viewer is connected. Session IDs,
          titles, timestamps, and status evidence stay in the local bridge/browser. Transcript
          bodies and tool arguments are not sent to the world.
        </p>
        {status === 'connected' && !discoverySupported && (
          <p role="alert">Restart npm run bridge to load the discovery update, then reconnect.</p>
        )}
        <div className="discovery-providers">
          {(['Codex', 'Claude', 'Gemini'] as const).map((name) => {
            const info = discoveryProviders.find((p) => p.provider === name);
            return (
              <section key={name} className="discovery-card" aria-label={`${name} discovery`}>
                <div className="discovery-heading">
                  <strong>
                    {name === 'Claude'
                      ? 'Claude Code CLI'
                      : name === 'Gemini'
                        ? 'Gemini CLI'
                        : 'Codex local sessions'}
                  </strong>
                  <button
                    className="secondary"
                    disabled={
                      status !== 'connected' || !discoverySupported || info?.state === 'scanning'
                    }
                    aria-pressed={info?.enabled || false}
                    onClick={() => void toggleDiscovery(name)}
                  >
                    {info?.enabled ? `Disable ${name} discovery` : `Enable ${name} discovery`}
                  </button>
                </div>
                <p>
                  {info?.state || 'disabled'} · {info?.count || 0} sessions discovered
                </p>
                <p>
                  {info?.detail || 'Connect the bridge, then enable this local history reader.'}
                </p>
                {info?.checkedAt && (
                  <small>Last checked: {new Date(info.checkedAt).toLocaleTimeString()}</small>
                )}
              </section>
            );
          })}
        </div>
        <p>
          Discovery choices apply to this bridge process and reset when it restarts. Claude/Gemini
          web chats are not included. A chat can exist without a running agent; unknown activity is
          shown explicitly.
        </p>
        <h3>3. Optional: verify event delivery</h3>
        <p>
          In another terminal at the repository root, export the same token and run the test below.
          This creates a synthetic Custom resident; it does not start an AI task.
        </p>
        <pre>
          <code>{"export GROVE_TOKEN='paste-your-bridge-token-here'\nnpm run bridge:demo"}</code>
        </pre>
        <p>
          The variable applies to commands launched in that terminal. A .env file is not loaded
          automatically.
        </p>
        <h3>4. Add detailed lifecycle events</h3>
        <label className="field-label">
          Provider
          <select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}>
            <option>Claude</option>
            <option>Gemini</option>
            <option>Codex</option>
          </select>
        </label>
        {provider === 'Codex' ? (
          <>
            <p>
              <strong>Local discovery above can observe saved Codex desktop sessions.</strong> For
              direct lifecycle telemetry, a compatible App Server client can launch the included
              proxy and inherit GROVE_TOKEN. The proxy itself does not attach to ordinary desktop
              chats.
            </p>
            <pre>
              <code>node /absolute/path/to/agentarium/bridge/codex-proxy.mjs</code>
            </pre>
            <p>
              Running the proxy alone does not start a task. See docs/provider-integrations.md for
              client setup and current limitations.
            </p>
          </>
        ) : (
          <>
            <p>
              Generate a {provider} hook configuration fragment, then merge its hooks into your
              provider settings while preserving existing hooks.
            </p>
            <pre>
              <code>{`node bridge/print-hook-config.mjs ${provider.toLowerCase()}`}</code>
            </pre>
            <p>
              Launch {provider === 'Claude' ? 'Claude Code' : 'Gemini CLI'} from the terminal where
              you exported GROVE_TOKEN, then start a task there. Configuration is manual; choosing a
              provider here does not connect it.
            </p>
          </>
        )}
      </div>
      <p className="privacy-note">
        Local discovery reads provider files without changing them. Titles can contain private
        information; they are displayed locally. Provider credentials are never read. Disabling
        discovery removes its records from the view; separately reported hook events remain.
      </p>
    </>
  );
}
