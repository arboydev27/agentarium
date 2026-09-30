import { useState } from 'react';
import type { Agent } from './state';
import { useWorld } from './state';
import { attentionFor, safeWorkUrl } from './shared/work.mjs';

const stamp = (time: number) => new Date(time).toLocaleString();
export function attentionMessage(agent: Agent) {
  const item = attentionFor(agent);
  return (
    item?.message ||
    (item?.kind === 'failure'
      ? 'Provider reported a failure. Open the source session for details.'
      : 'Provider reported waiting; request details are unavailable.')
  );
}
function acknowledgementKey(bridgeId: string, agent: Agent, episode: string) {
  return JSON.stringify([bridgeId, agent.id, episode]);
}
function readSeen(): string[] {
  const value = JSON.parse(localStorage.getItem('agentarium.attention-seen.v1') || '[]');
  if (!Array.isArray(value)) throw new Error('Invalid saved acknowledgements');
  return value.filter((v): v is string => typeof v === 'string').slice(-512);
}
export function TaskBrief({ agent, notify }: { agent: Agent; notify: (message: string) => void }) {
  const bridgeId = useWorld((s) => s.bridgeId);
  const richContext = useWorld((s) => s.richContext);
  const item = attentionFor(agent);
  const key = bridgeId && item ? acknowledgementKey(bridgeId, agent, item.id) : null;
  const [seen, setSeen] = useState<string[]>(() => {
    try {
      return readSeen();
    } catch {
      return [];
    }
  });
  const acknowledged = !!key && seen.includes(key);
  const sourceUrl = safeWorkUrl(agent.work?.sourceUrl);
  const resultUrl = safeWorkUrl(agent.work?.result?.url);
  const markSeen = () => {
    if (!key) return;
    let latest = seen;
    try {
      latest = readSeen();
    } catch {
      /* Keep in-memory acknowledgements. */
    }
    const next = [...new Set([...latest, key])].slice(-512);
    setSeen(next);
    try {
      localStorage.setItem('agentarium.attention-seen.v1', JSON.stringify(next));
      notify('Marked seen locally. The provider request remains unresolved.');
    } catch {
      notify('Marked seen in this panel, but browser storage is unavailable.');
    }
  };
  return (
    <section className="task-brief" aria-label="Task brief">
      <h4>Task brief</h4>

      {item && (
        <div className="attention-card">
          <h4>
            {item.kind === 'failure'
              ? 'Reported failure'
              : item.kind === 'approval'
                ? 'Approval requested'
                : 'Needs your input'}
          </h4>
          <p>{attentionMessage(agent)}</p>
          <small>First reported {stamp(item.since)}</small>
          {['unknown', 'disconnected'].includes(agent.status) && (
            <p>
              Current activity is unconfirmed. This earlier attention item has not been resolved by
              a later work update.
            </p>
          )}
          <button className="text-button" disabled={!key || acknowledged} onClick={markSeen}>
            {acknowledged ? 'Seen · still unresolved' : 'Mark seen locally'}
          </button>
          {!bridgeId && <small>Reconnect to an updated bridge to save acknowledgements.</small>}
        </div>
      )}
      <dl>
        <dt>Objective</dt>
        <dd>
          {agent.work?.objective ||
            'Not supplied. The title above is the latest available task label.'}
        </dd>
        <dt>Latest activity</dt>
        <dd>{agent.work?.activity || agent.task}</dd>
        <dt>Source</dt>
        <dd>
          {agent.provider} · {agent.evidence === 'history' ? 'Local history' : 'Reported event'}
        </dd>
        <dt>Agent</dt>
        <dd>{agent.agentId || 'Unknown'}</dd>
        {agent.work?.runId && (
          <>
            <dt>Run</dt>
            <dd>{agent.work.runId}</dd>
          </>
        )}
      </dl>
      {['completed', 'failed'].includes(agent.status) && (
        <div className="result-card">
          <h4>{agent.status === 'failed' ? 'Reported outcome' : 'Completion handoff'}</h4>
          <p>
            {agent.work?.result?.summary ||
              (agent.status === 'completed'
                ? 'A completion was reported. No outcome summary was supplied; this does not confirm the whole objective succeeded.'
                : 'No outcome summary was supplied.')}
          </p>
          {resultUrl && (
            <a href={resultUrl} target="_blank" rel="noopener noreferrer">
              Open supplied output ↗
            </a>
          )}
        </div>
      )}
      <div className="task-actions">
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Open source session ↗
          </a>
        )}
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(agent.sessionId || '');
              notify('Session ID copied.');
            } catch {
              notify('Copy unavailable. Select the session ID shown above and copy it manually.');
            }
          }}
          disabled={!agent.sessionId}
        >
          Copy session ID
        </button>
      </div>
      {!sourceUrl && (
        <p className="context-note">
          Source navigation was not supplied. Use the session ID to find this task in{' '}
          {agent.provider}.
        </p>
      )}
      <p className="context-note">
        {richContext
          ? 'Optional rich context is enabled. Only supplied details appear here.'
          : 'Rich context is disabled or unsupported. Status-only observation remains available.'}
      </p>
    </section>
  );
}
