import { Pin, PinOff, EyeOff, Eye } from 'lucide-react';
import { useWorld } from './state';
import { sessionKey } from './sessions';
import type { Agent } from './state';

export function SessionActions({
  agent,
  notify,
}: {
  agent: Agent;
  notify: (message: string) => void;
}) {
  const preferences = useWorld((s) => s.sessionPreferences);
  const change = useWorld((s) => s.changeSession);
  const key = sessionKey(agent);
  const pinned = preferences.pinned.includes(key);
  const hidden = preferences.hidden.includes(key);
  const act = (action: 'pin' | 'unpin' | 'hide' | 'restore') => {
    const error = change(key, action);
    notify(
      error ||
        (action === 'hide'
          ? 'Session hidden. Restore it in Manage sessions.'
          : action === 'restore'
            ? 'Session restored to the recent-session pool.'
            : action === 'pin'
              ? 'Session pinned to the grove.'
              : 'Session unpinned.'),
    );
  };
  return (
    <div className="task-actions session-actions">
      {!hidden && (
        <button onClick={() => act(pinned ? 'unpin' : 'pin')} aria-pressed={pinned}>
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
          {pinned ? 'Unpin session' : 'Pin session'}
        </button>
      )}
      <button onClick={() => act(hidden ? 'restore' : 'hide')}>
        {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
        {hidden ? 'Restore session' : 'Hide session'}
      </button>
    </div>
  );
}

export function SessionManager({ notify }: { notify: (message: string) => void }) {
  const agents = useWorld((s) => s.agents);
  const preferences = useWorld((s) => s.sessionPreferences);
  const error = useWorld((s) => s.preferenceError);
  const change = useWorld((s) => s.changeSession);
  return (
    <div className="session-manager">
      <p className="modal-intro">
        Pin up to eight sessions. Available pinned sessions take seats first; recent sessions fill
        the rest. Hiding a session also removes its pin.
      </p>
      <p className="muted">
        Choices are saved only in this browser for this app address. Hiding does not delete chats or
        stop agents. Hidden sessions still appear under Needs attention.
      </p>
      {error && (
        <p role="status" className="inline-error">
          {error}
        </p>
      )}
      {(['pinned', 'hidden'] as const).map((kind) => (
        <section key={kind} aria-label={`${kind === 'pinned' ? 'Pinned' : 'Hidden'} sessions`}>
          <h3>
            {kind === 'pinned' ? 'Pinned' : 'Hidden'} sessions · {preferences[kind].length}
            {kind === 'pinned' ? ' / 8' : ''}
          </h3>
          {preferences[kind].length === 0 ? (
            <p className="muted">No {kind} sessions. Select a resident to manage its session.</p>
          ) : (
            preferences[kind].map((key) => {
              const agent = agents.find((a) => sessionKey(a) === key);
              const [provider, id] = JSON.parse(key) as [string, string];
              return (
                <div className="managed-session" key={key}>
                  <div>
                    <strong>{agent?.name || `${provider} session`}</strong>
                    <small>
                      {provider} · {id}
                    </small>
                    {!agent && (
                      <small>
                        Not in the current snapshot. This choice will apply if it returns.
                      </small>
                    )}
                  </div>
                  <button
                    className="secondary"
                    aria-label={`${kind === 'pinned' ? 'Unpin' : 'Restore'} ${agent?.name || id}`}
                    onClick={() => {
                      const message = change(key, kind === 'pinned' ? 'unpin' : 'restore');
                      notify(
                        message || (kind === 'pinned' ? 'Session unpinned.' : 'Session restored.'),
                      );
                    }}
                  >
                    {kind === 'pinned' ? 'Unpin' : 'Restore'}
                  </button>
                </div>
              );
            })
          )}
        </section>
      ))}
    </div>
  );
}
