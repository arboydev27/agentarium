import { useEffect, useState } from 'react';
import { Check, Coffee, GitBranch, ScanEye } from 'lucide-react';
import { STATUS_LABEL, useWorld, type Agent, type Status } from '../state';
import { agentSessionId, sessionKey } from '../sessions';
import { SessionActions } from '../SessionControls';
import { TaskBrief } from '../TaskBrief';
import { AgentAvatar, ProviderIcon } from './avatars';
import { rosterGlyph, rosterStatusLabel } from './shell';
import { StatusGlyph } from './Roster';

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
    <span className="hud-mono">
      {Math.floor(n / 60)}m {String(n % 60).padStart(2, '0')}s
    </span>
  );
}

/** Detail pane for one resident: factual status, task brief, and session actions. */
export function ResidentPane({
  agent,
  notify,
}: {
  agent: Agent;
  notify: (message: string) => void;
}) {
  const mode = useWorld((s) => s.mode);
  const bridgeStatus = useWorld((s) => s.bridgeStatus);
  const bridgeId = useWorld((s) => s.bridgeId);
  const followAgent = useWorld((s) => s.followAgent);
  const preferences = useWorld((s) => s.sessionPreferences);
  const agents = useWorld((s) => s.agents);
  const set = useWorld((s) => s.set);
  const paused = mode === 'live' && bridgeStatus !== 'connected';
  const idle = agents.filter((a) => a.status === 'idle' || a.status === 'completed').length;
  const glyph = rosterGlyph(agent, paused);
  const statusLabel = rosterStatusLabel(agent, paused);
  const key = sessionKey(agent);
  const hidden = preferences.hidden.includes(key);
  const pinned = preferences.pinned.includes(key);
  return (
    <div className="resident-pane">
      <div className="resident-hero">
        <AgentAvatar agent={agent} size="hero" />
        <div className="resident-hero-text">
          <h3>
            {agent.name}
            {agent.parentId && <GitBranch size={12} aria-label="Subagent" />}
          </h3>
          <span className="resident-provider">
            <ProviderIcon provider={agent.provider} />
            {agent.provider}
            {mode === 'live' &&
              (hidden
                ? ' · Hidden'
                : pinned
                  ? ' · Pinned'
                  : agent.seat >= 8
                    ? ' · Outside the colony'
                    : '')}
          </span>
        </div>
        <span className={'status-tag ' + glyph}>
          <StatusGlyph glyph={glyph} label={statusLabel} />
          {statusLabel}
        </span>
      </div>
      {mode === 'live' && <SessionActions agent={agent} notify={notify} />}
      {agent.seat < 8 && (
        <button
          className="follow-button"
          aria-pressed={followAgent === agent.id}
          onClick={() =>
            set({ followAgent: followAgent === agent.id ? null : agent.id, cinematic: false })
          }
        >
          <ScanEye size={14} aria-hidden="true" />
          {followAgent === agent.id ? 'Stop following' : 'Follow resident'}
        </button>
      )}
      <h4 className="resident-task">{agent.work?.objective || agent.task}</h4>
      <div className="task-meta">
        <span>
          <Coffee size={13} aria-hidden="true" />
          Home: {agent.zone}
        </span>
        <span>
          <Elapsed agent={agent} />
        </span>
      </div>
      {mode === 'live' && (
        <p className="parent-note session-id">Session: {agentSessionId(agent)}</p>
      )}
      {mode === 'live' && (
        <TaskBrief key={`${bridgeId}:${agent.id}`} agent={agent} notify={notify} />
      )}
      {agent.parentId && (
        <p className="parent-note">
          Helping {agents.find((a) => a.id === agent.parentId)?.name || 'another agent'}
        </p>
      )}
      {agent.seat >= 8 && (
        <p className="parent-note">
          {hidden
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
                .setStatus(agent.id, agent.status === 'waiting' ? 'working' : 'completed')
            }
          >
            <Check size={14} aria-hidden="true" />
            {agent.status === 'waiting' ? 'Resume' : 'Complete'}
          </button>
          <button
            title="Spawn a child agent"
            disabled={idle === 0}
            onClick={() => useWorld.getState().spawn(agent.id)}
          >
            <GitBranch size={14} aria-hidden="true" />
            Delegate
          </button>
          <select
            aria-label="Simulate agent state"
            value={agent.status}
            onChange={(e) => useWorld.getState().setStatus(agent.id, e.target.value as Status)}
          >
            {Object.entries(STATUS_LABEL)
              .filter(([value]) => value !== 'unknown')
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </div>
      ) : (
        <div className="live-note">
          {agent.telemetryStale && (
            <p>Saved before the bridge restarted. Waiting for fresh status evidence.</p>
          )}
          <p>
            {agent.evidence === 'history'
              ? 'Read-only local history observation. This may not reflect the current runtime state.'
              : 'Last status reported by your agent. A bridge connection alone does not confirm it is still running.'}
          </p>
          <p>Last activity: {new Date(agent.updatedAt).toLocaleString()}</p>
          {agent.observedAt && (
            <p>Last status evidence: {new Date(agent.observedAt).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
