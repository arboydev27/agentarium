import { AlertCircle } from 'lucide-react';

/** The one thing the user must not miss. Never dims, never hides, survives watch mode. */
export function AttentionBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (!count) return null;
  return (
    <button
      className="hud-attention"
      onClick={onOpen}
      aria-label={`${count} ${count === 1 ? 'resident needs' : 'residents need'} you. Open attention list.`}
    >
      <AlertCircle size={16} aria-hidden="true" />
      <span className="hud-attention-count">{count}</span>
      <span className="hud-attention-text">{count === 1 ? 'needs you' : 'need you'}</span>
    </button>
  );
}
