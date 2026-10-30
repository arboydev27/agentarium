import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Focus, Play, Plug, Sprout, Users, X } from 'lucide-react';
import { useWorld } from './state';
import type { Agent } from './state';
import { WorldHUD } from './WorldHUD';
import { LandmarkMap } from './LandmarkMap';
import { SceneryStatus } from './SceneryStatus';
import { Recap } from './Recap';
import { attentionFor } from './shared/work.mjs';
import { registerWorldTools } from './webmcp';
import { filterResidents, summarizeSessions } from './sessions';
import type { SessionView } from './sessions';
import { SessionManager } from './SessionControls';
import { Settings } from './SettingsPanel';
import { Connections } from './Connections';
import { Roster, type RosterPane } from './hud/Roster';
import { Hotbar } from './hud/Hotbar';
import { Transport } from './hud/Transport';
import { SystemBar, type SystemDialog } from './hud/SystemBar';
import { AttentionBanner } from './hud/AttentionBanner';
import { Drawer, type PaneKind } from './hud/Drawer';
import { ResidentPane } from './hud/ResidentPane';
import { ListPane } from './hud/ListPane';
import { useHudIdle } from './hud/useIdle';
import {
  escapeTarget,
  HUD_SHORTCUT_HELP,
  hudDims,
  hudShortcut,
  rosterCollapses,
} from './hud/shell';
import type { WorldView } from './world/layout';
const World = lazy(() => import('./World'));

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
        <button className="hud-icon" aria-label="Close dialog" onClick={close}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

type Dialog = SystemDialog | 'sessions';

export default function App() {
  useEffect(registerWorldTools, []);
  const agents = useWorld((s) => s.agents),
    selected = useWorld((s) => s.selected),
    events = useWorld((s) => s.events),
    mode = useWorld((s) => s.mode),
    speed = useWorld((s) => s.speed),
    night = useWorld((s) => s.night),
    camera = useWorld((s) => s.camera),
    cameraCustomized = useWorld((s) => s.cameraCustomized),
    watchMode = useWorld((s) => s.watchMode),
    reducedMotion = useWorld((s) => s.reducedMotion),
    followAgent = useWorld((s) => s.followAgent),
    bridgeStatus = useWorld((s) => s.bridgeStatus),
    bridgeId = useWorld((s) => s.bridgeId),
    worldLocation = useWorld((s) => s.worldLocation),
    preferences = useWorld((s) => s.sessionPreferences),
    set = useWorld((s) => s.set);
  const [sessionView, setSessionView] = useState<SessionView>('visible');
  const [sessionFilter, setSessionFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskOrder, setTaskOrder] = useState<'recent' | 'attention'>('recent');
  const [pane, setPane] = useState<RosterPane | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const audioNodes = useRef<AudioNode[]>([]);
  const paneRef = useRef<RosterPane | null>(null);
  paneRef.current = pane;
  const bottomRef = useRef<HTMLDivElement>(null);
  // The hotbar sits centred when the corners leave room, otherwise it slides between them
  // and scrolls, so it never overlaps the map or the transport.
  useEffect(() => {
    const row = bottomRef.current;
    if (!row || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const hotbar = row.querySelector<HTMLElement>('.hud-hotbar');
      if (!hotbar) return;
      const width = (selector: string) =>
        row.querySelector(selector)?.getBoundingClientRect().width ?? 0;
      const corner = width('.hud-corner');
      const transport = width('.hud-transport');
      const rowWidth = row.clientWidth;
      const natural = hotbar.scrollWidth + 10;
      const available = Math.max(0, rowWidth - corner - transport - 24);
      const size = Math.min(natural, available);
      const left = Math.min(
        Math.max(rowWidth / 2 - size / 2, corner + 12),
        rowWidth - transport - 12 - size,
      );
      row.style.setProperty('--hud-hotbar-left', `${Math.round(left)}px`);
      row.style.setProperty('--hud-hotbar-max', `${Math.floor(available)}px`);
      row.style.setProperty('--hud-hotbar-shift', '0px');
    };
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const child of Array.from(row.children)) observer.observe(child);
    measure();
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [watchMode]);

  const paused = mode === 'live' && bridgeStatus !== 'connected';
  const sessions = mode === 'live' ? summarizeSessions(agents) : [];
  const activeSession = sessions.some((s) => s.id === sessionFilter) ? sessionFilter : '';
  const listedAgents: Agent[] =
    mode === 'live'
      ? filterResidents(agents, preferences.hidden, sessionView, activeSession, paused)
          .filter((a) =>
            [
              a.name,
              a.provider,
              a.sessionId,
              a.task,
              a.work?.objective,
              attentionFor(a)?.message,
            ].some((text) => text?.toLowerCase().includes(taskSearch.trim().toLowerCase())),
          )
          .sort(
            (a, b) =>
              (taskOrder === 'attention'
                ? Number(!!attentionFor(b)) - Number(!!attentionFor(a))
                : 0) ||
              b.updatedAt - a.updatedAt ||
              a.id.localeCompare(b.id),
          )
      : filterResidents(agents, [], sessionView);
  const chosen = agents.find((a) => a.id === selected);
  const attention = agents.filter((a) => attentionFor(a)).length;
  const idleResidents = agents.filter(
    (a) => a.status === 'idle' || a.status === 'completed',
  ).length;
  const paneKind: PaneKind | null = chosen ? 'resident' : pane;
  const idle = useHudIdle();
  const dimmed = hudDims({ idle, paneOpen: paneKind !== null, dialogOpen: dialog !== null });

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
      const target = e.target as HTMLElement;
      if (target.closest('dialog')) return;
      const world = useWorld.getState();
      if (e.key === 'Escape') {
        const layer = escapeTarget({
          watchMode: world.watchMode,
          following: !!world.followAgent,
          selected: !!world.selected,
          paneOpen: paneRef.current !== null,
        });
        if (layer === 'watch') world.set({ watchMode: false });
        else if (layer === 'follow') world.set({ followAgent: null });
        else if (layer === 'selection') world.select(null);
        else if (layer === 'pane') setPane(null);
        return;
      }
      if (target.closest('input,select,textarea')) return;
      const action = hudShortcut(e);
      if (!action) return;
      switch (action.type) {
        case 'play':
          if (target.closest('button')) return;
          e.preventDefault();
          if (world.mode === 'demo') world.set({ playing: !world.playing });
          return;
        case 'view':
          e.preventDefault();
          world.set({
            camera: action.view,
            cameraCustomized: false,
            cameraVersion: world.cameraVersion + 1,
            followAgent: null,
            cinematic: false,
          });
          return;
        case 'map':
          document.getElementById('landmark-toggle')?.click();
          return;
        case 'roster':
          setPane((current) => (current === 'list' ? null : 'list'));
          return;
        case 'night':
          world.set({ night: !world.night });
          return;
        case 'watch':
          world.set({ watchMode: !world.watchMode });
          return;
        case 'help':
          setDialog('help');
          return;
      }
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
  const toggleFullscreen = () => {
    void (
      document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen()
    ).catch(() => setToast('Fullscreen isn’t available here.'));
  };
  const changeCamera = (view: WorldView) =>
    set({
      camera: view,
      cameraCustomized: false,
      cameraVersion: useWorld.getState().cameraVersion + 1,
      followAgent: null,
      cinematic: false,
    });
  const spawn = () => {
    if (idleResidents === 0) {
      setToast('Everyone is busy. Complete a task to free a resident.');
      return;
    }
    useWorld.getState().spawn();
  };
  const openFilter = (view: SessionView) => {
    set({ watchMode: false });
    setPane('list');
    setSessionView(view);
    setSessionFilter('');
    setTaskSearch('');
    useWorld.getState().select(null);
  };
  const selectResident = (id: string) => useWorld.getState().select(selected === id ? null : id);
  const closePane = () => {
    if (chosen) useWorld.getState().select(null);
    else setPane(null);
  };
  const paneTabs: { kind: PaneKind; label: string }[] = [
    { kind: 'list', label: 'Residents' },
    { kind: 'activity', label: 'Activity' },
    ...(mode === 'live' ? [{ kind: 'recap' as const, label: 'Recap' }] : []),
  ];

  return (
    <main
      className={
        'app' +
        (night ? ' night' : '') +
        (reducedMotion ? ' reduced-motion' : '') +
        (watchMode ? ' watch-mode' : '') +
        (dimmed ? ' hud-idle' : '') +
        (paneKind ? ' pane-open' : '')
      }
    >
      <div
        className="world-canvas"
        role="region"
        tabIndex={0}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        aria-label="Interactive 3D agent world. Click or Tab here, then use arrow keys to pan; hold Shift for larger steps. Drag to orbit, scroll to zoom. Use the roster to select residents."
        onPointerDown={(event) => {
          if (event.target instanceof HTMLCanvasElement)
            event.currentTarget.focus({ preventScroll: true });
        }}
      >
        <SceneBoundary>
          <Suspense
            fallback={
              <div className="scene-loading">
                <span className="hud-wordmark">Agentarium</span>
                <span className="hud-label">Preparing the colony…</span>
              </div>
            }
          >
            <World />
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="hud-top">
        <WorldHUD
          agents={agents}
          paused={paused}
          demo={mode === 'demo'}
          compact={watchMode}
          location={worldLocation}
          filter={openFilter}
        />
        <AttentionBanner count={attention} onOpen={() => openFilter('attention')} />
        <div className="hud-top-right">
          <SystemBar
            mode={mode}
            bridgeStatus={bridgeStatus}
            night={night}
            sound={sound}
            fullscreen={fullscreen}
            onOpen={setDialog}
            onWatch={() => set({ watchMode: true })}
            onNight={() => set({ night: !night })}
            onSound={() => void toggleSound()}
            onFullscreen={toggleFullscreen}
          />
          <Roster
            agents={listedAgents}
            selected={selected}
            paused={paused}
            live={mode === 'live'}
            attention={attention}
            onSelect={selectResident}
            onOpen={setPane}
          />
        </div>
      </div>
      <SceneryStatus />
      <div className="hud-bottom" ref={bottomRef}>
        <div className="hud-corner hud-fades">
          {!watchMode && (
            <LandmarkMap
              view={camera}
              following={!!followAgent}
              customized={cameraCustomized}
              onScout={(point) => {
                set({
                  cameraJump: {
                    ...point,
                    sequence: (useWorld.getState().cameraJump?.sequence ?? 0) + 1,
                  },
                  cameraCustomized: true,
                  followAgent: null,
                  cinematic: false,
                });
              }}
              navigate={changeCamera}
              onOpen={() => {
                // On phones the map and the pane share the bottom edge; show one at a time.
                if (rosterCollapses(window.innerWidth)) {
                  setPane(null);
                  useWorld.getState().select(null);
                }
              }}
            />
          )}
          <span className="orbit-hint">
            Drag to orbit · Scroll to zoom · Click the world, then arrows pan
          </span>
        </div>
        <Hotbar
          camera={camera}
          active={!followAgent && !cameraCustomized}
          onChange={changeCamera}
        />
        <Transport notify={setToast} spawn={spawn} />
      </div>
      {paneKind && !watchMode && (
        <Drawer
          kind={paneKind}
          title={
            paneKind === 'resident'
              ? 'Resident'
              : paneKind === 'activity'
                ? 'Activity'
                : paneKind === 'recap'
                  ? 'Since you were away'
                  : 'Residents'
          }
          tabs={paneKind === 'resident' ? [] : paneTabs}
          onTab={(kind) => {
            if (kind !== 'resident') setPane(kind);
          }}
          onClose={closePane}
        >
          {paneKind === 'resident' && chosen ? (
            <ResidentPane agent={chosen} notify={setToast} />
          ) : paneKind === 'recap' && mode === 'live' ? (
            <Recap key={bridgeId || 'legacy'} />
          ) : paneKind === 'activity' ? (
            <div className="activity-list">
              <div className="list-caption">
                <span>Around the colony</span>
              </div>
              {events.length === 0 ? (
                <p className="muted">New activity will appear here.</p>
              ) : (
                events.map((e) => (
                  <div className="activity-item" key={e.id}>
                    <i className={'dot ' + e.status} aria-hidden="true" />
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
          ) : (
            <ListPane
              agents={agents}
              listed={listedAgents}
              selected={selected}
              controls={{
                sessionView,
                setSessionView,
                activeSession,
                setSessionFilter,
                taskSearch,
                setTaskSearch,
                taskOrder,
                setTaskOrder,
              }}
              onSelect={selectResident}
              onManage={() => setDialog('sessions')}
              onConnect={() => setDialog('connections')}
            />
          )}
        </Drawer>
      )}
      {watchMode && (
        <div className="watch-hud" aria-label="Watch controls">
          <div className="watch-caption">
            <strong>
              {followAgent
                ? `Following ${agents.find((a) => a.id === followAgent)?.name || 'resident'}`
                : 'Exploring the colony'}
            </strong>
            <span>
              {mode === 'demo'
                ? 'Simulation'
                : bridgeStatus === 'connected'
                  ? 'Live bridge · last reported activity'
                  : 'Updates paused · last known activity'}
            </span>
          </div>
          {followAgent && (
            <button onClick={() => set({ followAgent: null })}>Stop following</button>
          )}
          <button onClick={() => set({ watchMode: false })}>
            <X size={14} aria-hidden="true" />
            Exit watch mode
          </button>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
      {dialog === 'sessions' && mode === 'live' && (
        <Modal title="Manage sessions" close={() => setDialog(null)}>
          <SessionManager notify={setToast} />
        </Modal>
      )}
      {dialog === 'settings' && (
        <Modal title="Settings" close={() => setDialog(null)}>
          <p className="modal-intro">A few adjustments to your world.</p>
          <Settings />
          <div className="settings-credit">
            RobotExpressive by Tomás Laulhé · CC0
            <br />
            Built with Three.js · Agentarium v0.1
          </div>
        </Modal>
      )}
      {dialog === 'connections' && (
        <Modal title="Bring the colony to life" close={() => setDialog(null)}>
          <Connections notify={setToast} />
        </Modal>
      )}
      {dialog === 'help' && (
        <Modal title="Controls" close={() => setDialog(null)}>
          <p className="modal-intro">
            Every resident represents an agent. Their laptops open when work starts, and they take a
            break when it’s done.
          </p>
          <div className="help-grid">
            <div>
              <Focus />
              <strong>Explore</strong>
              <p>
                Drag to orbit. Scroll or pinch to zoom. Click the world or Tab to it, then use arrow
                keys to pan; hold Shift for larger steps. The hotbar and the map jump between
                places.
              </p>
            </div>
            <div>
              <Users />
              <strong>Meet a resident</strong>
              <p>
                Click a character, their name, or a roster entry to open their task. The amber
                banner lists everyone who needs you.
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
              <p>
                Use the local bridge to show real events. The simulation is always labeled. Follow a
                resident from their pane, or use Watch mode for a quiet view.
              </p>
            </div>
          </div>
          <h3 className="help-subheading">Keyboard</h3>
          <dl className="help-keys">
            {HUD_SHORTCUT_HELP.map((entry) => (
              <div key={entry.keys}>
                <dt>
                  <kbd>{entry.keys}</kbd>
                </dt>
                <dd>{entry.does}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </main>
  );
}
