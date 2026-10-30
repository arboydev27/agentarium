import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import type { Agent } from './state';
import { worldCounts, type WorkFilter } from './world/hud';
import { WORLD_LOCATION_LABELS, type WorldLocation } from './world/layout';

/** Top-left readout: wordmark, current place, and the factual task counts. */
export function WorldHUD({
  agents,
  paused,
  demo,
  compact,
  location,
  filter,
}: {
  agents: Agent[];
  paused: boolean;
  demo: boolean;
  compact: boolean;
  location: WorldLocation;
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

  const openFilter = (view: WorkFilter | 'attention') => {
    setMobileExpanded(false);
    filter(view);
  };

  return (
    <section
      ref={rootRef}
      className={
        'world-hud hud-fades' +
        (compact ? ' compact' : '') +
        (mobileExpanded ? ' mobile-expanded' : '')
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
        <ChevronDown size={14} className={mobileExpanded ? 'rotate-180' : ''} aria-hidden="true" />
      </button>
      <div className="world-hud-details" id="world-hud-details">
        <div className="world-location">
          <span className="hud-wordmark" aria-label="Agentarium">
            Agentarium
          </span>
          <h1 className="world-location-name">{WORLD_LOCATION_LABELS[location]}</h1>
        </div>
        {!compact && (
          <>
            <div className="hud-counts" aria-label="Task filters">
              <button onClick={() => openFilter('working')}>
                <i className="dot working" aria-hidden="true" />
                <b>{counts.working}</b> working
              </button>
              <button
                className={counts.attention ? 'has-attention' : ''}
                onClick={() => openFilter('attention')}
              >
                <i className="dot waiting" aria-hidden="true" />
                <b>{counts.attention}</b> need you
              </button>
              <button onClick={() => openFilter('completed')}>
                <b>{counts.completed}</b> done
              </button>
              <button onClick={() => openFilter('unknown')}>
                <b>{counts.unknown}</b> unknown
              </button>
              <button onClick={() => openFilter('here')}>
                <b>{counts.here}</b> here
              </button>
            </div>
            <p>
              {demo ? 'Simulation' : paused ? 'Updates paused' : 'Last reported activity'} ·{' '}
              {agents.length} known tasks
            </p>
          </>
        )}
        {compact && counts.attention > 0 && (
          <button className="hud-attention-inline" onClick={() => openFilter('attention')}>
            {counts.attention} need you
          </button>
        )}
      </div>
    </section>
  );
}
