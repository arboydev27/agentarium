import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Sprout,
  ArrowUpRight,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Settings2,
  Sun,
  Moon,
  Maximize,
  Minimize,
  X,
  ChevronRight,
  Check,
  Command,
  Sparkles,
  Radio,
  Coffee,
  Laptop,
  Users,
  SlidersHorizontal,
  Leaf,
  Plug,
  Activity,
  Focus,
  CircleHelp,
  AlertCircle,
  GitBranch,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useWorld, STATUS_LABEL } from './state';
import { registerWorldTools } from './webmcp';
import type { Agent, Status } from './state';
const World = lazy(() => import('./World'));
function ProviderIcon({ provider }: { provider: string }) {
  return (
    <span className={'provider-icon ' + provider.toLowerCase()}>
      {provider === 'Codex' ? (
        <Command size={13} />
      ) : provider === 'Claude' ? (
        <span>✳</span>
      ) : provider === 'Gemini' ? (
        <Sparkles size={13} />
      ) : (
        <Radio size={13} />
      )}
    </span>
  );
}
function AgentAvatar({ agent }: { agent: Agent }) {
  return (
    <span className="agent-avatar" style={{ '--agent-color': agent.color } as React.CSSProperties}>
      <span className="avatar-face">
        <i />
        <i />
      </span>
    </span>
  );
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-error">
        <Sprout size={36} />
        <h2>The world couldn’t load</h2>
        <p>Try reloading with hardware acceleration enabled.</p>
        <button className="primary" onClick={() => location.reload()}>
          Reload the world
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Elapsed({ agent }: { agent: Agent }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const n = Math.max(
    0,
    Math.floor(
      ((['completed', 'failed', 'idle'].includes(agent.status) ? agent.updatedAt : now) -
        agent.startedAt) /
        1000,
    ),
  );
  return (
    <span>
      {Math.floor(n / 60)}m {String(n % 60).padStart(2, '0')}s
    </span>
  );
}
export default function App() {
  useEffect(registerWorldTools, []);
  const agents = useWorld((s) => s.agents),
    selected = useWorld((s) => s.selected),
    events = useWorld((s) => s.events),
    mode = useWorld((s) => s.mode),
    playing = useWorld((s) => s.playing),
    speed = useWorld((s) => s.speed),
    night = useWorld((s) => s.night),
    camera = useWorld((s) => s.camera),
    cinematic = useWorld((s) => s.cinematic),
    bridgeStatus = useWorld((s) => s.bridgeStatus);
  const [tab, setTab] = useState<'residents' | 'activity'>('residents');
  const [modal, setModal] = useState<'settings' | 'connections' | 'help' | null>(null);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 801);
  const [toast, setToast] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const audioNodes = useRef<AudioNode[]>([]);
  const chosen = agents.find((a) => a.id === selected);
  const set = useWorld((s) => s.set);
  const busy = agents.filter((a) => a.status === 'working' || a.status === 'tool').length;
  const waiting = agents.filter((a) => a.status === 'waiting' || a.status === 'failed').length;
  const idle = agents.filter((a) => a.status === 'idle' || a.status === 'completed').length;
  useEffect(() => {
    const t = setInterval(() => useWorld.getState().tick(), 6500 / speed);
    return () => clearInterval(t);
  }, [speed]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,button,select,textarea,dialog')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (useWorld.getState().mode === 'demo')
          useWorld.setState((s) => ({ playing: !s.playing }));
      }
      if (e.key === 'Escape') useWorld.getState().select(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  const toggleSound = async () => {
    if (sound) {
      await audio.current?.suspend();
      setSound(false);
      return;
    }
    try {
      if (!audio.current) {
        const ctx = new AudioContext();
        audio.current = ctx;
        const master = ctx.createGain();
        master.gain.value = 0.016;
        master.connect(ctx.destination);
        [130.81, 196, 261.63].forEach((hz, i) => {
          const oscillator = ctx.createOscillator();
          oscillator.type = 'sine';
          oscillator.frequency.value = hz;
          const gain = ctx.createGain();
          gain.gain.value = 0.2 / (i + 1);
          oscillator.connect(gain);
          gain.connect(master);
          oscillator.start();
          audioNodes.current.push(oscillator, gain);
        });
      }
      await audio.current.resume();
      setSound(true);
    } catch {
      setToast('Sound isn’t available in this browser.');
    }
  };
  const changeCamera = (view: typeof camera) =>
    set({ camera: view, cameraVersion: useWorld.getState().cameraVersion + 1 });
  const spawn = () => {
    if (idle === 0) {
      setToast('Everyone is busy. Complete a task to free a resident.');
      return;
    }
    useWorld.getState().spawn();
  };
  return (
    <main className={'app ' + (night ? 'night' : '')}>
      <div
        className="world-canvas"
        aria-label="Interactive 3D café island. Drag to orbit, scroll to zoom. Use the residents list to select characters."
      >
        <SceneBoundary>
          <Suspense
            fallback={
              <div className="scene-loading">
                <Sprout size={36} />
                <span>Growing your little world…</span>
              </div>
            }
          >
            <World />
          </Suspense>
        </SceneBoundary>
      </div>
      <header className="topbar">
        <a href="/" className="brand" aria-label="Agent Grove home">
          <span className="brand-mark">
            <Sprout size={22} />
          </span>
          <span>
            agent<span className="brand-light">grove</span>
          </span>
        </a>
        <div className="header-divider" />
        <span className="workspace-name">Your little world</span>
        <div className="topbar-right">
          <button
            className={
              'connection-pill ' +
              (mode === 'live' && bridgeStatus === 'connected' ? 'connected' : '')
            }
            onClick={() => setModal('connections')}
          >
            <span className="connection-dot" />
            {mode === 'demo'
              ? 'Simulation'
              : bridgeStatus === 'connected'
                ? 'Live connection'
                : bridgeStatus === 'connecting'
                  ? 'Connecting…'
                  : 'Not connected'}
            <ChevronRight size={14} />
          </button>
          <button
            className="icon-button"
            aria-label="Help and controls"
            onClick={() => setModal('help')}
          >
            <CircleHelp size={19} />
          </button>
          <button
            className="icon-button"
            aria-label="Settings"
            onClick={() => setModal('settings')}
          >
            <Settings2 size={19} />
          </button>
          <span className="profile">A</span>
        </div>
      </header>
      <div className="world-heading">
        <div className="eyebrow">
          <span className="sun-symbol">✳</span>
          {night ? 'AFTER HOURS' : 'A LITTLE ROOM FOR BIG IDEAS'}
        </div>
        <h1>
          The grove<span>.</span>
        </h1>
        <p>
          {mode === 'demo'
            ? 'A living world of simulated agents.'
            : bridgeStatus === 'connected'
              ? 'Your connected agents, at home in the grove.'
              : 'Connect an agent to bring the grove to life.'}
        </p>
        <div className="world-stats">
          <span>
            <i className="dot working" />
            <strong>{busy}</strong> working
          </span>
          <span>
            <i className="dot idle" />
            <strong>{idle}</strong> unwinding
          </span>
          {waiting > 0 && (
            <span>
              <i className="dot waiting" />
              <strong>{waiting}</strong> need you
            </span>
          )}
        </div>
      </div>
      <div className="left-controls">
        <button
          className="icon-button floating"
          aria-label={night ? 'Switch to daylight' : 'Switch to evening'}
          title={night ? 'Daylight' : 'Evening'}
          onClick={() => set({ night: !night })}
        >
          {night ? <Moon size={19} /> : <Sun size={19} />}
        </button>
        <button
          className={'icon-button floating ' + (sound ? 'active' : '')}
          aria-label={sound ? 'Mute ambient sound' : 'Play ambient sound'}
          title="Ambient sound"
          onClick={() => void toggleSound()}
        >
          {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <button
          className="icon-button floating"
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title="Fullscreen"
          onClick={() => {
            void (
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen()
            ).catch(() => setToast('Fullscreen isn’t available here.'));
          }}
        >
          {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>
      <aside
        className={'residents-panel ' + (collapsed ? 'collapsed' : '')}
        aria-label="Residents and activity"
      >
        <div className="panel-heading">
          <div className="panel-tabs">
            <button
              className={tab === 'residents' ? 'active' : ''}
              onClick={() => {
                setTab('residents');
                setCollapsed(false);
              }}
            >
              Residents <span>{agents.length}</span>
            </button>
            <button
              className={tab === 'activity' ? 'active' : ''}
              onClick={() => {
                setTab('activity');
                setCollapsed(false);
              }}
              aria-label="Activity log"
            >
              <Activity size={17} />
            </button>
          </div>
          <button
            className="icon-button small"
            aria-label={collapsed ? 'Expand residents' : 'Collapse residents'}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronRight size={18} className={collapsed ? '' : 'rotate-90'} />
          </button>
        </div>
        {!collapsed && (
          <>
            <div className="panel-content">
              {tab === 'residents' ? (
                <>
                  <div className="list-caption">
                    <span>NAME / PROVIDER</span>
                    <span>STATUS</span>
                  </div>
                  {agents.length === 0 ? (
                    <div className="empty-state">
                      <Coffee size={28} />
                      <h3>It’s quiet here</h3>
                      <p>Connect the local bridge to welcome your agents.</p>
                      <button className="text-button" onClick={() => setModal('connections')}>
                        Connect agents <ArrowUpRight size={14} />
                      </button>
                    </div>
                  ) : (
                    agents.map((agent) => (
                      <button
                        key={agent.id}
                        className={'resident-row ' + (selected === agent.id ? 'selected' : '')}
                        onClick={() =>
                          useWorld.getState().select(selected === agent.id ? null : agent.id)
                        }
                      >
                        <AgentAvatar agent={agent} />
                        <span className="resident-name">
                          <strong>
                            {agent.name}
                            {agent.parentId && <GitBranch size={12} />}
                          </strong>
                          <span>
                            <ProviderIcon provider={agent.provider} />
                            {agent.provider}
                          </span>
                        </span>
                        <span className={'status-tag ' + agent.status}>
                          {agent.status === 'tool'
                            ? 'Working'
                            : agent.status === 'idle'
                              ? 'Idle'
                              : agent.status === 'completed'
                                ? 'Done'
                                : agent.status === 'waiting'
                                  ? 'Needs you'
                                  : agent.status === 'failed'
                                    ? 'Error'
                                    : agent.status === 'disconnected'
                                      ? 'Offline'
                                      : 'Working'}
                        </span>
                      </button>
                    ))
                  )}
                </>
              ) : (
                <div className="activity-list">
                  <div className="list-caption">AROUND THE GROVE</div>
                  {events.length === 0 ? (
                    <p className="muted">New activity will appear here.</p>
                  ) : (
                    events.map((e) => (
                      <div className="activity-item" key={e.id}>
                        <i className={'dot ' + e.status} />
                        <div>
                          <strong>{e.name}</strong>
                          <p>{e.message}</p>
                          <time>
                            {new Date(e.time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {chosen ? (
              <div className="inspector">
                <div className="inspector-heading">
                  <span>
                    <i className={'dot ' + chosen.status} />
                    {STATUS_LABEL[chosen.status]}
                  </span>
                  <button
                    className="icon-button small"
                    aria-label="Close agent details"
                    onClick={() => useWorld.getState().select(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <h3>{chosen.task}</h3>
                <div className="task-meta">
                  <span>
                    <Coffee size={13} />
                    {chosen.zone}
                  </span>
                  <span>
                    <Elapsed agent={chosen} />
                  </span>
                </div>
                {chosen.parentId && (
                  <p className="parent-note">
                    Helping {agents.find((a) => a.id === chosen.parentId)?.name || 'another agent'}
                  </p>
                )}
                {chosen.seat >= 8 && (
                  <p className="parent-note">Visible in the list · all eight seats are occupied.</p>
                )}
                {mode === 'demo' ? (
                  <div className="task-actions">
                    <button
                      onClick={() =>
                        useWorld
                          .getState()
                          .setStatus(
                            chosen.id,
                            chosen.status === 'waiting' ? 'working' : 'completed',
                          )
                      }
                    >
                      <Check size={14} />
                      {chosen.status === 'waiting' ? 'Resume' : 'Complete'}
                    </button>
                    <button
                      title="Spawn a child agent"
                      disabled={idle === 0}
                      onClick={() => useWorld.getState().spawn(chosen.id)}
                    >
                      <GitBranch size={14} />
                      Delegate
                    </button>
                    <select
                      aria-label="Simulate agent state"
                      value={chosen.status}
                      onChange={(e) =>
                        useWorld.getState().setStatus(chosen.id, e.target.value as Status)
                      }
                    >
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="live-note">Status comes from your connected agent.</p>
                )}
              </div>
            ) : (
              <div className="panel-footer">
                <span className="little-spark">✧</span>
                <p>
                  {mode === 'demo'
                    ? 'Select a resident to see what’s on their mind.'
                    : 'Select a resident to inspect their current task.'}
                </p>
              </div>
            )}
            <button className="connect-footer" onClick={() => setModal('connections')}>
              <Plug size={15} />
              {mode === 'demo' ? 'Bring your own agents' : 'Manage connection'}
              <ArrowUpRight size={15} />
            </button>
          </>
        )}
      </aside>
      <div className="camera-presets" aria-label="Camera views">
        {(['overview', 'café', 'garden', 'studio'] as const).map((view, i) => (
          <button
            className={camera === view ? 'active' : ''}
            key={view}
            onClick={() => changeCamera(view)}
          >
            {i === 0 ? (
              <Focus size={15} />
            ) : i === 1 ? (
              <Coffee size={15} />
            ) : i === 2 ? (
              <Leaf size={15} />
            ) : (
              <Laptop size={15} />
            )}
            <span>{view === 'overview' ? 'Overview' : view[0].toUpperCase() + view.slice(1)}</span>
          </button>
        ))}
      </div>
      <footer className="world-bottom">
        <div className="orbit-hint">
          <span className="mouse-icon" />
          <span>
            Drag to explore <b>·</b> Scroll to get closer
          </span>
        </div>
        <div className="simulation-toolbar">
          {mode === 'demo' ? (
            <>
              <button
                className="play-button"
                aria-label={playing ? 'Pause simulation' : 'Play simulation'}
                title="Pause / play simulation (Space)"
                onClick={() => set({ playing: !playing })}
              >
                {playing ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
              </button>
              <span className="toolbar-title">
                {playing ? 'Life in the grove' : 'Taking a breath'}
              </span>
              <button
                className="speed-button"
                aria-label="Change simulation speed"
                onClick={() => set({ speed: speed === 1 ? 2 : speed === 2 ? 0.5 : 1 })}
              >
                {speed}×
              </button>
              <span className="toolbar-divider" />
              <button
                className="icon-button"
                aria-label="Reset simulation"
                title="Reset simulation"
                onClick={() => {
                  useWorld.getState().reset();
                  setToast('A fresh start for the grove.');
                }}
              >
                <RotateCcw size={16} />
              </button>
              <button className="spawn-button" onClick={spawn}>
                <Plus size={16} />
                New task
              </button>
            </>
          ) : (
            <span className="toolbar-title">
              <Radio size={16} />
              {bridgeStatus === 'connected'
                ? 'Listening for agent activity'
                : 'Waiting for a connection'}
            </span>
          )}
        </div>
        <button
          className={'cinematic-button ' + (cinematic ? 'active' : '')}
          onClick={() => set({ cinematic: !cinematic })}
        >
          <span className="cinema-icon" />
          {cinematic ? 'Stop orbit' : 'Slow orbit'}
        </button>
      </footer>
      {toast && (
        <div role="status" className="toast">
          <Sprout size={17} />
          {toast}
        </div>
      )}
      {modal === 'settings' && (
        <Modal title="Make yourself at home" close={() => setModal(null)}>
          <p className="modal-intro">A few little adjustments to your world.</p>
          <Settings />
          <div className="settings-credit">
            RobotExpressive by Tomás Laulhé · CC0
            <br />
            Built with Three.js · Agent Grove v0.1
          </div>
        </Modal>
      )}
      {modal === 'connections' && (
        <Modal title="Bring the grove to life" close={() => setModal(null)}>
          <Connections notify={setToast} />
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="Welcome to the grove" close={() => setModal(null)}>
          <p className="modal-intro">
            Every resident represents an agent. Their laptops open when work starts, and they take a
            break when it’s done.
          </p>
          <div className="help-grid">
            <div>
              <Focus />
              <strong>Explore</strong>
              <p>
                Drag to orbit. Scroll or pinch to zoom. Jump between places with the view buttons.
              </p>
            </div>
            <div>
              <Users />
              <strong>Meet a resident</strong>
              <p>
                Click a character or their name to inspect a task and try different demo states.
              </p>
            </div>
            <div>
              <Play />
              <strong>Try a task</strong>
              <p>
                Start a new task, delegate to another resident, or pause the simulation with Space.
              </p>
            </div>
            <div>
              <Plug />
              <strong>Connect</strong>
              <p>Use the local bridge to show real events. The simulation is always labeled.</p>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
function Settings() {
  const s = useWorld();
  return (
    <div className="settings-list">
      <label>
        <span>
          <strong>Evening light</strong>
          <small>Warm lamps and a quieter sky</small>
        </span>
        <input
          type="checkbox"
          checked={s.night}
          onChange={(e) => s.set({ night: e.target.checked })}
        />
      </label>
      <label>
        <span>
          <strong>Resident names</strong>
          <small>Labels above characters</small>
        </span>
        <input
          type="checkbox"
          checked={s.labels}
          onChange={(e) => s.set({ labels: e.target.checked })}
        />
      </label>
      <label>
        <span>
          <strong>Reduced motion</strong>
          <small>Still characters and instant camera changes</small>
        </span>
        <input
          type="checkbox"
          checked={s.reducedMotion}
          onChange={(e) => s.set({ reducedMotion: e.target.checked, cinematic: false })}
        />
      </label>
      <label>
        <span>
          <strong>Rendering quality</strong>
          <small>Lower quality uses fewer pixels</small>
        </span>
        <select
          value={s.quality}
          onChange={(e) => s.set({ quality: e.target.value as 'high' | 'low' })}
        >
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </label>
    </div>
  );
}
function Connections({ notify }: { notify: (s: string) => void }) {
  const mode = useWorld((s) => s.mode);
  const status = useWorld((s) => s.bridgeStatus);
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
      <div className="provider-cards">
        {['Codex', 'Claude', 'Gemini'].map((p) => (
          <div key={p}>
            <ProviderIcon provider={p} />
            <strong>{p}</strong>
            <span>{p === 'Codex' ? 'App Server adapter' : 'Hook adapter'}</span>
          </div>
        ))}
      </div>
      <div className="connection-steps">
        <h3>Connect from the local app</h3>
        <p>
          Start the included bridge with <code>npm run bridge</code>. Open the local app and paste
          the token printed in your terminal. Hook setup is in the project’s README.
        </p>
        <p>
          The private hosted version is ready for simulation; browsers may block its connection to a
          local bridge.
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
          The bridge is offline. Check the address and token, or return to the simulation.
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
        <button className="primary" onClick={() => void connect()}>
          <Radio size={16} />
          {status === 'connected' ? 'Reconnect' : 'Connect bridge'}
        </button>
      </div>
      <p className="privacy-note">
        Only agent metadata is displayed. No prompts or credentials are sent to this hosted site.
      </p>
    </>
  );
}
