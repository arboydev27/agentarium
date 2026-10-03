import type { Agent } from './state';
import { worldCounts, type WorkFilter } from './world/hud';
import type { WorldView } from './world/layout';
export function WorldHUD({
  agents,
  paused,
  demo,
  compact,
  location,
  navigate,
  filter,
}: {
  agents: Agent[];
  paused: boolean;
  demo: boolean;
  compact: boolean;
  location: WorldView;
  navigate: (view: WorldView) => void;
  filter: (view: WorkFilter | 'attention') => void;
}) {
  const counts = worldCounts(agents, paused);
  return (
    <section className={'world-hud' + (compact ? ' compact' : '')} aria-label="World overview">
      <div className="world-location">
        <h1>The Grove</h1>
        <span aria-hidden="true">/</span>
        <select
          aria-label="Explore district"
          value={location}
          onChange={(e) => navigate(e.target.value as WorldView)}
        >
          <option value="overview">Overview</option>
          <option value="café">Café</option>
          <option value="garden">Garden</option>
          <option value="studio">Studio</option>
          <option value="courtyard">Courtyard</option>
          <option value="lookout">Lookout</option>
          <option value="orchard">Orchard Commons</option>
          <option value="observatory">Cedar Observatory</option>
          <option value="horizon">Horizon</option>
        </select>
      </div>
      {!compact && (
        <>
          <div className="hud-counts" aria-label="Task filters">
            <button onClick={() => filter('working')}>
              <i className="dot working" />
              {counts.working} working
            </button>
            <button
              className={counts.attention ? 'has-attention' : ''}
              onClick={() => filter('attention')}
            >
              <i className="dot waiting" />
              {counts.attention} need attention
            </button>
            <button onClick={() => filter('completed')}>{counts.completed} completed</button>
            <button onClick={() => filter('unknown')}>{counts.unknown} unknown</button>
            <button onClick={() => filter('here')}>{counts.here} here</button>
          </div>
          <p>
            {demo ? 'Simulation' : paused ? 'Updates paused' : 'Last reported activity'} ·{' '}
            {agents.length} known tasks
          </p>
        </>
      )}
      {compact && counts.attention > 0 && (
        <button className="hud-attention" onClick={() => filter('attention')}>
          {counts.attention} need attention
        </button>
      )}
    </section>
  );
}
