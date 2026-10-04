import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import type { Agent } from './state';
import { worldCounts, type WorkFilter } from './world/hud';
import {
  WORLD_VIEWS,
  WORLD_VIEW_LABELS,
  WORLD_LOCATION_LABELS,
  type WorldLocation,
  type WorldView,
} from './world/layout';

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
  location: WorldLocation;
  navigate: (view: WorldView) => void;
  filter: (view: WorkFilter | 'attention') => void;
}) {
  const counts = worldCounts(agents, paused);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileExpanded) return;
    const onOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMobileExpanded(false);
    };
    document.addEventListener('pointerdown', onOutsidePointer);
    return () => document.removeEventListener('pointerdown', onOutsidePointer);
  }, [mobileExpanded]);

  const openView = (view: WorldView) => {
    setMobileExpanded(false);
    navigate(view);
  };
  const openFilter = (view: WorkFilter | 'attention') => {
    setMobileExpanded(false);
    filter(view);
  };

  return (
    <section
      ref={rootRef}
      className={
        'world-hud' + (compact ? ' compact' : '') + (mobileExpanded ? ' mobile-expanded' : '')
      }
      aria-label="World overview"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !mobileExpanded) return;
        event.preventDefault();
        event.stopPropagation();
        setMobileExpanded(false);
        toggleRef.current?.focus();
      }}
    >
      <button
        ref={toggleRef}
        className="world-hud-mobile-toggle"
        aria-controls="world-hud-details"
        aria-expanded={mobileExpanded}
        aria-label={`World location: ${WORLD_LOCATION_LABELS[location]}. ${counts.attention ? `${counts.attention} attention items. ` : ''}${mobileExpanded ? 'Hide' : 'Show'} world details.`}
        onClick={() => setMobileExpanded((expanded) => !expanded)}
      >
        <MapPin size={14} aria-hidden="true" />
        <span className="world-hud-mobile-name">{WORLD_LOCATION_LABELS[location]}</span>
        {counts.attention > 0 && (
          <span className="world-hud-mobile-attention" aria-hidden="true">
            {counts.attention}
          </span>
        )}
        <ChevronDown size={14} className={mobileExpanded ? 'rotate-180' : ''} aria-hidden="true" />
      </button>
      <div className="world-hud-details" id="world-hud-details">
        <div className="world-location">
          <h1>The Grove</h1>
          <span aria-hidden="true">/</span>
          <span className="world-location-name">{WORLD_LOCATION_LABELS[location]}</span>
        </div>
        <select
          className="world-jump"
          aria-label="Jump to viewpoint"
          value=""
          onChange={(event) => openView(event.target.value as WorldView)}
        >
          <option value="" disabled>
            Jump to viewpoint…
          </option>
          {WORLD_VIEWS.map((view) => (
            <option key={view} value={view}>
              {WORLD_VIEW_LABELS[view]}
            </option>
          ))}
        </select>
        {!compact && (
          <>
            <div className="hud-counts" aria-label="Task filters">
              <button onClick={() => openFilter('working')}>
                <i className="dot working" />
                {counts.working} working
              </button>
              <button
                className={counts.attention ? 'has-attention' : ''}
                onClick={() => openFilter('attention')}
              >
                <i className="dot waiting" />
                {counts.attention} need attention
              </button>
              <button onClick={() => openFilter('completed')}>{counts.completed} completed</button>
              <button onClick={() => openFilter('unknown')}>{counts.unknown} unknown</button>
              <button onClick={() => openFilter('here')}>{counts.here} here</button>
            </div>
            <p>
              {demo ? 'Simulation' : paused ? 'Updates paused' : 'Last reported activity'} ·{' '}
              {agents.length} known tasks
            </p>
          </>
        )}
        {compact && counts.attention > 0 && (
          <button className="hud-attention" onClick={() => openFilter('attention')}>
            {counts.attention} need attention
          </button>
        )}
      </div>
    </section>
  );
}
