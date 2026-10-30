import { ArrowUpRight, Coffee, GitBranch, Plug } from 'lucide-react';
import { attentionFor } from '../shared/work.mjs';
import { attentionMessage } from '../TaskBrief';
import { useWorld, type Agent } from '../state';
import { sessionKey, summarizeSessions, type SessionView } from '../sessions';
import { AgentAvatar, ProviderIcon } from './avatars';
import { rosterGlyph, rosterStatusLabel } from './shell';
import { StatusGlyph } from './Roster';

export type ListControls = {
  sessionView: SessionView;
  setSessionView: (view: SessionView) => void;
  activeSession: string;
  setSessionFilter: (id: string) => void;
  taskSearch: string;
  setTaskSearch: (text: string) => void;
  taskOrder: 'recent' | 'attention';
  setTaskOrder: (order: 'recent' | 'attention') => void;
};

/** Full resident list with the live filters, search, seating, and session tools. */
export function ListPane({
  agents,
  listed,
  selected,
  controls,
  onSelect,
  onManage,
  onConnect,
}: {
  agents: Agent[];
  listed: Agent[];
  selected: string | null;
  controls: ListControls;
  onSelect: (id: string) => void;
  onManage: () => void;
  onConnect: () => void;
}) {
  const mode = useWorld((s) => s.mode);
  const bridgeStatus = useWorld((s) => s.bridgeStatus);
  const seating = useWorld((s) => s.seating);
  const preferences = useWorld((s) => s.sessionPreferences);
  const preferenceError = useWorld((s) => s.preferenceError);
  const paused = mode === 'live' && bridgeStatus !== 'connected';
  const sessions = mode === 'live' ? summarizeSessions(agents) : [];
  const { sessionView, setSessionView, activeSession, setSessionFilter } = controls;
  const { taskSearch, setTaskSearch, taskOrder, setTaskOrder } = controls;
  const clearFilters = () => {
    setSessionView('visible');
    setTaskSearch('');
    setSessionFilter('');
  };
  return (
    <div className="list-pane">
      {paused && agents.length > 0 && (
        <p className="connection-notice" role="status">
          Updates paused. Statuses are last known; agent activity is unconfirmed.
        </p>
      )}
      {mode === 'live' && (
        <div className="session-tools">
          <label className="session-filter">
            Search tasks
            <input
              type="search"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Title, provider, session, or request"
            />
          </label>
          <label className="session-filter">
            List order
            <select
              value={taskOrder}
              onChange={(e) => setTaskOrder(e.target.value as 'recent' | 'attention')}
            >
              <option value="recent">Latest activity</option>
              <option value="attention">Attention first</option>
            </select>
          </label>
          <label className="session-filter">
            World seating
            <select
              value={seating}
              onChange={(e) =>
                useWorld.getState().setSeating(e.target.value as 'recent' | 'attention')
              }
            >
              <option value="recent">Pins, then latest eight</option>
              <option value="attention">Pins, then attention first</option>
            </select>
            <small>
              {agents.filter((a) => attentionFor(a) && a.seat >= 8).length} attention items outside
              the world. Pins and hidden choices are preserved.
            </small>
          </label>
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
              <option value="visible">All non-hidden sessions</option>
              <option value="attention">Needs attention (includes hidden)</option>
              <option value="hidden">Hidden sessions</option>
              <option value="working">Working (includes hidden)</option>
              <option value="completed">Completed (includes hidden)</option>
              <option value="unknown">Unknown (includes hidden)</option>
              <option value="here">Here in the world</option>
            </select>
          </label>
          <button className="text-button" onClick={onManage}>
            Manage sessions · {preferences.pinned.length}/8 pinned
          </button>
          {preferenceError && (
            <p className="inline-error" role="status">
              {preferenceError}
            </p>
          )}
          {sessionView === 'attention' && (
            <small>
              Unresolved reported attention across every session, including hidden sessions and
              those outside the colony.
            </small>
          )}
          {sessions.length > 0 && (
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
                Pins take priority in the eight seats; the seating choice fills the rest. These
                filters change the list only.
              </small>
            </label>
          )}
        </div>
      )}
      {sessionView !== 'visible' && (
        <div className="active-task-filter">
          <span>
            {sessionView === 'here'
              ? 'Here in the world'
              : sessionView === 'attention'
                ? 'Needs attention'
                : sessionView[0].toUpperCase() + sessionView.slice(1)}
          </span>
          <button className="text-button" onClick={clearFilters}>
            Clear filter
          </button>
        </div>
      )}
      <div className="list-caption">
        <span>Name / provider</span>
        <span>Status</span>
      </div>
      {agents.length === 0 ? (
        <div className="empty-state">
          <Coffee size={26} aria-hidden="true" />
          <h3>It’s quiet here</h3>
          <p>
            {bridgeStatus === 'connected'
              ? 'The bridge is connected. Enable local session discovery in setup to welcome your recent chats.'
              : 'Connect the local bridge to welcome your agents.'}
          </p>
          <button className="text-button" onClick={onConnect}>
            Connect agents <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </div>
      ) : listed.length === 0 ? (
        <p className="empty-filter">
          {sessionView === 'attention'
            ? 'No attention items match this view.'
            : sessionView === 'hidden'
              ? 'No hidden residents in this snapshot.'
              : 'No tasks match this view.'}
        </p>
      ) : (
        <ol className="resident-list">
          {listed.map((agent) => {
            const glyph = rosterGlyph(agent, paused);
            const label = rosterStatusLabel(agent, paused);
            return (
              <li key={agent.id}>
                <button
                  className={'resident-row ' + glyph + (selected === agent.id ? ' selected' : '')}
                  aria-pressed={selected === agent.id}
                  title={attentionFor(agent) ? attentionMessage(agent) : agent.task}
                  onClick={() => onSelect(agent.id)}
                >
                  <AgentAvatar agent={agent} />
                  <span className="resident-name">
                    <strong>
                      {agent.name}
                      {agent.parentId && <GitBranch size={12} aria-label="Subagent" />}
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
                              ? ' · Outside the colony'
                              : '')}
                    </span>
                  </span>
                  <span className={'status-tag ' + glyph}>
                    <StatusGlyph glyph={glyph} label={label} />
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <button className="connect-footer" onClick={onConnect}>
        <Plug size={14} aria-hidden="true" />
        {mode === 'demo' ? 'Bring your own agents' : 'Manage connection'}
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
