import { useEffect, useRef, useState } from 'react';
import { useWorld } from './state';
import type { Agent, AttentionItem, WorkContext } from './state';
import { safeWorkUrl } from './shared/work.mjs';
type Entry = {
  cursor: number;
  agentId: string;
  name: string;
  provider: string;
  task: string;
  status: Agent['status'];
  time: number;
  attention?: AttentionItem;
  work?: WorkContext;
};
type Page = {
  bridgeId: string;
  items: Entry[];
  next: number;
  until: number;
  oldest: number;
  gap: boolean;
  hasMore: boolean;
};
export function Recap() {
  const bridgeId = useWorld((s) => s.bridgeId);
  const supported = useWorld((s) => s.historySupported);
  const connected = useWorld((s) => s.bridgeStatus === 'connected');
  const storageKey = 'agentarium.recap.v1:' + bridgeId;
  const [reviewed, setReviewed] = useState(() => {
    try {
      const n = Number(localStorage.getItem(storageKey));
      return Number.isSafeInteger(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  });
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const load = async (more = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const { fetchHistory } = await import('./bridge');
      const next: Page = await fetchHistory(
        more && page ? page.next : reviewed,
        more ? page?.until : undefined,
        controller.signal,
      );
      if (!controller.signal.aborted)
        setPage((old) =>
          more && old
            ? { ...next, gap: old.gap || next.gap, items: [...old.items, ...next.items] }
            : next,
        );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Unable to load recap.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  useEffect(() => {
    if (supported && connected) void load();
    return () => request.current?.abort();
    // The parent keys this component by bridge identity. Reconnect reloads from the reviewed cursor.
  }, [supported, connected]);
  if (!supported)
    return (
      <div className="empty-state">
        <h3>Since you were away</h3>
        <p>Connect to an updated bridge to load durable event history.</p>
      </div>
    );
  return (
    <section className="recap" aria-label="Since you were away">
      <h3>Since you were away</h3>
      <p>
        Reported requests, failures, completions, and observation changes since your last review.
        Local discovery scans and events lost before reaching the bridge are not included.
      </p>
      <p>
        History starts with this upgrade and retains the latest 10,000 meaningful events. Unresolved
        attention remains in the task list.
      </p>
      {error && <p role="alert">{error}</p>}
      {!connected && <p role="status">Connection lost. Showing the last loaded recap.</p>}
      {page?.gap && (
        <p role="status">Some earlier history has expired. This recap is incomplete.</p>
      )}
      <button disabled={busy || !connected} onClick={() => void load()}>
        Refresh recap
      </button>
      {busy && <p role="status">Loading recap…</p>}
      {page && !page.items.length && <p>No unreviewed changes in retained history.</p>}
      {page?.items.map((item) => {
        const source = safeWorkUrl(item.work?.sourceUrl);
        const output = safeWorkUrl(item.work?.result?.url);
        return (
          <article className="recap-item" key={item.cursor}>
            <strong>
              {item.provider} · {item.name}
            </strong>
            <p>{item.work?.objective || item.task}</p>
            <span>
              {item.status === 'completed'
                ? 'Completion reported'
                : item.status === 'failed'
                  ? 'Failure reported'
                  : item.status === 'waiting'
                    ? 'Input requested'
                    : 'Activity unconfirmed'}
            </span>
            <small>{new Date(item.time).toLocaleString()}</small>
            <p>
              {item.attention?.message ||
                item.work?.result?.summary ||
                'No additional details supplied.'}
            </p>
            <button
              onClick={() => {
                if (useWorld.getState().agents.some((a) => a.id === item.agentId))
                  useWorld.getState().select(item.agentId);
                else
                  setError(
                    'This task is no longer in the current snapshot. Use its source link when available.',
                  );
              }}
            >
              Inspect task
            </button>
            {source && (
              <a href={source} target="_blank" rel="noopener noreferrer">
                Open source ↗
              </a>
            )}
            {output && (
              <a href={output} target="_blank" rel="noopener noreferrer">
                Open output ↗
              </a>
            )}
          </article>
        );
      })}
      {page?.hasMore && (
        <button disabled={busy || !connected} onClick={() => void load(true)}>
          Load more
        </button>
      )}
      {!!page?.items.length && (
        <button
          disabled={busy}
          onClick={() => {
            const cursor = page.next;
            try {
              const previous = Number(localStorage.getItem(storageKey));
              const next =
                Number.isSafeInteger(previous) && previous >= 0
                  ? Math.max(previous, cursor)
                  : cursor;
              localStorage.setItem(storageKey, String(next));
              setReviewed(next);
              setPage(null);
              setError(
                'Loaded changes marked reviewed. Unresolved requests remain in attention. Refresh to see subsequent changes.',
              );
            } catch {
              setError(
                'Review could not be saved. Browser storage is unavailable; no changes were marked reviewed.',
              );
            }
          }}
        >
          Mark loaded changes reviewed
        </button>
      )}
    </section>
  );
}
