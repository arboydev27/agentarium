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
import { agentSessionId, summarizeSessions, sessionKey } from './sessions';
import { SessionActions, SessionManager } from './SessionControls';
import { filterResidents } from './sessions';
import type { SessionView } from './sessions';
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
  const offline = useWorld((s) => s.mode === 'live' && s.bridgeStatus !== 'connected');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (offline || agent.telemetryStale) return <span>Last known state</span>;
  if (agent.evidence === 'history' || agent.status === 'unknown')
    return (
      <span>{agent.status === 'unknown' ? 'Activity unknown' : 'Last recorded activity'}</span>
    );
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
  const receivedEvents = useWorld((s) => s.receivedEvents);
  const historyEnabled = useWorld((s) => s.discoveryProviders.some((p) => p.enabled));
  const preferences = useWorld((s) => s.sessionPreferences);
  const preferenceError = useWorld((s) => s.preferenceError);
  const [sessionView, setSessionView] = useState<SessionView>('visible');
  const [sessionFilter, setSessionFilter] = useState('');
  const sessions = mode === 'live' ? summarizeSessions(agents) : [];
  const activeSession = sessions.some((s) => s.id === sessionFilter) ? sessionFilter : '';
  const listedAgents =
    mode === 'live'
      ? filterResidents(agents, preferences.hidden, sessionView, activeSession)
      : agents;
  const [tab, setTab] = useState<'residents' | 'activity'>('residents');
  const [modal, setModal] = useState<'settings' | 'connections' | 'help' | 'sessions' | null>(null);
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
                ? 'Bridge connected'
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
              ? receivedEvents > 0
                ? 'Agent events received. Your grove is listening.'
                : agents.length
                  ? 'Your recent sessions, at home in the grove.'
                  : 'Bridge connected. Discover your recent sessions.'
              : agents.length
                ? 'Updates paused. Showing last known activity.'
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
        className={
          'residents-panel ' +
          (mode === 'live' ? 'live-panel ' : '') +
          (collapsed ? 'collapsed' : '')
        }
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
        {mode === 'live' && waiting > 0 && (
          <button
            className="attention-summary"
            onClick={() => {
              setTab('residents');
              setCollapsed(false);
              setSessionView('attention');
              setSessionFilter('');
            }}
          >
            <AlertCircle size={15} />
            {waiting} need attention · View all
          </button>
        )}
        {!collapsed && (
          <>
            {mode === 'live' && bridgeStatus !== 'connected' && agents.length > 0 && (
              <p className="connection-notice" role="status">
                Updates paused. Statuses below are last known; agent activity is unconfirmed.
              </p>
            )}
            <div className="panel-content">
              {tab === 'residents' ? (
                <>
                  {mode === 'live' && (
                    <div className="session-tools">
                      <label className="session-filter">
                        Show residents
                        <select
                          value={sessionView}
                          onChange={(e) => {
                            setSessionView(e.target.value as SessionView);
                            setSessionFilter('');
                            useWorld.getState().select(null);
                          }}
                        >
                          <option value="visible">Visible sessions</option>
                          <option value="attention">Needs attention (includes hidden)</option>
                          <option value="hidden">Hidden sessions</option>
                        </select>
                      </label>
                      <button className="text-button" onClick={() => setModal('sessions')}>
                        Manage sessions · {preferences.pinned.length}/8 pinned
                      </button>
                      {preferenceError && (
                        <p className="inline-error" role="status">
                          {preferenceError}
                        </p>
                      )}
                      {sessionView === 'attention' && (
                        <small>
                          Waiting and failed residents across every session, including hidden
                          sessions and those outside the grove.
                        </small>
                      )}
                    </div>
                  )}
                  {mode === 'live' && sessions.length > 0 && (
                    <label className="session-filter">
                      Session · {sessions.length} total
                      <select
                        value={activeSession}
                        onChange={(e) => {
                          setSessionFilter(e.target.value);
                          useWorld.getState().select(null);
                        }}
                      >
                        <option value="">All sessions</option>
                        {sessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.label} · {session.count}{' '}
                            {session.count === 1 ? 'resident' : 'residents'}
                            {session.needsAttention ? ` · ${session.needsAttention} need you` : ''}
                          </option>
                        ))}
                      </select>
                      <small>
                        Pins take priority in the eight seats; recent sessions fill the rest. These
                        filters change the list only.
                      </small>
                    </label>
                  )}
                  <div className="list-caption">
                    <span>NAME / PROVIDER</span>
                    <span>STATUS</span>
                  </div>
                  {agents.length === 0 ? (
                    <div className="empty-state">
                      <Coffee size={28} />
                      <h3>It’s quiet here</h3>
                      <p>
                        {bridgeStatus === 'connected'
                          ? 'The bridge is connected. Enable local session discovery in setup to welcome your recent chats.'
                          : 'Connect the local bridge to welcome your agents.'}
                      </p>
                      <button className="text-button" onClick={() => setModal('connections')}>
                        Connect agents <ArrowUpRight size={14} />
                      </button>
                    </div>
                  ) : listedAgents.length === 0 ? (
                    <p className="empty-filter">
                      {sessionView === 'attention'
                        ? 'No waiting or failed residents in this view.'
                        : sessionView === 'hidden'
                          ? 'No hidden residents in this snapshot.'
                          : 'No residents match this view. Restore hidden sessions in Manage sessions.'}
                    </p>
                  ) : (
                    listedAgents.map((agent) => (
                      <button
                        key={agent.id}
                        className={'resident-row ' + (selected === agent.id ? 'selected' : '')}
                        onClick={() =>
                          useWorld.getState().select(selected === agent.id ? null : agent.id)
                        }
                      >
                        <AgentAvatar agent={agent} />
                        <span className="resident-name" title={agent.name}>
                          <strong>
                            {agent.name}
                            {agent.parentId && <GitBranch size={12} />}
                          </strong>
                          <span>
                            <ProviderIcon provider={agent.provider} />
                            {agent.provider}
                            {mode === 'live' &&
                              (preferences.hidden.includes(sessionKey(agent))
                                ? ' · Hidden'
                                : preferences.pinned.includes(sessionKey(agent))
                                  ? ' · Pinned'
                                  : agent.seat >= 8
                                    ? ' · Outside grove'
                                    : '')}
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
                                      : agent.status === 'unknown'
                                        ? 'Unknown'
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
                    {mode === 'live' && (bridgeStatus !== 'connected' || chosen.telemetryStale)
                      ? 'Last known: '
                      : ''}
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
                {mode === 'live' && <SessionActions agent={chosen} notify={setToast} />}
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
                {mode === 'live' && (
                  <p className="parent-note session-id">Session: {agentSessionId(chosen)}</p>
                )}
                {chosen.parentId && (
                  <p className="parent-note">
                    Helping {agents.find((a) => a.id === chosen.parentId)?.name || 'another agent'}
                  </p>
                )}
                {chosen.seat >= 8 && (
                  <p className="parent-note">
                    {preferences.hidden.includes(sessionKey(chosen))
                      ? 'This session is hidden from the world.'
                      : 'Outside the eight seats. Pin this session to keep a place. Subagents share their session’s place.'}
                  </p>
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
                      {Object.entries(STATUS_LABEL)
                        .filter(([value]) => value !== 'unknown')
                        .map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="live-note">
                    {chosen.telemetryStale && (
                      <p>Saved before the bridge restarted. Waiting for fresh status evidence.</p>
                    )}
                    <p>
                      {chosen.evidence === 'history'
                        ? 'Read-only local history observation. This may not reflect the current runtime state.'
                        : 'Last status reported by your agent. A bridge connection alone does not confirm it is still running.'}
                    </p>
                    <p>Last activity: {new Date(chosen.updatedAt).toLocaleString()}</p>
                    {chosen.observedAt && (
                      <p>Last status evidence: {new Date(chosen.observedAt).toLocaleString()}</p>
                    )}
                  </div>
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
                ? receivedEvents > 0
                  ? `${receivedEvents} events received · Listening`
                  : historyEnabled
                    ? 'Watching local sessions · 5s refresh'
                    : 'Bridge connected · Awaiting events'
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
      {modal === 'sessions' && mode === 'live' && (
        <Modal title="Manage sessions" close={() => setModal(null)}>
          <SessionManager notify={setToast} />
        </Modal>
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
  const bridgeError = useWorld((s) => s.bridgeError);
  const receivedEvents = useWorld((s) => s.receivedEvents);
  const lastReceivedAt = useWorld((s) => s.lastReceivedAt);
  const receivedProviders = useWorld((s) => s.receivedProviders);
  const residentCount = useWorld((s) => s.agents.length);
  const discoveryProviders = useWorld((s) => s.discoveryProviders);
  const discoverySupported = useWorld((s) => s.discoverySupported);
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
